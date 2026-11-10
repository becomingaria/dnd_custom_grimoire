import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronUp, Dices, History, Trash2, Wand2 } from "lucide-react"
import DiceRoller from "./DiceRoller"
import ConvictionCaster from "./ConvictionCaster"
import { useDiceTray } from "@/context/DiceTrayContext"

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })

/**
 * Bottom dice tray. Minimized it's a slim strip with an up arrow; opened it
 * rises from the bottom of the screen. Lives in Layout so it's on every page.
 */
export default function DiceTray() {
    const tray = useDiceTray()
    const last = tray.history[0]

    // Esc minimizes the tray.
    useEffect(() => {
        if (!tray.isOpen) return
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && tray.close()
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [tray.isOpen, tray])

    return (
        // Open: above drawers/modals (z-60) so "Cast" from a drawer is visible.
        // Minimized: below them, so open drawers cover the strip.
        <div
            className={`pointer-events-none fixed inset-x-0 bottom-0 flex justify-center ${tray.isOpen ? "z-[70]" : "z-30"}`}
        >
            <AnimatePresence initial={false} mode='wait'>
                {tray.isOpen ? (
                    <motion.section
                        key='tray'
                        role='dialog'
                        aria-label='Dice tray'
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 260, damping: 30 }}
                        className='pointer-events-auto flex max-h-[80vh] w-full max-w-2xl flex-col rounded-t-2xl border border-b-0 border-grimoire-border bg-grimoire-card/95 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md'
                    >
                        {/* Header */}
                        <div className='flex items-center gap-2 border-b border-grimoire-border/60 px-3 py-2 sm:px-4'>
                            <Dices size={16} className='shrink-0 text-grimoire-primary-light' />
                            <h2 className='font-cinzel text-sm font-bold tracking-wider text-grimoire-text-base'>
                                Dice
                            </h2>

                            <label className='ml-auto flex cursor-pointer select-none items-center gap-2 font-rajdhani text-xs text-grimoire-text-muted'>
                                <span className='hidden sm:inline'>Conviction casting</span>
                                <span className='sm:hidden'>Conviction</span>
                                <button
                                    type='button'
                                    role='switch'
                                    aria-checked={tray.convictionEnabled}
                                    aria-label='Use Conviction casting'
                                    onClick={() => tray.setConvictionEnabled(!tray.convictionEnabled)}
                                    className={[
                                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
                                        tray.convictionEnabled
                                            ? "border-purple-400/60 bg-purple-500/40"
                                            : "border-grimoire-border bg-grimoire-surface",
                                    ].join(" ")}
                                >
                                    <span
                                        className={[
                                            "inline-block h-3.5 w-3.5 rounded-full transition-transform",
                                            tray.convictionEnabled
                                                ? "translate-x-[18px] bg-purple-200"
                                                : "translate-x-[2px] bg-grimoire-text-faint",
                                        ].join(" ")}
                                    />
                                </button>
                            </label>

                            <button
                                type='button'
                                onClick={tray.close}
                                className='ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-grimoire-text-muted transition-colors hover:bg-grimoire-border/40 hover:text-grimoire-text-base'
                                aria-label='Minimize dice tray'
                            >
                                <ChevronDown size={18} />
                            </button>
                        </div>

                        {/* Tabs (Cast only when Conviction is on) */}
                        {tray.convictionEnabled && (
                            <div role='tablist' className='flex gap-1 px-3 pt-2 sm:px-4'>
                                {(
                                    [
                                        { id: "roll", label: "Roll", icon: Dices },
                                        { id: "cast", label: "Cast with Conviction", icon: Wand2 },
                                    ] as const
                                ).map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        role='tab'
                                        aria-selected={tray.tab === id}
                                        onClick={() => tray.setTab(id)}
                                        className={[
                                            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-rajdhani text-sm font-medium transition-colors",
                                            tray.tab === id
                                                ? "bg-grimoire-primary/15 text-grimoire-primary-light"
                                                : "text-grimoire-text-muted hover:text-grimoire-text-base",
                                        ].join(" ")}
                                    >
                                        <Icon size={14} />
                                        {id === "cast" ? (
                                            <>
                                                <span className='sm:hidden'>Cast</span>
                                                <span className='hidden sm:inline'>{label}</span>
                                            </>
                                        ) : (
                                            label
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Body */}
                        <div className='flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4'>
                            {tray.tab === "cast" ? <ConvictionCaster /> : <DiceRoller />}

                            {tray.history.length > 0 && (
                                <details className='group rounded-lg border border-grimoire-border/60'>
                                    <summary className='flex cursor-pointer items-center gap-1.5 px-3 py-2 font-rajdhani text-xs uppercase tracking-widest text-grimoire-text-faint'>
                                        <History size={12} /> History ({tray.history.length})
                                        <button
                                            type='button'
                                            onClick={(e) => {
                                                e.preventDefault()
                                                tray.clearHistory()
                                            }}
                                            className='ml-auto flex items-center gap-1 normal-case tracking-normal hover:text-grimoire-danger'
                                        >
                                            <Trash2 size={11} /> Clear
                                        </button>
                                    </summary>
                                    <ul className='divide-y divide-grimoire-border/40 px-3 pb-2'>
                                        {tray.history.map((h) => (
                                            <li key={h.id} className='flex items-start gap-3 py-1.5'>
                                                <div className='min-w-0 flex-1'>
                                                    <p className='font-rajdhani text-sm text-grimoire-text-base'>{h.label}</p>
                                                    <p className='break-words font-mono text-[11px] text-grimoire-text-faint'>{h.detail}</p>
                                                </div>
                                                <div className='text-right'>
                                                    <p className='font-mono text-sm font-bold text-grimoire-text-base'>{h.total}</p>
                                                    <p className='font-rajdhani text-[10px] text-grimoire-text-faint'>{timeFmt.format(h.at)}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                    </motion.section>
                ) : (
                    <motion.button
                        key='strip'
                        type='button'
                        onClick={tray.open}
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className='pointer-events-auto flex h-9 w-full max-w-2xl items-center justify-center gap-2 rounded-t-xl border border-b-0 border-grimoire-border bg-grimoire-surface/95 px-4 font-rajdhani text-sm text-grimoire-text-muted shadow-[0_-6px_24px_rgba(0,0,0,0.5)] backdrop-blur-md transition-colors hover:text-grimoire-text-base'
                        aria-label='Open dice tray'
                    >
                        <ChevronUp size={16} />
                        <Dices size={14} className='text-grimoire-primary-light' />
                        <span>Dice</span>
                        {last && (
                            <span className='ml-2 truncate text-xs text-grimoire-text-faint'>
                                {last.label}: <span className='font-mono text-grimoire-text-base'>{last.total}</span>
                            </span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    )
}
