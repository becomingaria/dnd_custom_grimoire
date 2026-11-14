import { useEffect, useState } from "react"
import {
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    Link2,
    Mail,
    RefreshCw,
    ShieldCheck,
    Unlink,
    UserCheck,
} from "lucide-react"
import Modal from "@/components/shared/Modal"
import LoadingSpinner from "@/components/shared/LoadingSpinner"
import {
    useDisconnectPatreon,
    usePatreonStatus,
    useSyncPatreon,
    useUpdatePatreon,
} from "@/hooks/usePatreon"
import { useInviteUser } from "@/hooks/useAdminUsers"
import type {
    AccessMode,
    AccessReason,
    PatreonSettings,
    PatronSummary,
    UserAccessRow,
} from "@/api/admin"

const MODE_COPY: Record<AccessMode, { label: string; help: string }> = {
    off: { label: "Off", help: "Anyone you invite can use the Grimoire." },
    report: {
        label: "Report only",
        help: "Syncs with Patreon and shows who would lose access. Changes nobody's account.",
    },
    enforce: {
        label: "Enforce",
        help: "Members who aren't entitled patrons are disabled; they're re-enabled automatically when they pledge.",
    },
}

const REASON_LABEL: Record<AccessReason, string> = {
    owner: "Owner",
    admin: "Admin",
    exempt: "Exempt",
    patron: "Patron",
    "declined-grace": "Payment declined (grace)",
    "not-a-patron": "No matching patron",
    "former-patron": "Former patron",
    declined: "Payment declined",
    "wrong-tier": "Tier doesn't qualify",
}

const fieldClass = "grimoire-input text-sm"
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong")
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })

export default function PatreonAccess() {
    const { data, isLoading, error } = usePatreonStatus()

    if (isLoading)
        return (
            <div className='flex h-40 items-center justify-center'>
                <LoadingSpinner label='Loading Patreon settings…' />
            </div>
        )
    if (error || !data)
        return <Banner tone='danger'>Couldn't load Patreon settings: {errMsg(error)}</Banner>

    return data.connected ? (
        <Connected settings={data.settings} />
    ) : (
        <SetupGuide settings={data.settings} />
    )
}

// ─── Not connected ────────────────────────────────────────────────────────────

function SetupGuide({ settings }: { settings: PatreonSettings }) {
    const update = useUpdatePatreon()
    const [creds, setCreds] = useState({ clientId: "", clientSecret: "", accessToken: "", refreshToken: "" })
    const [err, setErr] = useState<string | null>(null)
    const set = (k: keyof typeof creds) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setCreds((c) => ({ ...c, [k]: e.target.value }))

    async function connect(e: React.FormEvent) {
        e.preventDefault()
        setErr(null)
        try {
            await update.mutateAsync({ credentials: creds })
        } catch (e2) {
            setErr(errMsg(e2))
        }
    }

    return (
        <div className='space-y-5'>
            <Card>
                <h3 className='font-cinzel text-sm font-semibold uppercase tracking-widest text-grimoire-text-base'>
                    Patron-only access
                </h3>
                <p className='font-rajdhani text-sm text-grimoire-text-muted'>
                    Connect your Patreon campaign to compare your patrons with Grimoire members. Start
                    in <strong>Report only</strong> to see who would lose access, then switch to{" "}
                    <strong>Enforce</strong> when the list looks right. Admins
                    {settings.exemptEmails.length ? ", exempt members" : ""} and the owner account always
                    keep access.
                </p>
                <ol className='list-decimal space-y-1 pl-5 font-rajdhani text-sm text-grimoire-text-muted'>
                    <li>
                        Open the{" "}
                        <a
                            href='https://www.patreon.com/portal/registration/register-clients'
                            target='_blank'
                            rel='noreferrer'
                            className='inline-flex items-center gap-0.5 text-grimoire-primary-light underline'
                        >
                            Patreon developer portal <ExternalLink size={11} />
                        </a>{" "}
                        while signed in as the campaign owner.
                    </li>
                    <li>Create a client (any name, e.g. "Grimoire Sync"; API version 2).</li>
                    <li>
                        Copy its <em>Client ID</em>, <em>Client Secret</em>, <em>Creator's Access Token</em> and{" "}
                        <em>Creator's Refresh Token</em> below.
                    </li>
                </ol>
            </Card>

            <form onSubmit={connect} className='grimoire-card space-y-3 p-4 sm:p-5' autoComplete='off'>
                <div className='grid gap-3 sm:grid-cols-2'>
                    <Field label='Client ID'>
                        <input className={fieldClass} value={creds.clientId} onChange={set("clientId")} required />
                    </Field>
                    <Field label='Client Secret'>
                        <input className={fieldClass} type='password' value={creds.clientSecret} onChange={set("clientSecret")} required autoComplete='new-password' />
                    </Field>
                    <Field label="Creator's Access Token">
                        <input className={fieldClass} type='password' value={creds.accessToken} onChange={set("accessToken")} required autoComplete='new-password' />
                    </Field>
                    <Field label="Creator's Refresh Token">
                        <input className={fieldClass} type='password' value={creds.refreshToken} onChange={set("refreshToken")} required autoComplete='new-password' />
                    </Field>
                </div>
                <p className='font-rajdhani text-xs text-grimoire-text-faint'>
                    Stored encrypted on the server and never shown again. Connecting turns on Report only — nobody's
                    access changes.
                </p>
                {err && <Banner tone='danger'>{err}</Banner>}
                <button type='submit' disabled={update.isPending} className='btn-primary flex items-center gap-2'>
                    <Link2 size={15} />
                    {update.isPending ? "Connecting…" : "Connect & test"}
                </button>
            </form>
        </div>
    )
}

// ─── Connected ────────────────────────────────────────────────────────────────

function Connected({ settings }: { settings: PatreonSettings }) {
    const update = useUpdatePatreon()
    const sync = useSyncPatreon()
    const disconnect = useDisconnectPatreon()
    const [err, setErr] = useState<string | null>(null)
    const [confirmEnforce, setConfirmEnforce] = useState(false)
    const [confirmDisconnect, setConfirmDisconnect] = useState(false)
    const report = settings.lastSync
    const busy = update.isPending || sync.isPending || disconnect.isPending

    async function run(fn: () => Promise<unknown>) {
        setErr(null)
        try {
            await fn()
        } catch (e) {
            setErr(errMsg(e))
        }
    }

    const wouldBlock = (report?.users ?? []).filter((u) => !u.allowed && u.enabled)

    return (
        <div className='space-y-5'>
            {/* Connection + mode */}
            <Card>
                <div className='flex flex-wrap items-center gap-2'>
                    <CheckCircle2 size={16} className='text-emerald-400' />
                    <span className='font-rajdhani text-sm text-grimoire-text-base'>
                        Connected to{" "}
                        {settings.campaign?.url ? (
                            <a href={settings.campaign.url} target='_blank' rel='noreferrer' className='font-semibold hover:underline'>
                                {settings.campaign.name}
                            </a>
                        ) : (
                            <strong>{settings.campaign?.name ?? "Patreon"}</strong>
                        )}
                    </span>
                    <button
                        type='button'
                        onClick={() => void run(() => sync.mutateAsync(undefined))}
                        disabled={busy}
                        className='ml-auto flex items-center gap-1.5 rounded-lg border border-grimoire-border px-3 py-1.5 font-rajdhani text-xs text-grimoire-text-muted transition-colors hover:text-grimoire-text-base disabled:opacity-40'
                    >
                        <RefreshCw size={12} className={sync.isPending ? "animate-spin" : ""} />
                        {sync.isPending ? "Syncing…" : "Sync now"}
                    </button>
                </div>

                <div role='radiogroup' aria-label='Access mode' className='grid gap-2 sm:grid-cols-3'>
                    {(Object.keys(MODE_COPY) as AccessMode[]).map((m) => (
                        <button
                            key={m}
                            type='button'
                            role='radio'
                            aria-checked={settings.mode === m}
                            disabled={busy}
                            onClick={() =>
                                m === settings.mode
                                    ? undefined
                                    : m === "enforce"
                                      ? setConfirmEnforce(true)
                                      : void run(() => update.mutateAsync({ mode: m }))
                            }
                            className={[
                                "rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                                settings.mode === m
                                    ? m === "enforce"
                                        ? "border-grimoire-danger/50 bg-grimoire-danger/10"
                                        : "border-grimoire-primary/50 bg-grimoire-primary/10"
                                    : "border-grimoire-border hover:border-grimoire-primary/30",
                            ].join(" ")}
                        >
                            <span className='block font-rajdhani text-sm font-semibold text-grimoire-text-base'>
                                {MODE_COPY[m].label}
                            </span>
                            <span className='block font-rajdhani text-xs text-grimoire-text-faint'>{MODE_COPY[m].help}</span>
                        </button>
                    ))}
                </div>
                <p className='font-rajdhani text-xs text-grimoire-text-faint'>
                    Syncs automatically every 6 hours.
                    {report && ` Last sync ${dateFmt.format(new Date(report.at))}.`}
                </p>
                {err && <Banner tone='danger'>{err}</Banner>}
                {report?.error && <Banner tone='danger'>Last sync failed: {report.error}</Banner>}
                {report?.enforcementSkipped && <Banner tone='warn'>{report.enforcementSkipped}</Banner>}
                {report && (report.disabled.length > 0 || report.enabled.length > 0) && (
                    <Banner tone='info'>
                        Last sync {report.disabled.length ? `disabled ${report.disabled.join(", ")}` : ""}
                        {report.disabled.length && report.enabled.length ? "; " : ""}
                        {report.enabled.length ? `re-enabled ${report.enabled.join(", ")}` : ""}.
                    </Banner>
                )}
            </Card>

            <PolicyCard settings={settings} onError={setErr} />

            {report?.ok && <ReportView settings={settings} />}

            <button
                type='button'
                onClick={() => setConfirmDisconnect(true)}
                className='font-rajdhani text-xs text-grimoire-text-faint underline hover:text-grimoire-danger'
            >
                Disconnect Patreon
            </button>

            <Modal isOpen={confirmEnforce} onClose={() => setConfirmEnforce(false)} title='Turn on enforcement?' maxWidth='max-w-md'>
                <div className='space-y-3 font-rajdhani text-sm text-grimoire-text-muted'>
                    {!report?.ok ? (
                        <p>Run a successful sync first so you can see who would be affected.</p>
                    ) : wouldBlock.length === 0 ? (
                        <p>Based on the last sync, nobody would lose access right now.</p>
                    ) : (
                        <>
                            <p>
                                Based on the last sync, <strong className='text-grimoire-text-base'>{wouldBlock.length}</strong>{" "}
                                member{wouldBlock.length === 1 ? "" : "s"} will be disabled and signed out:
                            </p>
                            <ul className='max-h-40 overflow-y-auto rounded-lg border border-grimoire-border px-3 py-2 text-xs'>
                                {wouldBlock.map((u) => (
                                    <li key={u.username}>
                                        {u.email} — {REASON_LABEL[u.reason]}
                                    </li>
                                ))}
                            </ul>
                            <p>They get access back automatically when they pledge. Switching away from Enforce re-enables them.</p>
                        </>
                    )}
                    <div className='flex justify-end gap-3 pt-1'>
                        <button onClick={() => setConfirmEnforce(false)} className='btn-ghost text-sm'>Cancel</button>
                        <button
                            disabled={!report?.ok || busy}
                            onClick={() => {
                                setConfirmEnforce(false)
                                void run(() => update.mutateAsync({ mode: "enforce" }))
                            }}
                            className='rounded-lg bg-grimoire-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-40'
                        >
                            Enforce
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={confirmDisconnect} onClose={() => setConfirmDisconnect(false)} title='Disconnect Patreon?' maxWidth='max-w-md'>
                <div className='space-y-3 font-rajdhani text-sm text-grimoire-text-muted'>
                    <p>
                        Deletes the stored Patreon credentials and turns access checks off.
                        {settings.disabledByPatreon.length > 0 &&
                            ` The ${settings.disabledByPatreon.length} member(s) the sync disabled will be re-enabled.`}{" "}
                        Your exemptions and patron links are kept.
                    </p>
                    <div className='flex justify-end gap-3'>
                        <button onClick={() => setConfirmDisconnect(false)} className='btn-ghost text-sm'>Cancel</button>
                        <button
                            onClick={() => {
                                setConfirmDisconnect(false)
                                void run(() => disconnect.mutateAsync(undefined))
                            }}
                            className='rounded-lg bg-grimoire-danger px-4 py-2 text-sm font-semibold text-white'
                        >
                            Disconnect
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

function PolicyCard({ settings, onError }: { settings: PatreonSettings; onError: (e: string | null) => void }) {
    const update = useUpdatePatreon()
    const [tiers, setTiers] = useState(settings.requiredTierIds)
    const [allowDeclined, setAllowDeclined] = useState(settings.allowDeclined)
    const [exempt, setExempt] = useState(settings.exemptEmails.join("\n"))

    useEffect(() => {
        setTiers(settings.requiredTierIds)
        setAllowDeclined(settings.allowDeclined)
        setExempt(settings.exemptEmails.join("\n"))
    }, [settings.requiredTierIds, settings.allowDeclined, settings.exemptEmails])

    const exemptList = exempt.split(/[\s,]+/).map((e) => e.trim()).filter(Boolean)
    const dirty =
        JSON.stringify([...tiers].sort()) !== JSON.stringify([...settings.requiredTierIds].sort()) ||
        allowDeclined !== settings.allowDeclined ||
        JSON.stringify([...exemptList].map((e) => e.toLowerCase()).sort()) !== JSON.stringify(settings.exemptEmails)

    async function save() {
        onError(null)
        try {
            await update.mutateAsync({ requiredTierIds: tiers, allowDeclined, exemptEmails: exemptList })
        } catch (e) {
            onError(errMsg(e))
        }
    }

    return (
        <Card>
            <h3 className='font-cinzel text-sm font-semibold uppercase tracking-widest text-grimoire-text-base'>Who counts as a patron</h3>
            <div className='space-y-1.5'>
                <span className='block font-rajdhani text-xs uppercase tracking-widest text-grimoire-text-faint'>
                    Qualifying tiers {tiers.length === 0 && "— any tier"}
                </span>
                <div className='flex flex-wrap gap-1.5'>
                    {settings.tiers.map((t) => {
                        const on = tiers.includes(t.id)
                        return (
                            <button
                                key={t.id}
                                type='button'
                                role='switch'
                                aria-checked={on}
                                onClick={() => setTiers((cur) => (on ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}
                                className={[
                                    "rounded border px-2.5 py-1 font-rajdhani text-xs transition-colors",
                                    on
                                        ? "border-grimoire-primary/50 bg-grimoire-primary/15 text-grimoire-primary-light"
                                        : "border-grimoire-border/60 bg-grimoire-surface text-grimoire-text-muted hover:text-grimoire-text-base",
                                ].join(" ")}
                            >
                                {t.title} · ${(t.amountCents / 100).toFixed(2)}
                            </button>
                        )
                    })}
                    {settings.tiers.length === 0 && (
                        <span className='font-rajdhani text-xs text-grimoire-text-faint'>No tiers found — any active patron qualifies.</span>
                    )}
                </div>
            </div>
            <label className='flex cursor-pointer items-start gap-2.5'>
                <input type='checkbox' checked={allowDeclined} onChange={(e) => setAllowDeclined(e.target.checked)} className='mt-0.5 h-4 w-4 accent-grimoire-primary' />
                <span className='font-rajdhani text-sm text-grimoire-text-muted'>
                    Keep access while a payment is declined{" "}
                    <span className='text-grimoire-text-faint'>(Patreon retries failed payments for a while)</span>
                </span>
            </label>
            <Field label='Always allowed (one email per line)'>
                <textarea
                    value={exempt}
                    onChange={(e) => setExempt(e.target.value)}
                    rows={3}
                    placeholder='friend@example.com'
                    className={`${fieldClass} resize-y font-mono text-xs`}
                />
            </Field>
            <button type='button' onClick={() => void save()} disabled={!dirty || update.isPending} className='btn-primary self-start text-sm'>
                {update.isPending ? "Saving…" : "Save & re-check"}
            </button>
        </Card>
    )
}

function ReportView({ settings }: { settings: PatreonSettings }) {
    const report = settings.lastSync!
    const update = useUpdatePatreon()
    const invite = useInviteUser()
    const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null)
    const enforcing = settings.mode === "enforce"

    const allowed = report.users.filter((u) => u.allowed)
    const blocked = report.users.filter((u) => !u.allowed)
    // Patrons a blocked member could be linked to: unclaimed + any not matched.
    const linkable = report.unclaimedPatrons

    async function act(fn: () => Promise<unknown>, msg: string) {
        setNotice(null)
        try {
            await fn()
            setNotice({ ok: true, msg })
        } catch (e) {
            setNotice({ ok: false, msg: errMsg(e) })
        }
    }

    const link = (email: string, memberId: string | null) => {
        const links = { ...settings.links }
        if (memberId) links[email] = memberId
        else delete links[email]
        return act(() => update.mutateAsync({ links }), memberId ? `Linked ${email}.` : `Unlinked ${email}.`)
    }
    const exempt = (email: string) =>
        act(() => update.mutateAsync({ exemptEmails: [...settings.exemptEmails, email] }), `${email} is now always allowed.`)

    const sorted = [...blocked, ...allowed]

    return (
        <div className='space-y-4'>
            <div className='flex flex-wrap gap-2 font-rajdhani text-sm'>
                <Chip value={report.patronCount} label='active patrons' />
                <Chip value={allowed.length} label='members allowed' />
                <Chip value={blocked.length} label={enforcing ? "members blocked" : "would be blocked"} tone={blocked.length ? "warn" : undefined} />
                <Chip value={report.unclaimedPatrons.length} label='patrons without an account' />
            </div>
            {notice && <Banner tone={notice.ok ? "info" : "danger"}>{notice.msg}</Banner>}

            <section className='space-y-2'>
                <h4 className='font-cinzel text-xs uppercase tracking-widest text-grimoire-text-faint'>Members</h4>
                <ul className='space-y-1.5'>
                    {sorted.map((u) => (
                        <MemberRow
                            key={u.username}
                            row={u}
                            enforcing={enforcing}
                            linkable={linkable}
                            busy={update.isPending}
                            onLink={(id) => void link(u.email, id)}
                            onExempt={() => void exempt(u.email)}
                        />
                    ))}
                </ul>
            </section>

            {report.unclaimedPatrons.length > 0 && (
                <section className='space-y-2'>
                    <h4 className='font-cinzel text-xs uppercase tracking-widest text-grimoire-text-faint'>Patrons without an account</h4>
                    <ul className='space-y-1.5'>
                        {report.unclaimedPatrons.map((p) => (
                            <li key={p.memberId} className='flex flex-wrap items-center gap-2 rounded-lg border border-grimoire-border/60 bg-grimoire-surface/40 px-3 py-2'>
                                <div className='min-w-0 flex-1'>
                                    <p className='font-rajdhani text-sm font-semibold text-grimoire-text-base'>{p.name || "Unnamed patron"}</p>
                                    <p className='break-all font-rajdhani text-xs text-grimoire-text-faint'>
                                        {p.email ?? "no email shared"} · {p.tierTitles.join(", ") || "no tier"}
                                    </p>
                                </div>
                                {p.email && (
                                    <button
                                        type='button'
                                        disabled={invite.isPending}
                                        onClick={() => void act(() => invite.mutateAsync({ email: p.email! }), `Invitation sent to ${p.email}.`)}
                                        className='flex items-center gap-1 rounded-lg border border-grimoire-primary/40 px-2.5 py-1 font-rajdhani text-xs text-grimoire-primary-light hover:bg-grimoire-primary/10 disabled:opacity-40'
                                    >
                                        <Mail size={12} /> Invite
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    )
}

function MemberRow({
    row,
    enforcing,
    linkable,
    busy,
    onLink,
    onExempt,
}: {
    row: UserAccessRow
    enforcing: boolean
    linkable: PatronSummary[]
    busy: boolean
    onLink: (memberId: string | null) => void
    onExempt: () => void
}) {
    const [linking, setLinking] = useState(false)
    const special = row.reason === "owner" || row.reason === "admin" || row.reason === "exempt"
    return (
        <li className='flex flex-wrap items-center gap-2 rounded-lg border border-grimoire-border/60 bg-grimoire-surface/40 px-3 py-2'>
            <div className='min-w-0 flex-1'>
                <p className='font-rajdhani text-sm font-semibold text-grimoire-text-base'>
                    {row.displayName ?? row.email.split("@")[0]}
                    <span className='block break-all font-normal text-grimoire-text-faint sm:ml-2 sm:inline'>{row.email}</span>
                </p>
                <p className='font-rajdhani text-xs text-grimoire-text-faint'>
                    {row.patron
                        ? `${row.linked ? "Linked to" : "Matched"} ${row.patron.name || row.patron.email} · ${row.patron.status?.replace("_", " ") ?? "no pledge"}${row.patron.tierTitles.length ? ` · ${row.patron.tierTitles.join(", ")}` : ""}`
                        : "No matching patron"}
                </p>
            </div>
            <span
                className={[
                    "flex items-center gap-1 rounded border px-1.5 py-0.5 font-rajdhani text-[10px] font-semibold uppercase tracking-wider",
                    row.allowed
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-grimoire-danger/40 bg-grimoire-danger/10 text-grimoire-danger",
                ].join(" ")}
            >
                {row.allowed ? <ShieldCheck size={10} /> : <AlertTriangle size={10} />}
                {row.allowed ? REASON_LABEL[row.reason] : `${enforcing ? "Blocked" : "Would block"} · ${REASON_LABEL[row.reason]}`}
            </span>
            {!special && (
                <div className='flex w-full flex-wrap gap-1.5 sm:w-auto'>
                    {row.linked ? (
                        <SmallButton onClick={() => onLink(null)} disabled={busy} icon={<Unlink size={11} />}>Unlink</SmallButton>
                    ) : (
                        !row.patron &&
                        (linking ? (
                            <select
                                autoFocus
                                defaultValue=''
                                onChange={(e) => {
                                    if (e.target.value) onLink(e.target.value)
                                    setLinking(false)
                                }}
                                onBlur={() => setLinking(false)}
                                className='rounded border border-grimoire-border bg-grimoire-surface px-1.5 py-1 font-rajdhani text-xs text-grimoire-text-base'
                                aria-label={`Link ${row.email} to a patron`}
                            >
                                <option value=''>Choose patron…</option>
                                {linkable.map((p) => (
                                    <option key={p.memberId} value={p.memberId}>
                                        {p.name || p.email} {p.email ? `(${p.email})` : ""}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            linkable.length > 0 && (
                                <SmallButton onClick={() => setLinking(true)} disabled={busy} icon={<Link2 size={11} />}>
                                    Link patron
                                </SmallButton>
                            )
                        ))
                    )}
                    {!row.allowed && (
                        <SmallButton onClick={onExempt} disabled={busy} icon={<UserCheck size={11} />}>
                            Always allow
                        </SmallButton>
                    )}
                </div>
            )}
        </li>
    )
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
    return <div className='grimoire-card flex flex-col gap-3 p-4 sm:p-5'>{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className='block space-y-1'>
            <span className='block font-rajdhani text-xs uppercase tracking-widest text-grimoire-text-faint'>{label}</span>
            {children}
        </label>
    )
}

function Banner({ tone, children }: { tone: "danger" | "warn" | "info"; children: React.ReactNode }) {
    const cls = {
        danger: "border-grimoire-danger/30 bg-grimoire-danger/10 text-grimoire-danger",
        warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
        info: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    }[tone]
    return <p role={tone === "danger" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 font-rajdhani text-sm ${cls}`}>{children}</p>
}

function Chip({ value, label, tone }: { value: number; label: string; tone?: "warn" }) {
    return (
        <span className={`rounded-lg border px-2.5 py-1 ${tone === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-grimoire-border/60 bg-grimoire-surface/60 text-grimoire-text-muted"}`}>
            <span className='font-mono text-grimoire-text-base'>{value}</span> {label}
        </span>
    )
}

function SmallButton({ onClick, disabled, icon, children }: { onClick: () => void; disabled?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <button
            type='button'
            onClick={onClick}
            disabled={disabled}
            className='flex items-center gap-1 rounded-lg border border-grimoire-border px-2 py-1 font-rajdhani text-xs text-grimoire-text-muted transition-colors hover:border-grimoire-primary/40 hover:text-grimoire-text-base disabled:opacity-40'
        >
            {icon}
            {children}
        </button>
    )
}
