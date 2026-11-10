import { motion } from "framer-motion"

interface DieFaceProps {
    sides: number
    value: number
    /** Shown dimmed and struck through (advantage loser, Dreamtime discard). */
    dropped?: boolean
    /** Highlighted as part of a Conviction double. */
    doubled?: boolean
    /** Stagger index for the roll-in animation. */
    index?: number
    size?: "sm" | "md"
}

/** One rolled die: value large, die type small underneath. */
export default function DieFace({
    sides,
    value,
    dropped,
    doubled,
    index = 0,
    size = "md",
}: DieFaceProps) {
    const isCrit = sides === 20 && !dropped && (value === 20 || value === 1)
    return (
        <motion.div
            initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{
                type: "spring",
                stiffness: 320,
                damping: 18,
                delay: Math.min(index, 12) * 0.035,
            }}
            className={[
                "flex flex-col items-center justify-center rounded-lg border font-mono leading-none",
                size === "sm" ? "h-9 w-9" : "h-12 w-12",
                dropped
                    ? "border-grimoire-border/50 bg-grimoire-surface/40 text-grimoire-text-faint line-through opacity-60"
                    : doubled
                      ? "border-grimoire-accent/60 bg-grimoire-accent/15 text-grimoire-accent-light"
                      : isCrit
                        ? value === 20
                            ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300"
                            : "border-grimoire-danger/60 bg-grimoire-danger/15 text-grimoire-danger"
                        : "border-grimoire-primary/40 bg-grimoire-primary/10 text-grimoire-text-base",
            ].join(" ")}
            title={`d${sides}: ${value}${doubled ? " (doubled)" : ""}${dropped ? " (not counted)" : ""}`}
        >
            <span className={size === "sm" ? "text-sm font-bold" : "text-lg font-bold"}>
                {value}
            </span>
            <span className='mt-0.5 text-[9px] text-grimoire-text-faint no-underline'>
                {doubled ? "×2" : `d${sides}`}
            </span>
        </motion.div>
    )
}
