// ─── Spellcasting Ability ────────────────────────────────────────────────────
export type SpellcastingAbility = "INT" | "WIS" | "CHA"

// ─── D&D Character Classes ───────────────────────────────────────────────────
export const CHARACTER_CLASSES = [
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

export type CharacterClass = (typeof CHARACTER_CLASSES)[number]

// ─── Character ───────────────────────────────────────────────────────────────
export interface Character {
    characterId: string
    userId: string
    name: string
    class: CharacterClass | string
    subclass?: string | null
    level: number // 1–20
    knownSpellIds: string[]
    preparedSpellIds: string[]
    spellNotes?: Record<string, string>
    spellcastingAbility: SpellcastingAbility
    spellSaveDC?: number | null
    spellAttackBonus?: number | null
    totalKnownSpells?: number | null
    totalSpellsPrepared?: number | null
    /** Conviction Score Maximum (defaults to 10 × level when unset). */
    totalConviction?: number | null
    /** Current Conviction Score; may be negative. Unset = full. */
    currentConviction?: number | null
    /** Failed the negative-Conviction d100: no Conviction casting until > 0. */
    convictionLockedOut?: boolean
    notes?: string
    createdAt: string
    updatedAt: string
}

// ─── Create / Update DTOs ─────────────────────────────────────────────────────
export type CreateCharacterInput = Omit<
    Character,
    "characterId" | "userId" | "createdAt" | "updatedAt"
>

export type UpdateCharacterInput = Partial<Omit<CreateCharacterInput, never>>

// ─── Helpers ─────────────────────────────────────────────────────────────────
export const spellcastingAbilityLabel: Record<SpellcastingAbility, string> = {
    INT: "Intelligence",
    WIS: "Wisdom",
    CHA: "Charisma",
}

export const classSpellcastingAbility: Partial<
    Record<string, SpellcastingAbility>
> = {
    Artificer: "INT",
    Bard: "CHA",
    Cleric: "WIS",
    Druid: "WIS",
    Paladin: "CHA",
    Ranger: "WIS",
    Sorcerer: "CHA",
    Warlock: "CHA",
    Wizard: "INT",
}
