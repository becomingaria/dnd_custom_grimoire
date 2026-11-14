import { motion } from "framer-motion"
import { BookMarked, HandHeart, Shield, Users } from "lucide-react"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import UserManagement from "@/components/admin/UserManagement"
import SpellAttributionAudit from "@/components/admin/SpellAttributionAudit"
import PatreonAccess from "@/components/admin/PatreonAccess"

const TABS = [
    { id: "users", label: "Members", icon: Users },
    { id: "spells", label: "Spell Attribution", icon: BookMarked },
    { id: "patreon", label: "Patreon", icon: HandHeart },
] as const
type TabId = (typeof TABS)[number]["id"]

export default function AdminPage() {
    const [tab, setTab] = useLocalStorage<TabId>("grimoire:admin:tab", "users")

    return (
        <div className='space-y-6'>
            <div className='flex items-center gap-3'>
                <Shield size={22} className='text-grimoire-primary-light' />
                <h2 className='font-cinzel text-2xl font-bold text-grimoire-text-base'>
                    Admin
                </h2>
            </div>

            <div
                role='tablist'
                className='flex gap-1 overflow-x-auto border-b border-grimoire-border'
            >
                {TABS.map(({ id, label, icon: Icon }) => {
                    const active = tab === id
                    return (
                        <button
                            key={id}
                            role='tab'
                            aria-selected={active}
                            onClick={() => setTab(id)}
                            className={[
                                "relative flex items-center gap-2 px-3 py-2.5 font-rajdhani text-sm font-medium transition-colors",
                                active
                                    ? "text-grimoire-primary-light"
                                    : "text-grimoire-text-muted hover:text-grimoire-text-base",
                            ].join(" ")}
                        >
                            <Icon size={15} />
                            {label}
                            {active && (
                                <motion.span
                                    layoutId='admin-tab-indicator'
                                    className='absolute inset-x-0 -bottom-px h-0.5 bg-grimoire-primary-light'
                                />
                            )}
                        </button>
                    )
                })}
            </div>

            {tab === "users" ? (
                <UserManagement />
            ) : tab === "spells" ? (
                <SpellAttributionAudit />
            ) : (
                <PatreonAccess />
            )}
        </div>
    )
}
