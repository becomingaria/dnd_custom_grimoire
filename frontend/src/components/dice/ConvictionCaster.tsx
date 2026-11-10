import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
    AlertTriangle,
    Droplet,
    Moon,
    Pencil,
    RotateCcw,
    Sparkles,
    Sunrise,
    Wand2,
} from "lucide-react"
import DieFace from "./DieFace"
import { useDiceTray } from "@/context/DiceTrayContext"
import { useConviction } from "@/hooks/useConviction"
import {
    CASTER_TYPE_LABEL,
    METAMAGIC,
    afterRest,
    planCast,
    regainSlot,
    resolveCast,
    rollConviction,
    type CastOutcome,
    type CasterType,
    type ScoredRoll,
} from "@/lib/conviction"

interface CastResult {
    spellName: string
    plan: ReturnType<typeof planCast>
    roll: ScoredRoll
    outcome: CastOutcome
    bloodMagic: boolean
}

const fieldClass =
    "w-full rounded-lg border border-grimoire-border bg-grimoire-surface px-2.5 py-2 font-rajdhani text-sm text-grimoire-text-base focus:border-grimoire-primary/50 focus:outline-none"
const labelClass =
    "mb-1 block font-rajdhani text-[11px] font-semibold uppercase tracking-widest text-grimoire-text-faint"

export default function ConvictionCaster() {
    const { castRequest, characterId, setCharacterId, addHistory } = useDiceTray()
    const c = useConviction()

    const [spellName, setSpellName] = useState("")
    const [spellLevel, setSpellLevel] = useState(1)
    const [casterOverride, setCasterOverride] = useState<CasterType | "">("")
    const [notPrepared, setNotPrepared] = useState(false)
    const [notOnList, setNotOnList] = useState(false)
    const [metamagic, setMetamagic] = useState("")
    const [empowered, setEmpowered] = useState(false)
    const [extraDice, setExtraDice] = useState(0)
    const [dreamtime, setDreamtime] = useState(false)
    const [bloodMagic, setBloodMagic] = useState(false)
    const [result, setResult] = useState<CastResult | null>(null)
    const [regainLevel, setRegainLevel] = useState(1)
    const [notice, setNotice] = useState<string | null>(null)
    const [editingScore, setEditingScore] = useState<string | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)

    /** Saves the score; on failure shows why and returns false. */
    async function persist(next: number, opts?: { lockedOut?: boolean }) {
        setSaveError(null)
        try {
            await c.save(next, opts)
            return true
        } catch (err) {
            setSaveError(
                `Couldn't save Conviction (${err instanceof Error ? err.message : "network error"}). The roll above still stands — set the score by hand once you're back online.`,
            )
            return false
        }
    }

    // "Cast" buttons elsewhere in the app pre-fill this form.
    useEffect(() => {
        if (!castRequest) return
        setSpellName(castRequest.spellName ?? "")
        setSpellLevel(castRequest.spellLevel)
        setNotPrepared(false)
        setNotOnList(false)
        setMetamagic("")
        setEmpowered(false)
        setExtraDice(0)
        setResult(null)
    }, [castRequest])

    const casterType = casterOverride || c.casterType
    const plan = useMemo(
        () =>
            planCast({
                spellLevel,
                casterType,
                characterLevel: c.character?.level ?? 1,
                notPrepared,
                notOnSpellList: notOnList,
                metamagic: [metamagic, empowered ? "empowered" : ""].filter(Boolean),
                extraDice,
                bloodMagic,
            }),
        [spellLevel, casterType, c.character?.level, notPrepared, notOnList, metamagic, empowered, extraDice, bloodMagic],
    )

    const blockedByLockout = c.lockedOut && !bloodMagic

    async function cast() {
        if (!c.character || plan.count === 0 || blockedByLockout) return
        const roll = rollConviction(plan, dreamtime)
        const outcome = resolveCast(c.current, roll.total, { bloodMagic })
        setResult({ spellName: spellName.trim() || `Level ${spellLevel} spell`, plan, roll, outcome, bloodMagic })
        setNotice(null)

        if (!bloodMagic) {
            await persist(outcome.after, {
                lockedOut: outcome.negative?.lockedOut || c.lockedOut,
            })
        }
        const extra = [
            outcome.reachedZero && `lost ${outcome.reachedZero.hpLoss} HP`,
            outcome.negative?.lockedOut && "locked out",
            outcome.negative && `wild magic ${outcome.negative.wildMagic.roll}`,
        ].filter(Boolean)
        addHistory({
            label: `Cast ${spellName.trim() || `level ${spellLevel} spell`}`,
            detail: `${plan.count}d${plan.dieSides}: ${roll.dice.map((d) => (d.doubled ? `${d.value}×2` : d.discarded ? `(${d.value})` : d.value)).join(", ")}${bloodMagic ? " · Blood Magic (HP)" : ` · ${outcome.before} → ${outcome.after}`}${extra.length ? ` · ${extra.join(", ")}` : ""}`,
            total: roll.total,
        })
    }

    async function rest(kind: "long" | "short") {
        const next = afterRest(c.current, c.max)
        if (!(await persist(next))) return
        setNotice(`${kind === "long" ? "Long" : "Short"} rest: ${c.current} → ${next}`)
        addHistory({ label: `${kind === "long" ? "Long" : "Short"} rest`, detail: `Conviction ${c.current} → ${next}`, total: next })
    }

    async function regain() {
        const { roll, after } = regainSlot(c.current, c.max, regainLevel)
        if (!(await persist(after))) return
        setNotice(`Regained a level ${regainLevel} slot: rolled ${roll.total} → ${after}`)
        addHistory({ label: `Regain level ${regainLevel} slot`, detail: `${regainLevel}d6 = ${roll.total} · ${c.current} → ${after}`, total: `+${roll.total}` })
    }

    async function setScore() {
        const n = Number(editingScore)
        if (!Number.isFinite(n)) return
        if (await persist(Math.round(n))) setEditingScore(null)
    }

    // ── No character yet ─────────────────────────────────────────────────────
    if (c.characters.length === 0) {
        return (
            <p className='py-6 text-center font-rajdhani text-sm text-grimoire-text-muted'>
                Conviction is tracked per character.{" "}
                <Link to='/characters' className='text-grimoire-primary-light underline'>
                    Create a character
                </Link>{" "}
                to start casting.
            </p>
        )
    }

    const pct = c.max ? Math.max(0, Math.min(100, (c.current / c.max) * 100)) : 0

    return (
        <div className='space-y-4'>
            {/* Character + meter */}
            <div className='space-y-2'>
                <select
                    value={c.character?.characterId ?? ""}
                    onChange={(e) => setCharacterId(e.target.value || null)}
                    className={fieldClass}
                    aria-label='Character'
                >
                    {!characterId && !c.character && <option value=''>Choose a character…</option>}
                    {c.characters.map((ch) => (
                        <option key={ch.characterId} value={ch.characterId}>
                            {ch.name} — {ch.class} {ch.level}
                        </option>
                    ))}
                </select>

                {c.character && (
                    <div className='rounded-lg border border-grimoire-border bg-grimoire-surface/60 p-3'>
                        <div className='flex items-baseline justify-between gap-2'>
                            <span className='font-rajdhani text-xs uppercase tracking-widest text-grimoire-text-faint'>
                                Conviction
                            </span>
                            {editingScore === null ? (
                                <button
                                    type='button'
                                    onClick={() => setEditingScore(String(c.current))}
                                    className='group flex items-baseline gap-1.5 font-mono'
                                    title='Set the score by hand'
                                >
                                    <span className={`text-2xl font-bold ${c.current < 0 ? "text-grimoire-danger" : "text-purple-300"}`}>
                                        {c.current}
                                    </span>
                                    <span className='text-sm text-grimoire-text-faint'>/ {c.max}</span>
                                    <Pencil size={11} className='text-grimoire-text-faint opacity-0 group-hover:opacity-100' />
                                </button>
                            ) : (
                                <span className='flex items-center gap-1'>
                                    <input
                                        type='number'
                                        value={editingScore}
                                        onChange={(e) => setEditingScore(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && void setScore()}
                                        className='w-20 rounded border border-grimoire-border bg-grimoire-bg px-2 py-1 font-mono text-sm text-grimoire-text-base'
                                        autoFocus
                                        aria-label='Conviction score'
                                    />
                                    <button type='button' onClick={() => void setScore()} className='rounded px-2 py-1 font-rajdhani text-xs text-grimoire-primary-light'>
                                        Save
                                    </button>
                                </span>
                            )}
                        </div>
                        <div className='mt-2 h-2 overflow-hidden rounded-full bg-grimoire-border/60'>
                            <motion.div
                                className='h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-300'
                                animate={{ width: `${pct}%` }}
                                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                            />
                        </div>
                        {c.lockedOut && (
                            <p className='mt-2 flex items-start gap-1.5 font-rajdhani text-xs text-grimoire-danger'>
                                <AlertTriangle size={13} className='mt-0.5 shrink-0' />
                                Locked out: no Conviction casting until the score rises above 0.
                            </p>
                        )}
                        {!c.character.totalConviction && (
                            <p className='mt-1 font-rajdhani text-[11px] text-grimoire-text-faint'>
                                Maximum is 10 × level{casterType === "warlock" ? " (Warlocks cap at 100)" : ""}. Set “Total Conviction” on the character to override.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {c.character && (
                <>
                    {/* Cast form */}
                    <div className='grid grid-cols-3 gap-2'>
                        <div className='col-span-2'>
                            <label className={labelClass} htmlFor='cv-spell'>Spell</label>
                            <input id='cv-spell' value={spellName} onChange={(e) => setSpellName(e.target.value)} placeholder='e.g. Fireball' className={fieldClass} />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor='cv-level'>Level</label>
                            <select id='cv-level' value={spellLevel} onChange={(e) => setSpellLevel(Number(e.target.value))} className={fieldClass}>
                                <option value={0}>Cantrip</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass} htmlFor='cv-caster'>Caster type</label>
                        <select id='cv-caster' value={casterOverride} onChange={(e) => setCasterOverride(e.target.value as CasterType | "")} className={fieldClass}>
                            <option value=''>Auto — {CASTER_TYPE_LABEL[c.casterType]}</option>
                            {(Object.keys(CASTER_TYPE_LABEL) as CasterType[]).map((t) => (
                                <option key={t} value={t}>{CASTER_TYPE_LABEL[t]}</option>
                            ))}
                        </select>
                    </div>

                    <div className='flex flex-wrap gap-1.5'>
                        <Toggle on={notPrepared} onClick={() => setNotPrepared((v) => !v)}>Not prepared +1d6</Toggle>
                        <Toggle on={notOnList} onClick={() => setNotOnList((v) => !v)}>Not on my list +1d6</Toggle>
                        <Toggle on={dreamtime} onClick={() => setDreamtime((v) => !v)} icon={<Moon size={12} />}>Dreamtime</Toggle>
                        <Toggle on={bloodMagic} onClick={() => setBloodMagic((v) => !v)} icon={<Droplet size={12} />} danger>Blood Magic</Toggle>
                    </div>

                    <div className='grid grid-cols-3 gap-2'>
                        <div className='col-span-2'>
                            <label className={labelClass} htmlFor='cv-mm'>Metamagic</label>
                            <select id='cv-mm' value={metamagic} onChange={(e) => setMetamagic(e.target.value)} className={fieldClass}>
                                <option value=''>None</option>
                                {METAMAGIC.filter((m) => !m.stacks).map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} (+{m.dice(plan.castLevel)}d6)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass} htmlFor='cv-extra'>Extra d6</label>
                            <input id='cv-extra' type='number' min={0} max={40} value={extraDice} onChange={(e) => setExtraDice(Math.max(0, Math.min(40, Number(e.target.value) || 0)))} className={fieldClass} />
                        </div>
                    </div>
                    <div className='flex flex-wrap gap-1.5'>
                        <Toggle on={empowered} onClick={() => setEmpowered((v) => !v)}>Empowered Spell +1d6</Toggle>
                    </div>
                    {metamagic && (
                        <p className='font-rajdhani text-xs text-grimoire-text-faint'>
                            {METAMAGIC.find((m) => m.id === metamagic)?.summary}
                        </p>
                    )}

                    {/* Plan + cast */}
                    <div className='rounded-lg border border-grimoire-border/60 bg-grimoire-surface/40 px-3 py-2 font-rajdhani text-sm text-grimoire-text-muted'>
                        {plan.count === 0 ? (
                            "Cantrips don't cost Conviction."
                        ) : (
                            <>
                                Roll <span className='font-mono text-grimoire-text-base'>{plan.count}d{plan.dieSides}</span>
                                {plan.doubles ? " · doubles count" : " · no doubles below level 2"}
                                {bloodMagic && " · paid in hit points"}
                                {dreamtime && " · 1s and 2s discarded"}
                                <span className='block text-xs text-grimoire-text-faint'>{plan.breakdown.join(" · ")}</span>
                            </>
                        )}
                    </div>

                    <motion.button
                        type='button'
                        onClick={() => void cast()}
                        disabled={plan.count === 0 || blockedByLockout || c.isSaving}
                        whileTap={{ scale: 0.97 }}
                        className='flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-700 to-grimoire-primary py-2.5 font-rajdhani font-semibold text-white transition-opacity disabled:opacity-40'
                    >
                        <Wand2 size={16} />
                        {blockedByLockout ? "Locked out" : `Cast${spellName.trim() ? ` ${spellName.trim()}` : ""}`}
                    </motion.button>

                    {result && <CastResultCard result={result} />}

                    {/* Recovery */}
                    <div className='flex flex-wrap items-center gap-1.5 border-t border-grimoire-border/60 pt-3'>
                        <ActionChip onClick={() => void rest("long")} icon={<Sunrise size={12} />}>Long rest</ActionChip>
                        {casterType === "warlock" && (
                            <ActionChip onClick={() => void rest("short")} icon={<RotateCcw size={12} />}>Short rest</ActionChip>
                        )}
                        <span className='flex items-center gap-1'>
                            <ActionChip onClick={() => void regain()} icon={<Sparkles size={12} />}>Regain slot</ActionChip>
                            <select value={regainLevel} onChange={(e) => setRegainLevel(Number(e.target.value))} className='rounded border border-grimoire-border bg-grimoire-surface px-1.5 py-1 font-rajdhani text-xs text-grimoire-text-base' aria-label='Slot level to regain'>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                                    <option key={l} value={l}>Lv {l}</option>
                                ))}
                            </select>
                        </span>
                    </div>
                    {notice && <p className='font-rajdhani text-xs text-emerald-400'>{notice}</p>}
                    {saveError && (
                        <p role='alert' className='rounded-lg border border-grimoire-danger/30 bg-grimoire-danger/10 px-3 py-2 font-rajdhani text-xs text-grimoire-danger'>
                            {saveError}
                        </p>
                    )}
                </>
            )}
        </div>
    )
}

function CastResultCard({ result }: { result: CastResult }) {
    const { roll, outcome, plan } = result
    return (
        <div className='space-y-3 rounded-xl border border-purple-400/30 bg-purple-500/5 p-3' aria-live='polite'>
            <div className='flex items-baseline justify-between gap-3'>
                <span className='font-rajdhani text-sm text-grimoire-text-muted'>
                    {result.spellName} · {plan.count}d{plan.dieSides}
                    {roll.pairs > 0 && ` · ${roll.pairs} double${roll.pairs > 1 ? "s" : ""}!`}
                </span>
                <span className='font-cinzel text-3xl font-bold text-purple-200'>−{roll.total}</span>
            </div>
            <div className='flex flex-wrap gap-1.5'>
                {roll.dice.map((d, i) => (
                    <DieFace key={i} index={i} sides={plan.dieSides} value={d.value} doubled={d.doubled} dropped={d.discarded} size={roll.dice.length > 12 ? "sm" : "md"} />
                ))}
            </div>
            <p className='font-rajdhani text-sm text-grimoire-text-base'>
                {result.bloodMagic ? (
                    <>Lose <strong>{outcome.hpCost} HP</strong> after the spell takes effect. Conviction unchanged.</>
                ) : (
                    <>Conviction {outcome.before} → <strong className={outcome.after < 0 ? "text-grimoire-danger" : ""}>{outcome.after}</strong></>
                )}
            </p>

            {outcome.reachedZero && (
                <Consequence title='Reached 0 Conviction'>
                    Reduce your current hit points by <strong>{outcome.reachedZero.hpLoss}</strong> (rolled 1d10), to a minimum of 1.
                </Consequence>
            )}
            {outcome.negative && (
                <>
                    <Consequence title={`Negative Conviction — d100: ${outcome.negative.d100}`}>
                        {outcome.negative.lockedOut
                            ? `${outcome.negative.d100} ≤ ${-outcome.after}: you can cast no more Conviction spells until your score rises above 0.`
                            : `${outcome.negative.d100} > ${-outcome.after}: you can keep casting — for now.`}
                    </Consequence>
                    <Consequence title={`Wild Magic — d20: ${outcome.negative.wildMagic.roll}`} severe>
                        {outcome.negative.wildMagic.effect}
                    </Consequence>
                </>
            )}
        </div>
    )
}

function Consequence({ title, severe, children }: { title: string; severe?: boolean; children: React.ReactNode }) {
    return (
        <div className={`rounded-lg border px-3 py-2 ${severe ? "border-grimoire-danger/40 bg-grimoire-danger/10" : "border-amber-500/40 bg-amber-500/10"}`}>
            <p className={`flex items-center gap-1.5 font-rajdhani text-xs font-semibold uppercase tracking-wider ${severe ? "text-grimoire-danger" : "text-amber-300"}`}>
                <AlertTriangle size={12} /> {title}
            </p>
            <p className='mt-0.5 font-rajdhani text-sm text-grimoire-text-base'>{children}</p>
        </div>
    )
}

function Toggle({ on, onClick, icon, danger, children }: { on: boolean; onClick: () => void; icon?: React.ReactNode; danger?: boolean; children: React.ReactNode }) {
    return (
        <button
            type='button'
            role='switch'
            aria-checked={on}
            onClick={onClick}
            className={[
                "flex items-center gap-1 rounded border px-2.5 py-1 font-rajdhani text-xs font-medium transition-colors",
                on
                    ? danger
                        ? "border-grimoire-danger/50 bg-grimoire-danger/15 text-grimoire-danger"
                        : "border-grimoire-primary/50 bg-grimoire-primary/15 text-grimoire-primary-light"
                    : "border-grimoire-border/60 bg-grimoire-surface text-grimoire-text-muted hover:text-grimoire-text-base",
            ].join(" ")}
        >
            {icon}
            {children}
        </button>
    )
}

function ActionChip({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <button type='button' onClick={onClick} className='flex items-center gap-1 rounded-lg border border-grimoire-border px-2.5 py-1 font-rajdhani text-xs text-grimoire-text-muted transition-colors hover:border-grimoire-primary/40 hover:text-grimoire-text-base'>
            {icon}
            {children}
        </button>
    )
}
