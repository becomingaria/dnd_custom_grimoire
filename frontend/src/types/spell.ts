// ─── Spell School ─────────────────────────────────────────────────────────────
export type SpellSchool =
    | "Abjuration"
    | "Conjuration"
    | "Divination"
    | "Enchantment"
    | "Evocation"
    | "Illusion"
    | "Necromancy"
    | "Transmutation"

export const SPELL_SCHOOLS: SpellSchool[] = [
    "Abjuration",
    "Conjuration",
    "Divination",
    "Enchantment",
    "Evocation",
    "Illusion",
    "Necromancy",
    "Transmutation",
]

// ─── Spell Components ────────────────────────────────────────────────────────
export type SpellComponent = "V" | "S" | "M"

// ─── Damage Types ─────────────────────────────────────────────────────────────
export type DamageType =
    | "acid"
    | "bludgeoning"
    | "cold"
    | "fire"
    | "force"
    | "lightning"
    | "necrotic"
    | "piercing"
    | "poison"
    | "psychic"
    | "radiant"
    | "slashing"
    | "thunder"

// ─── D&D Classes ─────────────────────────────────────────────────────────────
export const DND_CLASSES = [
    "Artificer",
    "Barbarian",
    "Bard",
    "Cleric",
    "Druid",
    "Fighter",
    "Monk",
    "Paladin",
    "Ranger",
    "Rogue",
    "Sorcerer",
    "Warlock",
    "Wizard",
] as const

export type DndClass = (typeof DND_CLASSES)[number]

// ─── Changelog Entry ─────────────────────────────────────────────────────────
export interface ChangelogEntry {
    updatedBy: string
    updatedAt: string
}

// ─── Spell ───────────────────────────────────────────────────────────────────
export interface Spell {
    spellId: string
    name: string
    level: number // 0 = cantrip, 1–9
    school: SpellSchool
    castingTime: string
    range: string
    components: SpellComponent[]
    materialComponents?: string | null
    duration: string
    concentration: boolean
    ritual: boolean
    description: string
    higherLevels?: string | null
    classes: string[]
    isHomebrew: boolean
    source: string
    tags?: string[]
    damageType?: DamageType | null
    addedBy?: string
    createdBy?: string
    createdAt: string
    updatedAt: string
    changelog?: ChangelogEntry[]
}

// ─── Create / Update DTOs ─────────────────────────────────────────────────────
export type CreateSpellInput = Omit<
    Spell,
    "spellId" | "isHomebrew" | "createdBy" | "createdAt" | "updatedAt"
>

export type UpdateSpellInput = Partial<CreateSpellInput>

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const spellLevelLabel = (level: number): string =>
    level === 0 ? "Cantrip" : `Level ${level}`

export const schoolColorClass: Record<SpellSchool, string> = {
    Abjuration: "text-blue-400 border-blue-400/40 bg-blue-400/10",
    Conjuration: "text-purple-400 border-purple-400/40 bg-purple-400/10",
    Divination: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
    Enchantment: "text-pink-400 border-pink-400/40 bg-pink-400/10",
    Evocation: "text-red-400 border-red-400/40 bg-red-400/10",
    Illusion: "text-violet-400 border-violet-400/40 bg-violet-400/10",
    Necromancy: "text-green-400 border-green-400/40 bg-green-400/10",
    Transmutation: "text-amber-400 border-amber-400/40 bg-amber-400/10",
}

export const schoolGlowStyle: Record<SpellSchool, string> = {
    Abjuration: "0 0 20px rgba(59, 130, 246, 0.35)",
    Conjuration: "0 0 20px rgba(168, 85, 247, 0.35)",
    Divination: "0 0 20px rgba(6, 182, 212, 0.35)",
    Enchantment: "0 0 20px rgba(236, 72, 153, 0.35)",
    Evocation: "0 0 20px rgba(239, 68, 68, 0.35)",
    Illusion: "0 0 20px rgba(139, 92, 246, 0.35)",
    Necromancy: "0 0 20px rgba(34, 197, 94, 0.35)",
    Transmutation: "0 0 20px rgba(245, 158, 11, 0.35)",
}
