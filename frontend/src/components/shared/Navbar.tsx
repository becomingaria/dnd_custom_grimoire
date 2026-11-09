import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
    BookOpen,
    Users,
    Home,
    LogOut,
    Check,
    ArrowRight,
    Menu,
    Shield,
} from "lucide-react"
import { updatePassword } from "aws-amplify/auth"
import { useAuth } from "@/context/AuthContext"
import Drawer from "@/components/shared/Drawer"
import Modal from "@/components/shared/Modal"

const baseNavLinks = [
    { to: "/", label: "Home", icon: Home },
    { to: "/spells", label: "Spells", icon: BookOpen },
    { to: "/characters", label: "Characters", icon: Users },
]
const adminNavLink = { to: "/admin", label: "Admin", icon: Shield }

export default function Navbar() {
    const { pathname } = useLocation()
    const {
        user,
        email,
        userId,
        displayName,
        isAdmin,
        updateDisplayName,
        logout,
    } = useAuth()
    const [showProfile, setShowProfile] = useState(false)
    const [showMobileNav, setShowMobileNav] = useState(false)
    const [usernameInput, setUsernameInput] = useState("")
    const [isSavingName, setIsSavingName] = useState(false)
    const [nameError, setNameError] = useState<string | null>(null)
    const navLinks = isAdmin ? [...baseNavLinks, adminNavLink] : baseNavLinks

    // ── Change password ────────────────────────────────────────────────────────
    const [newPasswordInput, setNewPasswordInput] = useState("")
    const [showChangePwModal, setShowChangePwModal] = useState(false)
    const [currentPw1, setCurrentPw1] = useState("")
    const [currentPw2, setCurrentPw2] = useState("")
    const [isChangingPw, setIsChangingPw] = useState(false)
    const [changePwError, setChangePwError] = useState<string | null>(null)
    const [changePwSuccess, setChangePwSuccess] = useState(false)

    function openProfile() {
        setUsernameInput(displayName ?? "")
        setNewPasswordInput("")
        setChangePwSuccess(false)
        setShowProfile(true)
    }

    async function handleSaveName() {
        if (usernameInput.trim() === (displayName ?? "")) return
        setIsSavingName(true)
        setNameError(null)
        try {
            await updateDisplayName(usernameInput)
        } catch (err: unknown) {
            const msg =
                err instanceof Error ? err.message : "Could not save username"
            setNameError(msg)
        } finally {
            setIsSavingName(false)
        }
    }

    function openChangePwModal() {
        setCurrentPw1("")
        setCurrentPw2("")
        setChangePwError(null)
        setShowChangePwModal(true)
    }

    async function handleChangePassword() {
        if (currentPw1 !== currentPw2) {
            setChangePwError("Current passwords do not match.")
            return
        }
        if (!currentPw1) {
            setChangePwError("Please enter your current password.")
            return
        }
        setIsChangingPw(true)
        setChangePwError(null)
        try {
            await updatePassword({
                oldPassword: currentPw1,
                newPassword: newPasswordInput,
            })
            setShowChangePwModal(false)
            setNewPasswordInput("")
            setChangePwSuccess(true)
            window.setTimeout(() => setChangePwSuccess(false), 3000)
        } catch (err: unknown) {
            const msg =
                err instanceof Error ? err.message : "Could not update password"
            setChangePwError(msg)
        } finally {
            setIsChangingPw(false)
        }
    }

    const initials = (displayName ?? email ?? "?").slice(0, 2).toUpperCase()

    return (
        <>
            <header className='fixed inset-x-0 top-0 z-30 border-b border-grimoire-border bg-grimoire-surface/80 backdrop-blur-md'>
                <nav className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6'>
                    {/* Logo */}
                    <Link to='/' className='group flex items-center gap-2'>
                        <motion.img
                            src='/grimoire.png'
                            alt='Grimoire'
                            className='h-9 w-9 rounded-lg object-contain'
                            whileHover={{ scale: 1.1 }}
                            transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 20,
                            }}
                        />
                        <span className='font-cinzel text-lg font-bold tracking-wider text-grimoire-text-base'>
                            Grimoire
                        </span>
                    </Link>

                    {/* Navigation links */}
                    <ul className='hidden items-center gap-1 md:flex'>
                        {navLinks.map(({ to, label, icon: Icon }) => {
                            const isActive =
                                to === "/"
                                    ? pathname === "/"
                                    : pathname.startsWith(to)
                            return (
                                <li key={to}>
                                    <Link
                                        to={to}
                                        className={[
                                            "relative flex items-center gap-2 rounded-lg px-3.5 py-2 font-rajdhani text-sm font-medium",
                                            "tracking-wide transition-colors duration-150",
                                            isActive
                                                ? "text-grimoire-primary-light"
                                                : "text-grimoire-text-muted hover:text-grimoire-text-base",
                                        ].join(" ")}
                                    >
                                        <Icon size={16} />
                                        <span>{label}</span>
                                        {isActive && (
                                            <motion.div
                                                layoutId='nav-indicator'
                                                className='absolute inset-0 rounded-lg border border-grimoire-primary/30 bg-grimoire-primary/10'
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 380,
                                                    damping: 30,
                                                }}
                                            />
                                        )}
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>

                    {/* Right side: profile + mobile menu toggle */}
                    <div className='flex items-center gap-2'>
                        <AnimatePresence mode='wait'>
                            {user && (
                                <motion.button
                                    key='profile-btn'
                                    onClick={() => openProfile()}
                                    className='flex h-9 w-9 items-center justify-center rounded-full border border-grimoire-primary/40 bg-grimoire-primary/10 font-cinzel text-sm font-bold text-grimoire-primary-light transition-colors hover:border-grimoire-primary/70 hover:bg-grimoire-primary/20'
                                    style={{
                                        boxShadow:
                                            "0 0 10px rgba(124,58,237,0.2)",
                                    }}
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.94 }}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    title='Profile'
                                >
                                    {initials}
                                </motion.button>
                            )}
                        </AnimatePresence>
                        <button
                            onClick={() => setShowMobileNav(true)}
                            className='flex h-9 w-9 items-center justify-center rounded-lg text-grimoire-text-muted transition-colors hover:bg-grimoire-border/40 hover:text-grimoire-text-base md:hidden'
                            aria-label='Open menu'
                        >
                            <Menu size={20} />
                        </button>
                    </div>
                </nav>

                {/* Mobile Nav Drawer */}
                <Drawer
                    side='left'
                    isOpen={showMobileNav}
                    onClose={() => setShowMobileNav(false)}
                    title='Menu'
                    width='w-full max-w-xs'
                >
                    <ul className='space-y-1'>
                        {navLinks.map(({ to, label, icon: Icon }) => {
                            const isActive =
                                to === "/"
                                    ? pathname === "/"
                                    : pathname.startsWith(to)
                            return (
                                <li key={to}>
                                    <Link
                                        to={to}
                                        onClick={() => setShowMobileNav(false)}
                                        className={[
                                            "flex items-center gap-3 rounded-lg px-3.5 py-2.5 font-rajdhani text-base font-medium",
                                            "tracking-wide transition-colors duration-150",
                                            isActive
                                                ? "bg-grimoire-primary/10 text-grimoire-primary-light"
                                                : "text-grimoire-text-muted hover:text-grimoire-text-base",
                                        ].join(" ")}
                                    >
                                        <Icon size={18} />
                                        <span>{label}</span>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </Drawer>

                {/* Profile Drawer */}
                <Drawer
                    side='right'
                    isOpen={showProfile}
                    onClose={() => setShowProfile(false)}
                    title='Profile'
                    width='w-full max-w-xs'
                >
                    <div className='flex flex-col items-center gap-6 pt-4'>
                        {/* Avatar */}
                        <div
                            className='flex h-20 w-20 items-center justify-center rounded-full border-2 border-grimoire-primary/50 bg-grimoire-primary/15 font-cinzel text-3xl font-bold text-grimoire-primary-light'
                            style={{
                                boxShadow: "0 0 24px rgba(124,58,237,0.3)",
                            }}
                        >
                            {initials}
                        </div>

                        {/* Username */}
                        <div className='w-full space-y-1.5'>
                            <label className='font-cinzel text-xs uppercase tracking-widest text-grimoire-text-faint'>
                                Username
                            </label>
                            <div className='flex gap-2'>
                                <input
                                    value={usernameInput}
                                    onChange={(e) => {
                                        setUsernameInput(e.target.value)
                                        setNameError(null)
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                            void handleSaveName()
                                    }}
                                    placeholder='Set a display name…'
                                    className={[
                                        "flex-1 rounded-lg border bg-grimoire-surface px-3 py-2 font-rajdhani text-sm text-grimoire-text-base placeholder-grimoire-text-faint outline-none transition-colors",
                                        nameError
                                            ? "border-grimoire-danger/60 focus:border-grimoire-danger"
                                            : "border-grimoire-border focus:border-grimoire-primary/60",
                                    ].join(" ")}
                                />
                                <motion.button
                                    onClick={() => void handleSaveName()}
                                    disabled={
                                        isSavingName ||
                                        usernameInput.trim() ===
                                            (displayName ?? "")
                                    }
                                    className='flex items-center justify-center rounded-lg border border-grimoire-primary/40 bg-grimoire-primary/10 px-3 text-grimoire-primary-light transition-colors hover:bg-grimoire-primary/20 disabled:opacity-40'
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Check size={15} />
                                </motion.button>
                            </div>
                            {nameError && (
                                <p className='font-rajdhani text-xs text-grimoire-danger'>
                                    {nameError}
                                </p>
                            )}
                        </div>

                        {/* Info */}
                        <div className='w-full space-y-4'>
                            <div>
                                <p className='font-cinzel text-xs uppercase tracking-widest text-grimoire-text-faint'>
                                    Email
                                </p>
                                <p className='mt-1 font-rajdhani text-grimoire-text-base break-all'>
                                    {email ?? "—"}
                                </p>
                            </div>
                            <div>
                                <p className='font-cinzel text-xs uppercase tracking-widest text-grimoire-text-faint'>
                                    User ID
                                </p>
                                <p className='mt-1 font-mono text-xs text-grimoire-text-faint break-all'>
                                    {userId ?? "—"}
                                </p>
                            </div>
                        </div>

                        {/* New Password */}
                        <div className='w-full space-y-1.5'>
                            <label className='font-cinzel text-xs uppercase tracking-widest text-grimoire-text-faint'>
                                New Password
                            </label>
                            <div className='flex gap-2'>
                                <input
                                    type='password'
                                    value={newPasswordInput}
                                    onChange={(e) => {
                                        setNewPasswordInput(e.target.value)
                                        setChangePwSuccess(false)
                                    }}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === "Enter" &&
                                            newPasswordInput.trim()
                                        )
                                            openChangePwModal()
                                    }}
                                    placeholder='New password…'
                                    className='flex-1 rounded-lg border border-grimoire-border bg-grimoire-surface px-3 py-2 font-rajdhani text-sm text-grimoire-text-base placeholder-grimoire-text-faint outline-none transition-colors focus:border-grimoire-primary/60'
                                />
                                <motion.button
                                    onClick={() => openChangePwModal()}
                                    disabled={!newPasswordInput.trim()}
                                    className='flex items-center justify-center rounded-lg border border-grimoire-primary/40 bg-grimoire-primary/10 px-3 text-grimoire-primary-light transition-colors hover:bg-grimoire-primary/20 disabled:opacity-40'
                                    whileTap={{ scale: 0.95 }}
                                    title='Change password'
                                >
                                    <ArrowRight size={15} />
                                </motion.button>
                            </div>
                            <AnimatePresence>
                                {changePwSuccess && (
                                    <motion.p
                                        key='pw-success'
                                        className='font-rajdhani text-xs text-emerald-400'
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        Password updated successfully.
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Divider */}
                        <div className='w-full border-t border-grimoire-border' />

                        {/* Admin shortcut */}
                        {isAdmin && (
                            <Link
                                to='/admin'
                                onClick={() => setShowProfile(false)}
                                className='flex w-full items-center justify-center gap-2 rounded-lg border border-grimoire-primary/40 bg-grimoire-primary/10 px-4 py-2.5 font-rajdhani text-sm font-medium text-grimoire-primary-light transition-colors hover:bg-grimoire-primary/20'
                            >
                                <Shield size={15} />
                                Manage users &amp; spells
                            </Link>
                        )}

                        {/* Sign out */}
                        <motion.button
                            onClick={async () => {
                                setShowProfile(false)
                                await logout()
                            }}
                            className='flex w-full items-center justify-center gap-2 rounded-lg border border-grimoire-danger/30 px-4 py-2.5 font-rajdhani text-sm font-medium text-grimoire-danger transition-colors hover:bg-grimoire-danger/10'
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <LogOut size={15} />
                            Sign out
                        </motion.button>
                    </div>
                </Drawer>
            </header>

            {/* Change Password Modal */}
            <Modal
                isOpen={showChangePwModal}
                onClose={() => setShowChangePwModal(false)}
                title='Confirm Password Change'
                maxWidth='max-w-sm'
            >
                <div className='space-y-4'>
                    <p className='font-rajdhani text-sm text-grimoire-text-muted'>
                        Enter your current password twice to confirm.
                    </p>
                    <div className='space-y-3'>
                        <div>
                            <label className='mb-1.5 block font-cinzel text-xs uppercase tracking-widest text-grimoire-text-faint'>
                                Current Password
                            </label>
                            <input
                                type='password'
                                value={currentPw1}
                                onChange={(e) => {
                                    setCurrentPw1(e.target.value)
                                    setChangePwError(null)
                                }}
                                placeholder='Current password'
                                autoFocus
                                className='w-full rounded-lg border border-grimoire-border bg-grimoire-surface px-3 py-2 font-rajdhani text-sm text-grimoire-text-base placeholder-grimoire-text-faint outline-none transition-colors focus:border-grimoire-primary/60'
                            />
                        </div>
                        <div>
                            <label className='mb-1.5 block font-cinzel text-xs uppercase tracking-widest text-grimoire-text-faint'>
                                Confirm Current Password
                            </label>
                            <input
                                type='password'
                                value={currentPw2}
                                onChange={(e) => {
                                    setCurrentPw2(e.target.value)
                                    setChangePwError(null)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                        void handleChangePassword()
                                }}
                                placeholder='Current password again'
                                className='w-full rounded-lg border border-grimoire-border bg-grimoire-surface px-3 py-2 font-rajdhani text-sm text-grimoire-text-base placeholder-grimoire-text-faint outline-none transition-colors focus:border-grimoire-primary/60'
                            />
                        </div>
                    </div>
                    <AnimatePresence>
                        {changePwError && (
                            <motion.p
                                key='pw-error'
                                className='font-rajdhani text-xs text-grimoire-danger'
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                            >
                                {changePwError}
                            </motion.p>
                        )}
                    </AnimatePresence>
                    <div className='flex justify-end gap-3 pt-1'>
                        <button
                            onClick={() => setShowChangePwModal(false)}
                            className='rounded-lg border border-grimoire-border px-4 py-2 font-rajdhani text-sm text-grimoire-text-muted transition-colors hover:text-grimoire-text-base'
                        >
                            Cancel
                        </button>
                        <motion.button
                            onClick={() => void handleChangePassword()}
                            disabled={isChangingPw}
                            className='flex items-center gap-2 rounded-lg bg-grimoire-primary px-4 py-2 font-rajdhani text-sm font-semibold text-white transition-colors hover:bg-grimoire-primary/80 disabled:opacity-50'
                            whileTap={{ scale: 0.97 }}
                        >
                            {isChangingPw ? "Updating…" : "Update Password"}
                        </motion.button>
                    </div>
                </div>
            </Modal>
        </>
    )
}
