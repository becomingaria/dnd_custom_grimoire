import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Crown,
    KeyRound,
    Mail,
    Search,
    ShieldCheck,
    ShieldOff,
    Trash2,
    UserCheck,
    UserPlus,
    UserX,
} from "lucide-react"
import Modal from "@/components/shared/Modal"
import LoadingSpinner from "@/components/shared/LoadingSpinner"
import { useAuth } from "@/context/AuthContext"
import {
    useAdminUsers,
    useDeleteUser,
    useInviteUser,
    useUpdateUser,
} from "@/hooks/useAdminUsers"
import type { AdminUser, UserRole } from "@/api/admin"

type Notice = { ok: boolean; msg: string } | null

type PendingAction =
    | { kind: "promote" | "demote" | "disable" | "reset"; user: AdminUser }
    | { kind: "delete"; user: AdminUser }

const errMsg = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback

const dateFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
})

export default function UserManagement() {
    const { userId } = useAuth()
    const { data: users = [], isLoading, error } = useAdminUsers()
    const inviteUser = useInviteUser()
    const updateUser = useUpdateUser()
    const deleteUser = useDeleteUser()

    const [inviteEmail, setInviteEmail] = useState("")
    const [inviteRole, setInviteRole] = useState<UserRole>("user")
    const [search, setSearch] = useState("")
    const [notice, setNotice] = useState<Notice>(null)
    const [pending, setPending] = useState<PendingAction | null>(null)
    const [deleteConfirmText, setDeleteConfirmText] = useState("")
    const [busyUser, setBusyUser] = useState<string | null>(null)

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return users
        return users.filter(
            (u) =>
                u.email.includes(q) ||
                (u.displayName ?? "").toLowerCase().includes(q),
        )
    }, [users, search])

    const stats = useMemo(
        () => ({
            total: users.length,
            admins: users.filter((u) => u.role === "admin").length,
            pending: users.filter((u) => u.status === "FORCE_CHANGE_PASSWORD")
                .length,
            disabled: users.filter((u) => !u.enabled).length,
        }),
        [users],
    )

    async function handleInvite(e: React.FormEvent) {
        e.preventDefault()
        const email = inviteEmail.trim()
        if (!email) return
        setNotice(null)
        try {
            const res = await inviteUser.mutateAsync({ email, role: inviteRole })
            setNotice({
                ok: true,
                msg: res.created
                    ? `Invitation sent to ${res.email}. They'll choose a password on first sign-in.`
                    : `Invite re-sent to ${res.email}.`,
            })
            setInviteEmail("")
            setInviteRole("user")
        } catch (err) {
            setNotice({ ok: false, msg: errMsg(err, "Failed to send invite") })
        }
    }

    async function run(user: AdminUser, fn: () => Promise<string>) {
        setBusyUser(user.username)
        setNotice(null)
        try {
            setNotice({ ok: true, msg: await fn() })
        } catch (err) {
            setNotice({ ok: false, msg: errMsg(err, "Action failed") })
        } finally {
            setBusyUser(null)
        }
    }

    const resendInvite = (user: AdminUser) =>
        run(user, async () => {
            await inviteUser.mutateAsync({ email: user.email })
            return `Invite re-sent to ${user.email}.`
        })

    const enable = (user: AdminUser) =>
        run(user, async () => {
            await updateUser.mutateAsync({
                username: user.username,
                enabled: true,
            })
            return `${user.email} can sign in again.`
        })

    async function confirmPending() {
        if (!pending) return
        const { kind, user } = pending
        setPending(null)
        setDeleteConfirmText("")
        await run(user, async () => {
            switch (kind) {
                case "promote":
                    await updateUser.mutateAsync({
                        username: user.username,
                        role: "admin",
                    })
                    return `${user.email} is now an admin (takes effect on their next sign-in).`
                case "demote":
                    await updateUser.mutateAsync({
                        username: user.username,
                        role: "user",
                    })
                    return `${user.email} is no longer an admin and has been signed out.`
                case "disable":
                    await updateUser.mutateAsync({
                        username: user.username,
                        enabled: false,
                    })
                    return `${user.email} is disabled and has been signed out.`
                case "reset":
                    await inviteUser.mutateAsync({
                        email: user.email,
                        resetPassword: true,
                    })
                    return `A new temporary password was emailed to ${user.email}.`
                case "delete": {
                    const res = await deleteUser.mutateAsync(user.username)
                    return `Deleted ${res.email} and ${res.charactersDeleted} character(s). ${res.homebrewKept} homebrew spell(s) kept with their credit.`
                }
            }
        })
    }

    return (
        <div className='space-y-6'>
            {/* Invite */}
            <form
                onSubmit={handleInvite}
                className='grimoire-card space-y-3 p-4 sm:p-5'
            >
                <div className='flex items-center gap-2'>
                    <UserPlus size={16} className='text-grimoire-primary-light' />
                    <h3 className='font-cinzel text-sm font-semibold uppercase tracking-widest text-grimoire-text-base'>
                        Invite someone
                    </h3>
                </div>
                <p className='font-rajdhani text-sm text-grimoire-text-muted'>
                    They'll get an email with a temporary password and choose
                    their own the first time they sign in.
                </p>
                <div className='flex flex-col gap-2 sm:flex-row'>
                    <input
                        type='email'
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder='friend@example.com'
                        className='grimoire-input min-w-0 flex-1'
                        aria-label='Email address'
                    />
                    <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as UserRole)}
                        className='grimoire-input sm:w-36'
                        aria-label='Role'
                    >
                        <option value='user'>Player</option>
                        <option value='admin'>Admin</option>
                    </select>
                    <motion.button
                        type='submit'
                        disabled={inviteUser.isPending || !inviteEmail.trim()}
                        className='btn-primary flex items-center justify-center gap-2'
                        whileTap={{ scale: 0.97 }}
                    >
                        <Mail size={15} />
                        {inviteUser.isPending ? "Sending…" : "Send invite"}
                    </motion.button>
                </div>
            </form>

            <AnimatePresence>
                {notice && (
                    <motion.p
                        key={notice.msg}
                        role='status'
                        className={[
                            "rounded-lg border px-3 py-2 font-rajdhani text-sm",
                            notice.ok
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border-grimoire-danger/30 bg-grimoire-danger/10 text-grimoire-danger",
                        ].join(" ")}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        {notice.msg}
                    </motion.p>
                )}
            </AnimatePresence>

            {/* Summary + search */}
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex flex-wrap gap-2 font-rajdhani text-sm'>
                    <Stat label='members' value={stats.total} />
                    <Stat label='admins' value={stats.admins} />
                    <Stat label='invites pending' value={stats.pending} />
                    <Stat label='disabled' value={stats.disabled} />
                </div>
                <label className='relative sm:w-64'>
                    <Search
                        size={14}
                        className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-grimoire-text-faint'
                    />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder='Search members…'
                        className='grimoire-input pl-8'
                        aria-label='Search members'
                    />
                </label>
            </div>

            {/* List */}
            {isLoading ? (
                <div className='flex h-40 items-center justify-center'>
                    <LoadingSpinner label='Loading members…' />
                </div>
            ) : error ? (
                <p className='rounded-lg border border-grimoire-danger/30 bg-grimoire-danger/10 px-3 py-2 font-rajdhani text-sm text-grimoire-danger'>
                    Couldn't load members: {error.message}
                </p>
            ) : (
                <ul className='space-y-2'>
                    {filtered.map((user) => (
                        <UserRow
                            key={user.username}
                            user={user}
                            isSelf={user.userId === userId}
                            isBusy={busyUser === user.username}
                            onAction={(kind) =>
                                kind === "resend"
                                    ? void resendInvite(user)
                                    : kind === "enable"
                                      ? void enable(user)
                                      : setPending({ kind, user })
                            }
                        />
                    ))}
                    {filtered.length === 0 && (
                        <li className='rounded-xl border border-dashed border-grimoire-border py-10 text-center font-rajdhani text-grimoire-text-faint'>
                            No members match “{search}”.
                        </li>
                    )}
                </ul>
            )}

            {/* Confirmation */}
            <Modal
                isOpen={!!pending}
                onClose={() => {
                    setPending(null)
                    setDeleteConfirmText("")
                }}
                title={pending ? CONFIRM_COPY[pending.kind].title : ""}
                maxWidth='max-w-md'
            >
                {pending && (
                    <div className='space-y-4'>
                        <p className='font-rajdhani text-sm text-grimoire-text-muted'>
                            {CONFIRM_COPY[pending.kind].body(pending.user)}
                        </p>
                        {pending.kind === "delete" && (
                            <label className='block space-y-1.5'>
                                <span className='font-rajdhani text-xs uppercase tracking-widest text-grimoire-text-faint'>
                                    Type {pending.user.email} to confirm
                                </span>
                                <input
                                    value={deleteConfirmText}
                                    onChange={(e) =>
                                        setDeleteConfirmText(e.target.value)
                                    }
                                    className='grimoire-input'
                                    autoFocus
                                />
                            </label>
                        )}
                        <div className='flex justify-end gap-3'>
                            <button
                                onClick={() => {
                                    setPending(null)
                                    setDeleteConfirmText("")
                                }}
                                className='btn-ghost text-sm'
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => void confirmPending()}
                                disabled={
                                    pending.kind === "delete" &&
                                    deleteConfirmText.trim().toLowerCase() !==
                                        pending.user.email
                                }
                                className={[
                                    "rounded-lg px-4 py-2 font-rajdhani text-sm font-semibold text-white transition-colors disabled:opacity-40",
                                    CONFIRM_COPY[pending.kind].danger
                                        ? "bg-grimoire-danger hover:bg-grimoire-danger/80"
                                        : "bg-grimoire-primary hover:bg-grimoire-primary/80",
                                ].join(" ")}
                            >
                                {CONFIRM_COPY[pending.kind].cta}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

const CONFIRM_COPY: Record<
    PendingAction["kind"],
    {
        title: string
        cta: string
        danger: boolean
        body: (u: AdminUser) => string
    }
> = {
    promote: {
        title: "Make admin?",
        cta: "Make admin",
        danger: false,
        body: (u) =>
            `${u.email} will be able to invite, disable and delete members and edit any spell. It takes effect the next time they sign in.`,
    },
    demote: {
        title: "Remove admin access?",
        cta: "Remove admin",
        danger: true,
        body: (u) =>
            `${u.email} will become a regular player and be signed out of every device.`,
    },
    disable: {
        title: "Disable this account?",
        cta: "Disable",
        danger: true,
        body: (u) =>
            `${u.email} will be signed out and unable to sign in until you re-enable them. Their characters and spells are kept.`,
    },
    reset: {
        title: "Reset password?",
        cta: "Send new password",
        danger: true,
        body: (u) =>
            `${u.email}'s current password stops working immediately. They'll get an email with a temporary password and choose a new one on sign-in.`,
    },
    delete: {
        title: "Delete this member?",
        cta: "Delete permanently",
        danger: true,
        body: (u) =>
            `This permanently deletes ${u.email}'s account and their ${u.characterCount} character(s). Their ${u.homebrewCount} homebrew spell(s) stay in the Grimoire, still credited to them. This can't be undone — disabling is the reversible option.`,
    },
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <span className='rounded-lg border border-grimoire-border/60 bg-grimoire-surface/60 px-2.5 py-1 text-grimoire-text-muted'>
            <span className='font-mono text-grimoire-text-base'>{value}</span>{" "}
            {label}
        </span>
    )
}

type RowAction =
    | "promote"
    | "demote"
    | "disable"
    | "enable"
    | "reset"
    | "resend"
    | "delete"

function UserRow({
    user,
    isSelf,
    isBusy,
    onAction,
}: {
    user: AdminUser
    isSelf: boolean
    isBusy: boolean
    onAction: (kind: RowAction) => void
}) {
    const isPending = user.status === "FORCE_CHANGE_PASSWORD"
    const locked = isSelf || user.isOwner
    const lockReason = isSelf
        ? "You can't change your own access"
        : "The owner account is protected"
    const initials = (user.displayName ?? user.email).slice(0, 2).toUpperCase()

    return (
        <motion.li
            layout
            className={[
                "grimoire-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
                user.enabled ? "" : "opacity-60",
            ].join(" ")}
        >
            <div className='flex min-w-0 flex-1 items-start gap-3'>
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-grimoire-primary/40 bg-grimoire-primary/10 font-cinzel text-sm font-bold text-grimoire-primary-light'>
                    {initials}
                </div>
                <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-1.5'>
                        <span className='truncate font-rajdhani text-base font-semibold text-grimoire-text-base'>
                            {user.displayName ?? user.email.split("@")[0]}
                        </span>
                        {isSelf && <Badge tone='muted'>You</Badge>}
                        {user.isOwner && (
                            <Badge tone='gold'>
                                <Crown size={10} /> Owner
                            </Badge>
                        )}
                        {user.role === "admin" && (
                            <Badge tone='primary'>Admin</Badge>
                        )}
                        {isPending && <Badge tone='amber'>Invite pending</Badge>}
                        {!user.enabled &&
                            (user.patreonDisabled ? (
                                <Badge tone='danger'>Disabled · not a patron</Badge>
                            ) : (
                                <Badge tone='danger'>Disabled</Badge>
                            ))}
                    </div>
                    <p className='break-all font-rajdhani text-sm text-grimoire-text-muted'>
                        {user.email}
                    </p>
                    <p className='font-rajdhani text-xs text-grimoire-text-faint'>
                        {user.characterCount} character
                        {user.characterCount === 1 ? "" : "s"} ·{" "}
                        {user.homebrewCount} homebrew spell
                        {user.homebrewCount === 1 ? "" : "s"}
                        {user.createdAt &&
                            ` · ${isPending ? "Invited" : "Joined"} ${dateFmt.format(new Date(user.createdAt))}`}
                    </p>
                </div>
            </div>

            <div
                className='flex flex-wrap gap-1.5 sm:justify-end'
                title={locked ? lockReason : undefined}
            >
                {isPending ? (
                    <ActionButton
                        icon={Mail}
                        label='Resend invite'
                        onClick={() => onAction("resend")}
                        disabled={isBusy}
                    />
                ) : (
                    <ActionButton
                        icon={KeyRound}
                        label='Reset password'
                        onClick={() => onAction("reset")}
                        disabled={isBusy || locked}
                    />
                )}
                {user.role === "admin" ? (
                    <ActionButton
                        icon={ShieldOff}
                        label='Remove admin'
                        onClick={() => onAction("demote")}
                        disabled={isBusy || locked}
                    />
                ) : (
                    <ActionButton
                        icon={ShieldCheck}
                        label='Make admin'
                        onClick={() => onAction("promote")}
                        disabled={isBusy || locked}
                    />
                )}
                {user.enabled ? (
                    <ActionButton
                        icon={UserX}
                        label='Disable'
                        onClick={() => onAction("disable")}
                        disabled={isBusy || locked}
                    />
                ) : (
                    <ActionButton
                        icon={UserCheck}
                        label='Enable'
                        onClick={() => onAction("enable")}
                        disabled={isBusy || locked}
                    />
                )}
                <ActionButton
                    icon={Trash2}
                    label='Delete'
                    danger
                    onClick={() => onAction("delete")}
                    disabled={isBusy || locked}
                />
            </div>
        </motion.li>
    )
}

function ActionButton({
    icon: Icon,
    label,
    onClick,
    disabled,
    danger,
}: {
    icon: typeof Mail
    label: string
    onClick: () => void
    disabled?: boolean
    danger?: boolean
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            disabled={disabled}
            className={[
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-rajdhani text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                danger
                    ? "border-grimoire-danger/30 text-grimoire-danger hover:bg-grimoire-danger/10"
                    : "border-grimoire-border text-grimoire-text-muted hover:border-grimoire-primary/40 hover:text-grimoire-text-base",
            ].join(" ")}
        >
            <Icon size={13} />
            {label}
        </button>
    )
}

const BADGE_TONES = {
    primary:
        "border-grimoire-primary/40 bg-grimoire-primary/15 text-grimoire-primary-light",
    gold: "border-grimoire-accent/40 bg-grimoire-accent/10 text-grimoire-accent-light",
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    danger: "border-grimoire-danger/40 bg-grimoire-danger/10 text-grimoire-danger",
    muted: "border-grimoire-border bg-grimoire-surface text-grimoire-text-muted",
} as const

function Badge({
    tone,
    children,
}: {
    tone: keyof typeof BADGE_TONES
    children: React.ReactNode
}) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-rajdhani text-[10px] font-semibold uppercase tracking-wider ${BADGE_TONES[tone]}`}
        >
            {children}
        </span>
    )
}
