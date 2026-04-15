import { Clock, Crosshair, Timer, Zap, RefreshCw } from "lucide-react"
import SchoolBadge from "@/components/spells/SchoolBadge"
import { spellLevelLabel, schoolGlowStyle } from "@/types/spell"
import type { Spell } from "@/types/spell"

interface SpellInfoPanelProps {
    spell: Spell
}

export default function SpellInfoPanel({ spell }: SpellInfoPanelProps) {
    return (
        <div
            className='rounded-xl border border-grimoire-border overflow-hidden'
            style={{ boxShadow: schoolGlowStyle[spell.school] }}
        >
            {/* Header */}
            <div className='border-b border-grimoire-border p-4 pb-4'>
                <h2 className='font-cinzel text-2xl font-bold text-grimoire-text-base'>
                    {spell.name}
                </h2>
                <p className='mt-1 font-rajdhani text-grimoire-text-muted flex items-center gap-1.5'>
                    {spellLevelLabel(spell.level)} ·{" "}
                    <SchoolBadge school={spell.school} size='sm' />
                </p>
                {spell.addedBy && (
                    <p className='mt-1 font-rajdhani text-xs text-grimoire-text-faint'>
                        Added by u/{spell.addedBy.split("@")[0]}
                        {spell.sources?.length
                            ? ` · ${spell.sources.join(", ")}`
                            : ""}
                    </p>
                )}

                {/* Quick stats */}
                <div className='mt-4 grid grid-cols-3 gap-2'>
                    {[
                        {
                            icon: Clock,
                            label: "Casting Time",
                            value: spell.castingTime,
                        },
                        { icon: Crosshair, label: "Range", value: spell.range },
                        {
                            icon: Timer,
                            label: "Duration",
                            value: spell.duration,
                        },
                    ].map(({ icon: Icon, label, value }) => (
                        <div
                            key={label}
                            className='rounded-lg border border-grimoire-border/60 bg-grimoire-surface/50 p-2.5 text-center'
                        >
                            <Icon
                                size={13}
                                className='mx-auto mb-1 text-grimoire-text-faint'
                            />
                            <p className='font-mono text-xs text-grimoire-text-base leading-snug break-words'>
                                {value}
                            </p>
                            <p className='font-rajdhani text-[9px] uppercase tracking-widest text-grimoire-text-faint mt-0.5'>
                                {label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Body */}
            <div className='space-y-4 p-4'>
                {/* Badges */}
                <div className='flex flex-wrap gap-1.5'>
                    {spell.components.map((c) => (
                        <span
                            key={c}
                            className='rounded border border-grimoire-border px-2 py-0.5 font-mono text-xs text-grimoire-text-muted'
                        >
                            {c}
                        </span>
                    ))}
                    {spell.concentration && (
                        <span className='flex items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-xs text-blue-400'>
                            <Zap size={10} /> Concentration
                        </span>
                    )}
                    {spell.ritual && (
                        <span className='flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-xs text-amber-400'>
                            <RefreshCw size={10} /> Ritual
                        </span>
                    )}
                    {spell.isHomebrew && (
                        <span className='rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-xs text-purple-400'>
                            Homebrew
                        </span>
                    )}
                </div>

                {/* Material */}
                {spell.materialComponents && (
                    <p className='font-rajdhani text-sm italic text-grimoire-text-faint'>
                        Materials: {spell.materialComponents}
                    </p>
                )}

                {/* Description */}
                <div>
                    <h3 className='mb-2 font-cinzel text-xs font-bold uppercase tracking-widest text-grimoire-text-faint'>
                        Description
                    </h3>
                    <p className='whitespace-pre-line font-rajdhani text-sm leading-relaxed text-grimoire-text-muted'>
                        {spell.description}
                    </p>
                </div>

                {/* At Higher Levels */}
                {spell.higherLevels && (
                    <div>
                        <h3 className='mb-2 font-cinzel text-xs font-bold uppercase tracking-widest text-grimoire-text-faint'>
                            At Higher Levels
                        </h3>
                        <p className='whitespace-pre-line font-rajdhani text-sm leading-relaxed text-grimoire-text-muted'>
                            {spell.higherLevels}
                        </p>
                    </div>
                )}

                {/* Classes */}
                {spell.classes && spell.classes.length > 0 && (
                    <div>
                        <h3 className='mb-2 font-cinzel text-xs font-bold uppercase tracking-widest text-grimoire-text-faint'>
                            Classes
                        </h3>
                        <div className='flex flex-wrap gap-1.5'>
                            {spell.classes.map((c) => (
                                <span
                                    key={c}
                                    className='rounded border border-grimoire-border/60 bg-grimoire-surface px-2 py-0.5 font-rajdhani text-sm text-grimoire-text-muted'
                                >
                                    {c}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tags */}
                {spell.tags && spell.tags.length > 0 && (
                    <div className='flex flex-wrap gap-1.5'>
                        {spell.tags.map((tag) => (
                            <span
                                key={tag}
                                className='rounded-full border border-grimoire-border/50 px-2.5 py-0.5 font-rajdhani text-xs text-grimoire-text-faint'
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Changelog */}
                {spell.changelog && spell.changelog.length > 0 && (
                    <div>
                        <h3 className='mb-2 font-cinzel text-xs font-bold uppercase tracking-widest text-grimoire-text-faint'>
                            Edit History
                        </h3>
                        <ul className='space-y-1'>
                            {[...spell.changelog].reverse().map((entry, i) => (
                                <li
                                    key={i}
                                    className='font-rajdhani text-xs text-grimoire-text-faint'
                                >
                                    u/{entry.updatedBy.split("@")[0]}{" "}
                                    <span className='text-grimoire-text-faint/60'>
                                        on{" "}
                                        {new Date(
                                            entry.updatedAt,
                                        ).toLocaleDateString(undefined, {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}
