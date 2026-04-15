import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion } from "framer-motion"
import { Save, X } from "lucide-react"
import { SPELL_SCHOOLS, DND_CLASSES } from "@/types/spell"
import type { Spell, CreateSpellInput } from "@/types/spell"

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
    source: z.string().default("Homebrew"),
    damageType: z.string().nullable().optional(),
    tags: z.string().optional(), // comma-separated in form
})

type SpellFormData = z.infer<typeof spellSchema>

interface SpellFormProps {
    initial?: Partial<Spell>
    onSubmit: (data: CreateSpellInput) => Promise<void> | void
    onCancel?: () => void
    isLoading?: boolean
    existingSources?: string[]
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
    existingSources = [],
    isAdmin = false,
}: SpellFormProps) {
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
            source: initial?.sources?.join(", ") ?? "Homebrew",
            damageType: initial?.damageType ?? "",
            tags: initial?.tags?.join(", ") ?? "",
        },
    })

    const selectedComponents = watch("components") ?? []
    const selectedClasses = watch("classes") ?? []

    function toggleComponent(comp: "V" | "S" | "M") {
        const current = selectedComponents
        setValue(
            "components",
            current.includes(comp)
                ? current.filter((c) => c !== comp)
                : [...current, comp],
        )
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

    const handleFormSubmit = (data: SpellFormData) => {
        if (!isAdmin) {
            data.source = "Homebrew"
        } else {
            const newSources = data.source
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            const isNewSource = newSources.some(
                (src) => !existingSources.includes(src),
            )
            if (isNewSource) {
                const newOnes = newSources.filter(
                    (src) => !existingSources.includes(src),
                )
                const confirmed = window.confirm(
                    `"${newOnes.join(", ")}" would be the first spell(s) from this source — is that correct?`,
                )
                if (!confirmed) return
            }
        }

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
            sources: data.source
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            tags: data.tags
                ? data.tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                : [],
            damageType:
                (data.damageType as CreateSpellInput["damageType"]) ?? null,
        }
        void onSubmit(input)
    }

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className='space-y-5'>
            {/* Name + Level row */}
            <div className='grid grid-cols-3 gap-4'>
                <div className='col-span-2'>
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

            {/* Duration + Source */}
            <div className='grid grid-cols-2 gap-4'>
                <div>
                    <label className={labelClass}>Duration</label>
                    <input
                        className={fieldClass}
                        placeholder='Instantaneous'
                        {...register("duration")}
                    />
                </div>
                <div>
                    <label className={labelClass}>Source</label>
                    {isAdmin ? (
                        <>
                            <input
                                className={fieldClass}
                                placeholder="e.g. Player's Handbook"
                                list='source-suggestions'
                                {...register("source")}
                            />
                            {existingSources.length > 0 && (
                                <datalist id='source-suggestions'>
                                    {existingSources.map((s) => (
                                        <option key={s} value={s} />
                                    ))}
                                </datalist>
                            )}
                        </>
                    ) : (
                        <div className='flex items-center gap-2 rounded-lg border border-grimoire-border/40 bg-grimoire-surface/50 px-3 py-2.5'>
                            <span className='font-rajdhani text-sm text-grimoire-text-muted'>
                                Homebrew
                            </span>
                            <span className='ml-auto font-rajdhani text-[10px] uppercase tracking-widest text-grimoire-text-faint'>
                                locked
                            </span>
                        </div>
                    )}
                </div>
            </div>

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
                    <input
                        className={fieldClass}
                        placeholder='fire, cold, force…'
                        {...register("damageType")}
                    />
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
