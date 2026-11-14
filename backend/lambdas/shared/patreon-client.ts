/**
 * Minimal Patreon API v2 client for the creator's own campaign.
 *
 * Credentials (client id/secret + Creator's Access/Refresh Token from
 * https://www.patreon.com/portal/registration/register-clients) live in one
 * SSM SecureString parameter and never leave the backend. Patreon rotates the
 * refresh token on every refresh, so the new pair is written back each time.
 */
import {
    SSMClient,
    GetParameterCommand,
    PutParameterCommand,
    DeleteParameterCommand,
    ParameterNotFound,
} from "@aws-sdk/client-ssm"

const ssm = new SSMClient({ region: process.env.REGION })
const PARAM = process.env.PATREON_PARAM ?? "/grimoire/patreon/credentials"
const API = "https://www.patreon.com/api/oauth2/v2"
// Patreon drops requests without a User-Agent (403).
const USER_AGENT = "Custom Grimoire - Patron Sync"

export interface PatreonCredentials {
    clientId: string
    clientSecret: string
    accessToken: string
    refreshToken: string
}

export interface PatreonTier {
    id: string
    title: string
    amountCents: number
    published: boolean
}

export interface PatreonCampaign {
    id: string
    name: string
    url: string | null
    tiers: PatreonTier[]
}

export interface PatreonMember {
    memberId: string
    name: string
    email: string | null
    /** "active_patron" | "declined_patron" | "former_patron" | null */
    status: string | null
    lastChargeStatus: string | null
    lastChargeDate: string | null
    amountCents: number
    tierIds: string[]
    tierTitles: string[]
}

export class PatreonError extends Error {}

// ─── Credentials ──────────────────────────────────────────────────────────────

export async function loadCredentials(): Promise<PatreonCredentials | null> {
    try {
        const r = await ssm.send(
            new GetParameterCommand({ Name: PARAM, WithDecryption: true }),
        )
        return r.Parameter?.Value
            ? (JSON.parse(r.Parameter.Value) as PatreonCredentials)
            : null
    } catch (err) {
        if (err instanceof ParameterNotFound) return null
        throw err
    }
}

export async function saveCredentials(creds: PatreonCredentials) {
    await ssm.send(
        new PutParameterCommand({
            Name: PARAM,
            Value: JSON.stringify(creds),
            Type: "SecureString",
            Overwrite: true,
            Description: "Patreon API credentials for the Grimoire patron sync",
        }),
    )
}

export async function deleteCredentials() {
    await ssm
        .send(new DeleteParameterCommand({ Name: PARAM }))
        .catch((err) => {
            if (!(err instanceof ParameterNotFound)) throw err
        })
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

async function refresh(creds: PatreonCredentials): Promise<PatreonCredentials> {
    const res = await fetch("https://www.patreon.com/api/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: creds.refreshToken,
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
        }),
    })
    if (!res.ok) {
        throw new PatreonError(
            `Patreon rejected the refresh token (${res.status}). Generate a new Creator's Access Token and Refresh Token in the Patreon developer portal and reconnect.`,
        )
    }
    const body = (await res.json()) as {
        access_token: string
        refresh_token: string
    }
    const next = {
        ...creds,
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
    }
    await saveCredentials(next)
    return next
}

/** GET with one automatic token refresh on 401. Returns parsed JSON:API. */
async function get<T>(
    path: string,
    ctx: { creds: PatreonCredentials },
): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(`${API}${path}`, {
            headers: {
                Authorization: `Bearer ${ctx.creds.accessToken}`,
                "User-Agent": USER_AGENT,
            },
        })
        if (res.status === 401 && attempt === 0) {
            ctx.creds = await refresh(ctx.creds)
            continue
        }
        if (res.status === 429) {
            throw new PatreonError(
                "Patreon rate limit reached — try again in a minute.",
            )
        }
        if (!res.ok) {
            throw new PatreonError(
                `Patreon API error ${res.status} on ${path.split("?")[0]}`,
            )
        }
        return (await res.json()) as T
    }
    throw new PatreonError("Patreon authentication failed after refresh.")
}

// ─── JSON:API shapes (only what we read) ──────────────────────────────────────

interface Resource {
    id: string
    type: string
    attributes: Record<string, unknown>
    relationships?: Record<string, { data: { id: string; type: string }[] | null }>
}
interface Doc {
    data: Resource[]
    included?: Resource[]
    meta?: { pagination?: { cursors?: { next?: string | null } } }
}

const enc = (s: string) => s.replace(/\[/g, "%5B").replace(/\]/g, "%5D")

// ─── Calls ────────────────────────────────────────────────────────────────────

/** The token owner's campaign and its tiers. */
export async function fetchCampaign(
    ctx: { creds: PatreonCredentials },
): Promise<PatreonCampaign> {
    const doc = await get<Doc>(
        enc(
            "/campaigns?include=tiers&fields[campaign]=creation_name,vanity,url&fields[tier]=title,amount_cents,published",
        ),
        ctx,
    )
    const c = doc.data[0]
    if (!c) throw new PatreonError("This Patreon account has no campaign.")
    const tiers = (doc.included ?? [])
        .filter((r) => r.type === "tier")
        .map((t) => ({
            id: t.id,
            title: String(t.attributes.title ?? "Untitled tier"),
            amountCents: Number(t.attributes.amount_cents ?? 0),
            published: Boolean(t.attributes.published),
        }))
        .filter((t) => t.amountCents > 0 || t.published)
        .sort((a, b) => a.amountCents - b.amountCents)
    return {
        id: c.id,
        name: String(
            c.attributes.creation_name || c.attributes.vanity || "Patreon campaign",
        ),
        url: (c.attributes.url as string) ?? null,
        tiers,
    }
}

/** Every member of the campaign (patrons, former patrons, followers). */
export async function fetchMembers(
    campaignId: string,
    ctx: { creds: PatreonCredentials },
): Promise<PatreonMember[]> {
    const members: PatreonMember[] = []
    let cursor: string | null | undefined
    do {
        const doc = await get<Doc>(
            enc(
                `/campaigns/${campaignId}/members?include=currently_entitled_tiers` +
                    "&fields[member]=full_name,email,patron_status,last_charge_status,last_charge_date,currently_entitled_amount_cents" +
                    "&fields[tier]=title&page[count]=1000",
            ) + (cursor ? `&page%5Bcursor%5D=${encodeURIComponent(cursor)}` : ""),
            ctx,
        )
        const tierTitle = new Map(
            (doc.included ?? [])
                .filter((r) => r.type === "tier")
                .map((t) => [t.id, String(t.attributes.title ?? "")]),
        )
        for (const m of doc.data) {
            const tierIds = (m.relationships?.currently_entitled_tiers?.data ?? []).map(
                (t) => t.id,
            )
            const email = m.attributes.email as string | null | undefined
            members.push({
                memberId: m.id,
                name: String(m.attributes.full_name ?? ""),
                email: email ? email.trim().toLowerCase() : null,
                status: (m.attributes.patron_status as string | null) ?? null,
                lastChargeStatus:
                    (m.attributes.last_charge_status as string | null) ?? null,
                lastChargeDate:
                    (m.attributes.last_charge_date as string | null) ?? null,
                amountCents: Number(
                    m.attributes.currently_entitled_amount_cents ?? 0,
                ),
                tierIds,
                tierTitles: tierIds.map((id) => tierTitle.get(id) ?? id),
            })
        }
        cursor = doc.meta?.pagination?.cursors?.next
    } while (cursor)
    return members
}
