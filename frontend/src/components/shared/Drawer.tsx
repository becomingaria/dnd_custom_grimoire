import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect } from "react"
import { createPortal } from "react-dom"

interface DrawerProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: ReactNode
    width?: string
    side?: "left" | "right"
}

export default function Drawer({
    isOpen,
    onClose,
    title,
    children,
    width = "w-full max-w-lg",
    side = "right",
}: DrawerProps) {
    // Close on Escape
    useEffect(() => {
        if (!isOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [isOpen, onClose])

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key='drawer-backdrop'
                        className='fixed inset-0 z-40 bg-grimoire-bg/70 backdrop-blur-sm'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.aside
                        key='drawer-panel'
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby={title ? "drawer-title" : undefined}
                        className={`fixed inset-y-0 ${side === "left" ? "left-0 border-r" : "right-0 border-l"} z-50 flex ${width} flex-col border-grimoire-border bg-grimoire-card`}
                        style={
                            side === "left"
                                ? {
                                      boxShadow:
                                          "8px 0 60px rgba(0,0,0,0.7), 2px 0 0 rgba(124,58,237,0.15)",
                                  }
                                : {
                                      boxShadow:
                                          "-8px 0 60px rgba(0,0,0,0.7), -2px 0 0 rgba(124,58,237,0.15)",
                                  }
                        }
                        initial={{ x: side === "left" ? "-100%" : "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: side === "left" ? "-100%" : "100%" }}
                        transition={{
                            type: "spring",
                            stiffness: 340,
                            damping: 34,
                        }}
                    >
                        {/* Header */}
                        <div className='flex shrink-0 items-center justify-between border-b border-grimoire-border px-6 py-4'>
                            {title && (
                                <h2
                                    id='drawer-title'
                                    className='font-cinzel text-lg font-semibold tracking-wide text-grimoire-text-base'
                                >
                                    {title}
                                </h2>
                            )}
                            <button
                                onClick={onClose}
                                className='ml-auto rounded-lg p-1.5 text-grimoire-text-muted transition-colors hover:bg-grimoire-border/40 hover:text-grimoire-text-base'
                                aria-label='Close'
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <div className='flex-1 overflow-y-auto p-6'>
                            {children}
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>,
        document.body,
    )
}
