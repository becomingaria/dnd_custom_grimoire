import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion } from "framer-motion"
import { Save, X } from "lucide-react"
import { SPELL_SCHOOLS, DND_CLASSES } from "@/types/spell"
import type { Spell, CreateSpellInput } from "@/types/spell"
import {
    SOURCES,
    HOMEBREW_SOURCE,
    DAMAGE_TYPES,
    normalizeSpell,
    validateSpell,
} from "@shared/spell-standard"

/** Published sources an admin can attribute a spell to (registry order). */
const PUBLISHED_SOURCES = Object.values(SOURCES).filter(
    (s) => s.abbr !== HOMEBREW_SOURCE,
)

const spellSchema = z.object({
    name: z.string().min(1, "Name is required"),
    level: z.coerce.number().min(0).max(9),
    school: z.enum(SPELL_SCHOOLS as [string, ...string[]]),
    castingTime: z.string().min(1, "Casting time is required"),
    range: z.string().min(1, "Range is required"),
    components: z
        .array(z.enum(["V", "S", "M"]))
        .min(1, "At least one component"),
    materialComponents: z.string().nullable().optional(),
    duration: z.string().min(1, "Duration is required"),
    concentration: z.boolean(),
    ritual: z.boolean(),
    description: z.string().min(1, "Description is required"),
    higherLevels: z.string().nullable().optional(),
    classes: z.array(z.string()).min(1, "At least one class"),
    sources: z.array(z.string()),
    shared: z.boolean(),
    damageType: z.string().nullable().optional(),
    tags: z.string().optional(), // comma-separated in form
})

type SpellFormData = z.infer<typeof spellSchema>

interface SpellFormProps {
    initial?: Partial<Spell>
    onSubmit: (data: CreateSpellInput) => Promise<void> | void
    onCancel?: () => void
    isLoading?: boolean
    /** Admins may attribute spells to published sources; others get Homebrew. */
    isAdmin?: boolean
}

const fieldClass =
    "w-full rounded-lg border border-grimoire-border bg-grimoire-surface py-2.5 px-3 font-rajdhani text-sm text-grimoire-text-base placeholder:text-grimoire-text-faint focus:border-grimoire-primary/50 focus:outline-none focus:ring-1 focus:ring-grimoire-primary/30"
const labelClass =
    "block font-rajdhani text-xs font-semibold uppercase tracking-widest text-grimoire-text-faint mb-1.5"
const errorClass = "mt-1 font-rajdhani text-xs text-grimoire-danger"

export default function SpellForm({
    initial,
    onSubmit,
    onCancel,
    isLoading,
    isAdmin = false,
}: SpellFormProps) {
    const [submitErrors, setSubmitErrors] = useState<string[]>([])
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<SpellFormData>({
        resolver: zodResolver(spellSchema),
        defaultValues: {
            name: initial?.name ?? "",
            level: initial?.level ?? 1,
            school: initial?.school ?? "Evocation",
            castingTime: initial?.castingTime ?? "1 action",
            range: initial?.range ?? "60 feet",
            components: (initial?.components as ("V" | "S" | "M")[]) ?? [
                "V",
                "S",
            ],
            materialComponents: initial?.materialComponents ?? "",
            duration: initial?.duration ?? "Instantaneous",
            concentration: initial?.concentration ?? false,
            ritual: initial?.ritual ?? false,
            description: initial?.description ?? "",
            higherLevels: initial?.higherLevels ?? "",
            classes: initial?.classes ?? [],
            sources: initial?.sources?.length
                ? initial.sources
                : [HOMEBREW_SOURCE],
            // Homebrew is private unless its author has explicitly shared it.
            shared: initial?.shared === true,
            damageType: initial?.damageType ?? "",
            tags: initial?.tags?.join(", ") ?? "",
        },
    })

    const selectedComponents = watch("components") ?? []
    const selectedClasses = watch("classes") ?? []
    const selectedSources = watch("sources") ?? []
    const isHomebrewSelection =
        !isAdmin || selectedSources.includes(HOMEBREW_SOURCE)

    function toggleComponent(comp: "V" | "S" | "M") {
        const current = selectedComponents
        setValue(
            "components",
            current.includes(comp)
                ? current.filter((c) => c !== comp)
                : [...current, comp],
        )
    }

    function toggleSource(abbr: string) {
        if (abbr === HOMEBREW_SOURCE) {
            setValue("sources", [HOMEBREW_SOURCE])
            return
        }
        const published = selectedSources.filter((s) => s !== HOMEBREW_SOURCE)
        const next = published.includes(abbr)
            ? published.filter((s) => s !== abbr)
            : [...published, abbr]
        setValue("sources", next.length ? next : [HOMEBREW_SOURCE])
    }

    function toggleClass(cls: string) {
        const current = selectedClasses
        setValue(
            "classes",
            current.includes(cls)
                ? current.filter((c) => c !== cls)
                : [...current, cls],
        )
    }

    const handleFormSubmit = async (data: SpellFormData) => {
        setSubmitErrors([])
        const input: CreateSpellInput = {
            name: data.name,
            level: data.level,
            school: data.school as CreateSpellInput["school"],
            castingTime: data.castingTime,
            range: data.range,
            components: data.components,
            materialComponents: data.materialComponents ?? null,
            duration: data.duration,
            concentration: data.concentration,
            ritual: data.ritual,
            description: data.description,
            higherLevels: data.higherLevels ?? null,
            classes: data.classes,
            sources: isAdmin ? data.sources : [HOMEBREW_SOURCE],
            ...(isHomebrewSelection ? { shared: data.shared } : {}),
            tags: data.tags
                ? data.tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                : [],
            damageType:
                (data.damageType as CreateSpellInput["damageType"]) || null,
        }

        // Same standard the API enforces — catch problems before the round trip.
        const blocking = validateSpell(
            normalizeSpell({
                ...input,
                isHomebrew: input.sources.includes(HOMEBREW_SOURCE),
                addedBy: initial?.addedBy ?? "you",
            }),
        ).filter((i) => i.severity === "error")
        if (blocking.length) {
            setSubmitErrors(blocking.map((i) => i.message))
            return
        }

        try {
            await onSubmit(input)
        } catch (err) {
            setSubmitErrors([
                err instanceof Error ? err.message : "Could not save spell",
            ])
        }
    }

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className='space-y-5'>
            {/* Name + Level row */}
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                <div className='sm:col-span-2'>
                    <label className={labelClass}>Spell Name</label>
                    <input
                        className={fieldClass}
                        placeholder='e.g. Arcane Bolt'
                        {...register("name")}
                    />
                    {errors.name && (
                        <p className={errorClass}>{errors.name.message}</p>
                    )}
                </div>
                <div>
                    <label className={labelClass}>Level</label>
                    <select className={fieldClass} {...register("level")}>
                        <option value={0}>Cantrip</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                            <option key={l} value={l}>
                                Level {l}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* School */}
            <div>
                <label className={labelClass}>School</label>
                <select className={fieldClass} {...register("school")}>
                    {SPELL_SCHOOLS.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>
            </div>

            {/* Casting time + Range */}
            <div className='grid grid-cols-2 gap-4'>
                <div>
                    <label className={labelClass}>Casting Time</label>
                    <input
                        className={fieldClass}
                        placeholder='1 action'
                        {...register("castingTime")}
                    />
                </div>
                <div>
                    <label className={labelClass}>Range</label>
                    <input
                        className={fieldClass}
                        placeholder='60 feet'
                        {...register("range")}
                    />
                </div>
            </div>

            {/* Duration */}
            <div>
                <div>
                    <label className={labelClass}>Duration</label>
                    <input
                        className={fieldClass}
                        placeholder='Instantaneous'
                        {...register("duration")}
                    />
                </div>
            </div>

            {/* Source / attribution */}
            <div>
                <label className={labelClass}>Source</label>
                {isAdmin ? (
                    <>
                        <div className='flex flex-wrap gap-1.5'>
                            {[...PUBLISHED_SOURCES, SOURCES[HOMEBREW_SOURCE]].map(
                                (src) => (
                                    <button
                                        key={src.abbr}
                                        type='button'
                                        title={`${src.title} — ${src.publisher}`}
                                        onClick={() => toggleSource(src.abbr)}
                                        className={[
                                            "rounded border px-2.5 py-1 font-rajdhani text-xs font-medium transition-colors",
                                            selectedSources.includes(src.abbr)
                                                ? "border-grimoire-primary/50 bg-grimoire-primary/15 text-grimoire-primary-light"
                                                : "border-grimoire-border/60 bg-grimoire-surface text-grimoire-text-muted hover:text-grimoire-text-base",
                                        ].join(" ")}
                                    >
                                        {src.abbr}
                                    </button>
                                ),
                            )}
                        </div>
                        <p className='mt-1.5 font-rajdhani text-xs text-grimoire-text-faint'>
                            {selectedSources
                                .map((a) => SOURCES[a]?.title ?? a)
                                .join(" · ")}
                            {" — "}missing a book? Add it to the source registry
                            first (docs/SPELL_STANDARD.md).
                        </p>
                    </>
                ) : (
                    <div className='flex items-center gap-2 rounded-lg border border-grimoire-border/40 bg-grimoire-surface/50 px-3 py-2.5'>
                        <span className='font-rajdhani text-sm text-grimoire-text-muted'>
                            Homebrew — credited to you
                        </span>
                        <span className='ml-auto font-rajdhani text-[10px] uppercase tracking-widest text-grimoire-text-faint'>
                            locked
                        </span>
                    </div>
                )}
            </div>

            {/* Sharing (homebrew only) */}
            {isHomebrewSelection && (
                <label className='flex cursor-pointer items-start gap-2.5 rounded-lg border border-grimoire-border/60 bg-grimoire-surface/40 px-3 py-2.5'>
                    <input
                        type='checkbox'
                        className='mt-0.5 h-4 w-4 rounded border-grimoire-border bg-grimoire-surface accent-grimoire-primary'
                        {...register("shared")}
                    />
                    <span>
                        <span className='block font-rajdhani text-sm font-medium text-grimoire-text-base'>
                            Share with other members
                        </span>
                        <span className='block font-rajdhani text-xs text-grimoire-text-faint'>
                            Off: only you (and admins) can see this spell.
                            Members who already added it to a character keep
                            it if you later make it private.
                        </span>
                    </span>
                </label>
            )}

            {/* Components */}
            <div>
                <label className={labelClass}>Components</label>
                <div className='flex gap-2'>
                    {(["V", "S", "M"] as const).map((c) => (
                        <button
                            key={c}
                            type='button'
                            onClick={() => toggleComponent(c)}
                            className={[
                                "rounded-lg border px-4 py-2 font-rajdhani text-sm font-semibold transition-colors",
                                selectedComponents.includes(c)
                                    ? "border-grimoire-primary/50 bg-grimoire-primary/15 text-grimoire-primary-light"
                                    : "border-grimoire-border bg-grimoire-surface text-grimoire-text-muted",
                            ].join(" ")}
                        >
                            {c}
                        </button>
                    ))}
                </div>
                {errors.components && (
                    <p className={errorClass}>{errors.components.message}</p>
                )}
            </div>

            {/* Material components */}
            {selectedComponents.includes("M") && (
                <div>
                    <label className={labelClass}>Material Components</label>
                    <input
                        className={fieldClass}
                        placeholder='e.g. a pinch of bat guano'
                        {...register("materialComponents")}
                    />
                </div>
            )}

            {/* Concentration + Ritual */}
            <div className='flex gap-4'>
                {(["concentration", "ritual"] as const).map((field) => (
                    <label
                        key={field}
                        className='flex cursor-pointer items-center gap-2.5'
                    >
                        <input
                            type='checkbox'
                            className='h-4 w-4 rounded border-grimoire-border bg-grimoire-surface accent-grimoire-primary'
                            {...register(field)}
                        />
                        <span className='font-rajdhani text-sm capitalize text-grimoire-text-muted'>
                            {field}
                        </span>
                    </label>
                ))}
            </div>

            {/* Description */}
            <div>
                <label className={labelClass}>Description</label>
                <textarea
                    className={`${fieldClass} min-h-[120px] resize-y`}
                    placeholder="Describe the spell's effects..."
                    {...register("description")}
                />
                {errors.description && (
                    <p className={errorClass}>{errors.description.message}</p>
                )}
            </div>

            {/* Higher levels */}
            <div>
                <label className={labelClass}>
                    At Higher Levels (optional)
                </label>
                <textarea
                    className={`${fieldClass} min-h-[60px] resize-y`}
                    placeholder='When cast at higher spell slots...'
                    {...register("higherLevels")}
                />
            </div>

            {/* Classes */}
            <div>
                <label className={labelClass}>Classes</label>
                <div className='flex flex-wrap gap-1.5'>
                    {DND_CLASSES.map((cls) => (
                        <button
                            key={cls}
                            type='button'
                            onClick={() => toggleClass(cls)}
                            className={[
                                "rounded border px-2.5 py-1 font-rajdhani text-xs font-medium transition-colors",
                                selectedClasses.includes(cls)
                                    ? "border-grimoire-primary/50 bg-grimoire-primary/15 text-grimoire-primary-light"
                                    : "border-grimoire-border/60 bg-grimoire-surface text-grimoire-text-muted hover:text-grimoire-text-base",
                            ].join(" ")}
                        >
                            {cls}
                        </button>
                    ))}
                </div>
                {errors.classes && (
                    <p className={errorClass}>{errors.classes.message}</p>
                )}
            </div>

            {/* Damage type + Tags */}
            <div className='grid grid-cols-2 gap-4'>
                <div>
                    <label className={labelClass}>Damage Type (optional)</label>
                    <select className={fieldClass} {...register("damageType")}>
                        <option value=''>None</option>
                        {DAMAGE_TYPES.map((t) => (
                            <option key={t} value={t} className='capitalize'>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Tags (comma-separated)</label>
                    <input
                        className={fieldClass}
                        placeholder='damage, aoe, fire'
                        {...register("tags")}
                    />
                </div>
            </div>

            {submitErrors.length > 0 && (
                <ul className='space-y-1 rounded-lg border border-grimoire-danger/30 bg-grimoire-danger/10 px-3 py-2'>
                    {submitErrors.map((e) => (
                        <li
                            key={e}
                            className='font-rajdhani text-sm text-grimoire-danger'
                        >
                            {e}
                        </li>
                    ))}
                </ul>
            )}

            {/* Actions */}
            <div className='flex items-center justify-end gap-3 border-t border-grimoire-border/40 pt-4'>
                {onCancel && (
                    <button
                        type='button'
                        onClick={onCancel}
                        className='flex items-center gap-2 rounded-lg border border-grimoire-border px-4 py-2.5 font-rajdhani text-sm font-medium text-grimoire-text-muted transition-colors hover:text-grimoire-text-base'
                    >
                        <X size={16} />
                        Cancel
                    </button>
                )}
                <motion.button
                    type='submit'
                    disabled={isLoading}
                    className='flex items-center gap-2 rounded-lg bg-grimoire-primary px-5 py-2.5 font-rajdhani text-sm font-semibold text-white transition-colors hover:bg-grimoire-primary/80 disabled:opacity-50'
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                >
                    <Save size={16} />
                    {isLoading ? "Saving…" : "Save Spell"}
                </motion.button>
            </div>
        </form>
    )
}
