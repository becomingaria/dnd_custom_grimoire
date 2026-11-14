/**
 * Admin: Patreon-gated access.
 *
 *   GET    /admin/patreon        settings, connection status, last sync report
 *   PUT    /admin/patreon        { credentials?, mode?, requiredTierIds?,
 *                                  allowDeclined?, exemptEmails?, links? }
 *   POST   /admin/patreon/sync   run a sync now
 *   DELETE /admin/patreon        disconnect (restores anyone the sync disabled)
 *
 * Credentials are write-only: they're stored in SSM and never returned.
 */
import type {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyHandlerV2WithJWTAuthorizer,
} from "aws-lambda"
import { getCaller } from "../shared/auth"
import {
    successResponse,
    errorResponse,
    forbiddenResponse,
    notFoundResponse,
    validationErrorResponse,
    type ApiResponse,
} from "../shared/response"
import {
    deleteCredentials,
    fetchCampaign,
    loadCredentials,
    saveCredentials,
    PatreonError,
    type PatreonCredentials,
} from "../shared/patreon-client"
import {
    DEFAULT_SETTINGS,
    loadSettings,
    restoreDisabled,
    runSync,
    saveSettings,
    type AccessMode,
    type PatreonSettings,
} from "../shared/patreon-sync"

const MODES: AccessMode[] = ["off", "report", "enforce"]
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
    try {
        if (!getCaller(event).isAdmin) return forbiddenResponse()
        switch (event.routeKey) {
            case "GET /admin/patreon":
                return await status()
            case "PUT /admin/patreon":
                return await update(event)
            case "POST /admin/patreon/sync":
                return await sync()
            case "DELETE /admin/patreon":
                return await disconnect()
            default:
                return notFoundResponse("Route")
        }
    } catch (err) {
        console.error("admin/patreon error:", err)
        if (err instanceof PatreonError) return validationErrorResponse(err.message)
        return errorResponse(err instanceof Error ? err.message : "Internal error")
    }
}

async function respond(settings: PatreonSettings): Promise<ApiResponse> {
    const connected = !!(await loadCredentials())
    return successResponse({ connected, settings })
}

async function status() {
    return respond(await loadSettings())
}

async function update(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
    if (!event.body) return validationErrorResponse("Request body is required")
    const body = JSON.parse(event.body) as Partial<{
        credentials: Partial<PatreonCredentials>
        mode: AccessMode
        requiredTierIds: string[]
        allowDeclined: boolean
        exemptEmails: string[]
        links: Record<string, string>
    }>
    const s = await loadSettings()

    // ── Credentials: save, then prove they work before keeping them ──────────
    if (body.credentials) {
        const c = body.credentials
        const creds = {
            clientId: String(c.clientId ?? "").trim(),
            clientSecret: String(c.clientSecret ?? "").trim(),
            accessToken: String(c.accessToken ?? "").trim(),
            refreshToken: String(c.refreshToken ?? "").trim(),
        }
        if (Object.values(creds).some((v) => !v))
            return validationErrorResponse(
                "Client ID, Client Secret, Creator's Access Token and Creator's Refresh Token are all required.",
            )
        await saveCredentials(creds)
        try {
            const campaign = await fetchCampaign({ creds })
            s.campaign = { id: campaign.id, name: campaign.name, url: campaign.url }
            s.tiers = campaign.tiers
            s.connectedAt = new Date().toISOString()
            if (s.mode === "off") s.mode = "report"
        } catch (err) {
            await deleteCredentials()
            throw err instanceof PatreonError
                ? err
                : new PatreonError(
                      `Couldn't reach Patreon with these credentials: ${err instanceof Error ? err.message : err}`,
                  )
        }
    }

    // ── Policy ───────────────────────────────────────────────────────────────
    if (body.requiredTierIds) {
        const known = new Set(s.tiers.map((t) => t.id))
        s.requiredTierIds = body.requiredTierIds.filter((id) => known.has(id))
    }
    if (typeof body.allowDeclined === "boolean") s.allowDeclined = body.allowDeclined
    if (body.exemptEmails) {
        const emails = body.exemptEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
        const bad = emails.filter((e) => !EMAIL.test(e))
        if (bad.length) return validationErrorResponse(`Not valid emails: ${bad.join(", ")}`)
        s.exemptEmails = [...new Set(emails)].sort()
    }
    if (body.links) {
        s.links = Object.fromEntries(
            Object.entries(body.links)
                .map(([email, id]) => [email.trim().toLowerCase(), String(id).trim()])
                .filter(([email, id]) => EMAIL.test(email) && id),
        )
    }

    // ── Mode ─────────────────────────────────────────────────────────────────
    const previousMode = s.mode
    if (body.mode !== undefined) {
        if (!MODES.includes(body.mode))
            return validationErrorResponse('mode must be "off", "report" or "enforce"')
        if (body.mode !== "off" && !(await loadCredentials()))
            return validationErrorResponse("Connect Patreon before turning this on.")
        s.mode = body.mode
    }
    if (previousMode === "enforce" && s.mode !== "enforce") {
        await restoreDisabled(s)
    }

    // Any policy change re-evaluates immediately so the report stays truthful;
    // turning enforcement on applies it right away.
    if (s.mode !== "off" && (await loadCredentials())) {
        const { settings } = await runSync(s)
        return respond(settings)
    }
    await saveSettings(s)
    return respond(s)
}

async function sync() {
    const s = await loadSettings()
    if (!(await loadCredentials()))
        return validationErrorResponse("Connect Patreon first.")
    const { settings } = await runSync(s)
    return respond(settings)
}

async function disconnect() {
    const s = await loadSettings()
    await restoreDisabled(s)
    await deleteCredentials()
    const next: PatreonSettings = {
        ...DEFAULT_SETTINGS,
        // Keep the admin's lists; they're still useful if they reconnect.
        exemptEmails: s.exemptEmails,
        links: s.links,
    }
    await saveSettings(next)
    return respond(next)
}
