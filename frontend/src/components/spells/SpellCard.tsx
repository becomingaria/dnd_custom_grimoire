import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Zap, Clock, Crosshair, Timer, Wand2 } from "lucide-react"
import type { Spell } from "@/types/spell"
import { spellLevelLabel, schoolGlowStyle } from "@/types/spell"
import SchoolBadge from "./SchoolBadge"

interface SpellCardProps {
    spell: Spell
    index?: number
    compact?: boolean
}

export default function SpellCard({
    spell,
    index = 0,
    compact = false,
}: SpellCardProps) {
    const navigate = useNavigate()

    return (
        <motion.article
            className='group relative cursor-pointer overflow-hidden rounded-xl border border-grimoire-border bg-grimoire-card'
            style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.35,
                delay: index * 0.05,
                ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={{
                scale: 1.025,
                borderColor: "rgba(124,58,237,0.5)",
                boxShadow: `0 8px 40px rgba(0,0,0,0.7), ${schoolGlowStyle[spell.school]}`,
            }}
            onClick={() => navigate(`/spells/${spell.spellId}`)}
        >
            {/* Sheen line at the top */}
            <div
                className='absolute inset-x-0 top-0 h-px opacity-50'
                style={{
                    background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
                }}
            />

            <div className='p-4'>
                {/* Header row */}
                <div className='mb-2 flex items-start justify-between gap-2'>
                    <div className='min-w-0 flex-1'>
                        <h3 className='truncate font-cinzel text-base font-semibold text-grimoire-text-base group-hover:text-grimoire-primary-light transition-colors'>
                            {spell.name}
                        </h3>
                        <p className='mt-0.5 font-rajdhani text-xs text-grimoire-text-muted'>
                            {spellLevelLabel(spell.level)}
                        </p>
                        {spell.addedBy && (
                            <p className='mt-0.5 font-rajdhani text-[11px] text-grimoire-text-faint'>
                                u/{spell.addedBy.split("@")[0]}
                            </p>
                        )}
                    </div>
                    <div className='flex flex-col items-end gap-1.5 shrink-0'>
                        <SchoolBadge school={spell.school} size='xs' />
                        {spell.isHomebrew && (
                            <span className='rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-rajdhani text-xs font-semibold text-amber-400'>
                                Homebrew
                            </span>
                        )}
                    </div>
                </div>

                {/* Description preview */}
                {!compact && (
                    <p className='mb-3 line-clamp-2 font-rajdhani text-sm leading-relaxed text-grimoire-text-muted'>
                        {spell.description}
                    </p>
                )}

                {/* Stats row */}
                <div className='flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-grimoire-text-faint'>
                    <span className='flex items-center gap-1'>
                        <Clock size={11} />
                        {spell.castingTime}
                    </span>
                    <span className='flex items-center gap-1'>
                        <Crosshair size={11} />
                        {spell.range}
                    </span>
                    <span className='flex items-center gap-1'>
                        <Timer size={11} />
                        {spell.duration}
                    </span>
                </div>

                {/* Badges row */}
                <div className='mt-2.5 flex flex-wrap items-center gap-1.5'>
                    <span className='flex items-center gap-1 rounded border border-grimoire-border/60 bg-grimoire-surface px-2 py-0.5 font-mono text-xs text-grimoire-text-muted'>
                        <Wand2 size={10} />
                        {spell.components.join(" ")}
                    </span>
                    {spell.concentration && (
                        <span className='rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-rajdhani text-xs font-semibold text-cyan-400'>
                            Conc.
                        </span>
                    )}
                    {spell.ritual && (
                        <span className='rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-rajdhani text-xs font-semibold text-emerald-400'>
                            Ritual
                        </span>
                    )}
                    {spell.damageType && (
                        <span className='flex items-center gap-1 rounded border border-grimoire-border/60 bg-grimoire-surface px-1.5 py-0.5 font-rajdhani text-xs capitalize text-grimoire-text-muted'>
                            <Zap size={10} />
                            {spell.damageType}
                        </span>
                    )}
                </div>
            </div>

            {/* Bottom accent line with school color */}
            <motion.div
                className='absolute inset-x-0 bottom-0 h-0.5'
                style={{
                    background: `linear-gradient(90deg, transparent, ${getSchoolColor(spell.school)}, transparent)`,
                }}
                initial={{ opacity: 0.3 }}
                whileHover={{ opacity: 1 }}
            />
        </motion.article>
    )
}

function getSchoolColor(school: Spell["school"]): string {
    const colors: Record<typeof school, string> = {
        Abjuration: "rgba(59,130,246,0.8)",
        Conjuration: "rgba(168,85,247,0.8)",
        Divination: "rgba(6,182,212,0.8)",
        Enchantment: "rgba(236,72,153,0.8)",
        Evocation: "rgba(239,68,68,0.8)",
        Illusion: "rgba(139,92,246,0.8)",
        Necromancy: "rgba(34,197,94,0.8)",
        Transmutation: "rgba(245,158,11,0.8)",
    }
    return colors[school]
}
