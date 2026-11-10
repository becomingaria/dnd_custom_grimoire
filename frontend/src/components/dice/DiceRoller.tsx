import { useState } from "react"
import { motion } from "framer-motion"
import { Dices, Minus, Plus, Sparkles, X } from "lucide-react"
import DieFace from "./DieFace"
import { useDiceTray } from "@/context/DiceTrayContext"
import { useConviction } from "@/hooks/useConviction"
import {
    DIE_SIDES,
    isSingleD20,
    poolNotation,
    rollPool,
    type Advantage,
    type DicePool,
    type DieSides,
    type PoolRoll,
} from "@/lib/dice"
import { ADJUST_BONUS, ADJUST_COST, canAdjustRoll } from "@/lib/conviction"

const MAX_PER_DIE = 50

export default function DiceRoller() {
    const { convictionEnabled, addHistory } = useDiceTray()
    const conviction = useConviction()
    const [pool, setPool] = useState<DicePool>({})
    const [modifier, setModifier] = useState(0)
    const [advantage, setAdvantage] = useState<Advantage>("normal")
    const [result, setResult] = useState<
        (PoolRoll & { adjusted?: boolean }) | null
    >(null)
    const [adjustError, setAdjustError] = useState<string | null>(null)

    const dieCount = DIE_SIDES.reduce((n, s) => n + (pool[s] ?? 0), 0)
    const singleD20 = isSingleD20(pool)

    function change(sides: DieSides, delta: number) {
        setPool((p) => {
            const next = Math.min(MAX_PER_DIE, Math.max(0, (p[sides] ?? 0) + delta))
            const copy = { ...p }
            if (next) copy[sides] = next
            else delete copy[sides]
            return copy
        })
    }

    function roll() {
        if (!dieCount) return
        const r = rollPool(pool, modifier, singleD20 ? advantage : "normal")
        setResult(r)
        addHistory({
            label:
                r.notation +
                (singleD20 && advantage !== "normal"
                    ? advantage === "advantage"
                        ? " (adv)"
                        : " (dis)"
                    : ""),
            detail: r.dice
                .map((d) => (d.dropped ? `(${d.value})` : String(d.value)))
                .join(", "),
            total: r.total,
        })
    }

    const hasD20 = !!result?.dice.some((d) => d.sides === 20 && !d.dropped)
    const canAdjust =
        convictionEnabled &&
        !!conviction.character &&
        hasD20 &&
        !result?.adjusted &&
        canAdjustRoll(conviction.current)

    async function adjust() {
        if (!result || !canAdjust) return
        try {
            await conviction.save(conviction.current - ADJUST_COST)
        } catch (err) {
            setAdjustError(
                `Couldn't spend Conviction: ${err instanceof Error ? err.message : "network error"}`,
            )
            return
        }
        setAdjustError(null)
        setResult({ ...result, total: result.total + ADJUST_BONUS, adjusted: true })
        addHistory({
            label: `Conviction +${ADJUST_BONUS}`,
            detail: `${result.notation}: ${result.total} → ${result.total + ADJUST_BONUS} (−${ADJUST_COST} Conviction)`,
            total: result.total + ADJUST_BONUS,
        })
    }

    return (
        <div className='space-y-4'>
            {/* Dice picker */}
            <div className='grid grid-cols-4 gap-2 sm:grid-cols-7'>
                {DIE_SIDES.map((sides) => {
                    const count = pool[sides] ?? 0
                    return (
                        <motion.button
                            key={sides}
                            type='button'
                            onClick={() => change(sides, 1)}
                            whileTap={{ scale: 0.92 }}
                            className={[
                                "relative flex h-12 items-center justify-center rounded-lg border font-cinzel text-sm font-bold transition-colors",
                                count
                                    ? "border-grimoire-primary/60 bg-grimoire-primary/15 text-grimoire-primary-light"
                                    : "border-grimoire-border bg-grimoire-surface text-grimoire-text-muted hover:border-grimoire-primary/40 hover:text-grimoire-text-base",
                            ].join(" ")}
                            aria-label={`Add a d${sides}`}
                        >
                            d{sides === 100 ? "%" : sides}
                            {count > 0 && (
                                <span className='absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-grimoire-primary px-1 font-mono text-[10px] text-white'>
                                    {count}
                                </span>
                            )}
                        </motion.button>
                    )
                })}
            </div>

            {/* Pool editor */}
            <div className='flex flex-wrap items-center gap-2'>
                {DIE_SIDES.filter((s) => pool[s]).map((sides) => (
                    <span
                        key={sides}
                        className='flex items-center gap-1 rounded-lg border border-grimoire-border bg-grimoire-surface px-1 py-0.5 font-mono text-sm text-grimoire-text-base'
                    >
                        <StepButton label={`One fewer d${sides}`} onClick={() => change(sides, -1)}>
                            <Minus size={12} />
                        </StepButton>
                        {pool[sides]}d{sides}
                        <StepButton label={`One more d${sides}`} onClick={() => change(sides, 1)}>
                            <Plus size={12} />
                        </StepButton>
                    </span>
                ))}

                <span className='flex items-center gap-1 rounded-lg border border-grimoire-border bg-grimoire-surface px-1 py-0.5 font-mono text-sm text-grimoire-text-base'>
                    <StepButton label='Decrease modifier' onClick={() => setModifier((m) => m - 1)}>
                        <Minus size={12} />
                    </StepButton>
                    <span className='min-w-10 text-center'>
                        {modifier >= 0 ? `+${modifier}` : modifier}
                    </span>
                    <StepButton label='Increase modifier' onClick={() => setModifier((m) => m + 1)}>
                        <Plus size={12} />
                    </StepButton>
                </span>

                {(dieCount > 0 || modifier !== 0) && (
                    <button
                        type='button'
                        onClick={() => {
                            setPool({})
                            setModifier(0)
                            setAdvantage("normal")
                        }}
                        className='flex items-center gap-1 rounded-lg px-2 py-1 font-rajdhani text-xs text-grimoire-text-faint hover:text-grimoire-text-base'
                    >
                        <X size={12} /> Clear
                    </button>
                )}
            </div>

            {singleD20 && (
                <div className='flex gap-1 rounded-lg border border-grimoire-border bg-grimoire-surface p-1 font-rajdhani text-xs'>
                    {(["disadvantage", "normal", "advantage"] as const).map((a) => (
                        <button
                            key={a}
                            type='button'
                            onClick={() => setAdvantage(a)}
                            className={[
                                "flex-1 rounded-md px-2 py-1 capitalize transition-colors",
                                advantage === a
                                    ? "bg-grimoire-primary/20 text-grimoire-primary-light"
                                    : "text-grimoire-text-muted hover:text-grimoire-text-base",
                            ].join(" ")}
                        >
                            {a}
                        </button>
                    ))}
                </div>
            )}

            <motion.button
                type='button'
                onClick={roll}
                disabled={!dieCount}
                whileTap={{ scale: 0.97 }}
                className='btn-primary flex w-full items-center justify-center gap-2 py-2.5'
            >
                <Dices size={16} />
                {dieCount
                    ? `Roll ${poolNotation(pool, modifier)}`
                    : "Tap dice to add them"}
            </motion.button>

            {/* Result */}
            {result && (
                <div
                    className='space-y-3 rounded-xl border border-grimoire-border bg-grimoire-surface/60 p-3'
                    aria-live='polite'
                >
                    <div className='flex items-baseline justify-between gap-3'>
                        <span className='font-rajdhani text-sm text-grimoire-text-muted'>
                            {result.notation}
                        </span>
                        <motion.span
                            key={`${result.total}-${result.adjusted}`}
                            initial={{ scale: 1.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className='font-cinzel text-4xl font-bold text-grimoire-text-base text-glow'
                        >
                            {result.total}
                        </motion.span>
                    </div>
                    <div className='flex flex-wrap gap-1.5'>
                        {result.dice.map((d, i) => (
                            <DieFace
                                key={i}
                                index={i}
                                sides={d.sides}
                                value={d.value}
                                dropped={d.dropped}
                                size={result.dice.length > 12 ? "sm" : "md"}
                            />
                        ))}
                    </div>
                    {result.modifier !== 0 && (
                        <p className='font-rajdhani text-xs text-grimoire-text-faint'>
                            Modifier {result.modifier > 0 ? "+" : ""}
                            {result.modifier}
                            {result.adjusted && ` · +${ADJUST_BONUS} Conviction`}
                        </p>
                    )}
                    {result.adjusted && result.modifier === 0 && (
                        <p className='font-rajdhani text-xs text-purple-300'>
                            +{ADJUST_BONUS} from Conviction
                        </p>
                    )}
                    {convictionEnabled && hasD20 && !result.adjusted && (
                        <button
                            type='button'
                            onClick={() => void adjust()}
                            disabled={!canAdjust || conviction.isSaving}
                            className='flex w-full items-center justify-center gap-2 rounded-lg border border-purple-400/40 bg-purple-500/10 py-2 font-rajdhani text-sm font-semibold text-purple-300 transition-colors hover:bg-purple-500/20 disabled:opacity-40'
                            title={
                                !conviction.character
                                    ? "Pick a character on the Cast tab first"
                                    : `Needs at least ${ADJUST_COST} Conviction`
                            }
                        >
                            <Sparkles size={14} />
                            Spend {ADJUST_COST} Conviction for +{ADJUST_BONUS}
                            {conviction.character &&
                                ` (${conviction.current} left)`}
                        </button>
                    )}
                    {adjustError && (
                        <p role='alert' className='font-rajdhani text-xs text-grimoire-danger'>
                            {adjustError}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

function StepButton({
    label,
    onClick,
    children,
}: {
    label: string
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            aria-label={label}
            className='flex h-6 w-6 items-center justify-center rounded text-grimoire-text-muted hover:bg-grimoire-border/40 hover:text-grimoire-text-base'
        >
            {children}
        </button>
    )
}
