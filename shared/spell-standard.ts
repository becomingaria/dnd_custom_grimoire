/**
 * spell-standard.ts — the single source of truth for what a Grimoire spell
 * must look like.
 *
 * Imported by:
 *   • frontend  (SpellForm validation, source display, admin audit tab)
 *   • backend   (spell create/update Lambdas normalize + validate every write)
 *   • scripts   (audit-spells / fix-spell-data)
 *
 * The human-readable version of these rules lives in docs/SPELL_STANDARD.md.
 * If you change a rule here, update that document too.
 *
 * This file must stay dependency-free so both the Vite (ESM) and the
 * Lambda/ts-node (CommonJS) builds can import it.
 */

// ─── Enumerations ─────────────────────────────────────────────────────────────

export const SPELL_SCHOOLS = [
    "Abjuration",
    "Conjuration",
    "Divination",
    "Enchantment",
    "Evocation",
    "Illusion",
    "Necromancy",
    "Transmutation",
] as const
export type SpellSchool = (typeof SPELL_SCHOOLS)[number]

/** Classes that can appear on a spell's class list. */
export const SPELL_CLASSES = [
    "Artificer",
    "Bard",
    "Cleric",
    "Druid",
    "Paladin",
    "Ranger",
    "Sorcerer",
    "Warlock",
    "Wizard",
] as const
export type SpellClass = (typeof SPELL_CLASSES)[number]

export const SPELL_COMPONENTS = ["V", "S", "M"] as const
export type SpellComponent = (typeof SPELL_COMPONENTS)[number]

export const DAMAGE_TYPES = [
    "acid",
    "bludgeoning",
    "cold",
    "fire",
    "force",
    "lightning",
    "necrotic",
    "piercing",
    "poison",
    "psychic",
    "radiant",
    "slashing",
    "thunder",
] as const
export type DamageType = (typeof DAMAGE_TYPES)[number]

// ─── Source registry ──────────────────────────────────────────────────────────
//
// Every value in a spell's `sources` array MUST be a key of SOURCES.
// To add a new book: add an entry here (with full attribution details),
// then seed/create spells that reference its key. See docs/SPELL_STANDARD.md.

export type SourceKind =
    /** Openly licensed rules text (e.g. SRD 5.1 under CC-BY-4.0). */
    | "srd"
    /** Published by Wizards of the Coast, not openly licensed. */
    | "official"
    /** Published by someone other than WotC. */
    | "third-party"
    /** An original sourcebook written for the Custom Grimoire. */
    | "original"
    /** Written by a Grimoire user. */
    | "homebrew"

export interface SourceInfo {
    /** Short key stored on spells, e.g. "XGtE". */
    abbr: string
    /** Full published title. */
    title: string
    /** Publisher or author. */
    publisher: string
    kind: SourceKind
    year?: number
    url?: string
    /** SPDX licence identifier, when the text is openly licensed. */
    license?: string
    /**
     * Set when attribution details are incomplete. The audit reports every
     * spell from this source as a warning until it is resolved.
     */
    needsInfo?: string
}

export const HOMEBREW_SOURCE = "Homebrew"
export const SRD_SOURCE = "SRD 5.1"

export const SOURCES: Record<string, SourceInfo> = {
    [SRD_SOURCE]: {
        abbr: SRD_SOURCE,
        title: "System Reference Document 5.1",
        publisher: "Wizards of the Coast",
        kind: "srd",
        year: 2016,
        url: "https://dnd.wizards.com/resources/systems-reference-document",
        license: "CC-BY-4.0",
    },
    PHB: {
        abbr: "PHB",
        title: "Player's Handbook (2014)",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2014,
    },
    EEPC: {
        abbr: "EEPC",
        title: "Elemental Evil Player's Companion",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2015,
    },
    SCAG: {
        abbr: "SCAG",
        title: "Sword Coast Adventurer's Guide",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2015,
    },
    XGtE: {
        abbr: "XGtE",
        title: "Xanathar's Guide to Everything",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2017,
    },
    LLoK: {
        abbr: "LLoK",
        title: "Lost Laboratory of Kwalish",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2018,
    },
    GGtR: {
        abbr: "GGtR",
        title: "Guildmasters' Guide to Ravnica",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2018,
    },
    AI: {
        abbr: "AI",
        title: "Acquisitions Incorporated",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2019,
    },
    EGtW: {
        abbr: "EGtW",
        title: "Explorer's Guide to Wildemount",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2020,
    },
    TCoE: {
        abbr: "TCoE",
        title: "Tasha's Cauldron of Everything",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2020,
    },
    ROtF: {
        abbr: "ROtF",
        title: "Icewind Dale: Rime of the Frostmaiden",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2020,
    },
    FToD: {
        abbr: "FToD",
        title: "Fizban's Treasury of Dragons",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2021,
    },
    SCoC: {
        abbr: "SCoC",
        title: "Strixhaven: A Curriculum of Chaos",
        publisher: "Wizards of the Coast",
        kind: "official",
        year: 2021,
    },
    AToW: {
        abbr: "AToW",
        title: "Az Tome of Witchcraft",
        publisher: "Custom Grimoire",
        kind: "original",
    },
    ItWaW: {
        abbr: "ItWaW",
        title: "Magic of the Wyrd",
        publisher: "Unknown",
        kind: "third-party",
        needsInfo: "Author unknown for now. Update the publisher when found.",
    },
    [HOMEBREW_SOURCE]: {
        abbr: HOMEBREW_SOURCE,
        title: "Homebrew",
        publisher: "Grimoire community",
        kind: "homebrew",
    },
}

/** Legacy or long-form labels that should be rewritten to a registry key. */
export const SOURCE_ALIASES: Record<string, string> = {
    EE: "EEPC",
    "Elemental Evil": "EEPC",
    "Player's Handbook": "PHB",
    "Acquisitions Inc.": "AI",
    "Explorer's Guide to Wildemount": "EGtW",
    "Fizban's Treasury of Dragons": "FToD",
    "Guildmaster's Guide to Ravnica": "GGtR",
    "Icewind Dale - Rime of the Frostmaiden": "ROtF",
    "Lost Laboratory of Kwalish": "LLoK",
    Strixhaven: "SCoC",
    "Xanathar's Guide to Everything": "XGtE",
    "Tasha's Cauldron of Everything": "TCoE",
    "Sword Coast Adventurer's Guide": "SCAG",
}

export function getSourceInfo(abbr: string): SourceInfo | undefined {
    return SOURCES[abbr]
}

/** "Xanathar's Guide to Everything (XGtE)"; falls back to the raw label. */
export function describeSource(abbr: string): string {
    const info = SOURCES[abbr]
    if (!info) return abbr
    return info.title === abbr ? abbr : `${info.title} (${abbr})`
}

/** Required attribution notice for SRD 5.1 content (CC-BY-4.0 §3(a)). */
export const SRD_ATTRIBUTION_NOTICE =
    "This work includes material taken from the System Reference Document 5.1 " +
    '("SRD 5.1") by Wizards of the Coast LLC and available at ' +
    "https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 " +
    "is licensed under the Creative Commons Attribution 4.0 International " +
    "License available at https://creativecommons.org/licenses/by/4.0/legalcode."

// ─── Spell shape ──────────────────────────────────────────────────────────────

/** The fields the standard governs. Extra fields pass through untouched. */
export interface StandardSpell {
    name: string
    level: number
    school: string
    castingTime: string
    range: string
    components: string[]
    materialComponents?: string | null
    duration: string
    concentration: boolean
    ritual: boolean
    description: string
    higherLevels?: string | null
    classes: string[]
    sources: string[]
    isHomebrew?: boolean
    addedBy?: string | null
    tags?: string[]
    damageType?: string | null
}

// ─── Normalization ────────────────────────────────────────────────────────────
//
// normalizeSpell() rewrites purely cosmetic deviations into the house style.
// It never changes meaning, so it is safe to apply on every write.

const MINOR_WORDS = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "the",
    "to",
    "upon",
    "via",
    "with",
    "without",
])

const INVISIBLE_CHARS = /[​-‏⁠﻿]/g
/** `*[remove curse](../remove-curse/ "remove curse (lvl 3)")*` → `remove curse` */
const MARKDOWN_LINK = /\*?\[([^\]]+)\]\([^)]*\)\*?/g

function cleanText(value: string): string {
    return value
        .replace(INVISIBLE_CHARS, "")
        .replace(MARKDOWN_LINK, "$1")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function cleanLine(value: string): string {
    return cleanText(value).replace(/\s+/g, " ")
}

export function titleCaseSpellName(raw: string): string {
    const words = cleanLine(raw).split(" ")
    return words
        .map((word, i) => {
            const lower = word.toLowerCase()
            if (i > 0 && MINOR_WORDS.has(lower)) return lower
            // Capitalize each hyphen/slash segment ("Green-Flame", "Antipathy/Sympathy")
            return word.replace(
                /(^|[-/(])([a-z])/g,
                (_m, sep: string, ch: string) => sep + ch.toUpperCase(),
            )
        })
        .join(" ")
}

function normalizeCastingTime(raw: string): string {
    const v = cleanLine(raw)
    // "1 Action" → "1 action", "1 Bonus Action" → "1 bonus action"
    return v.replace(
        /^(\d+)\s+(bonus action|action|reaction|minutes?|hours?)\b/i,
        (_m, n: string, unit: string) => `${n} ${unit.toLowerCase()}`,
    )
}

function normalizeRange(raw: string): string {
    let v = cleanLine(raw)
    // "60 ft." / "60 ft" → "60 feet"  ("1 ft." → "1 foot")
    v = v.replace(/\b(\d+)\s*ft\.?(?=[\s),]|$)/gi, (_m, n: string) =>
        n === "1" ? "1 foot" : `${n} feet`,
    )
    // Balance a missing closing parenthesis: "Self (30-foot radius" → "…)"
    const opens = (v.match(/\(/g) ?? []).length
    const closes = (v.match(/\)/g) ?? []).length
    if (opens > closes) v += ")".repeat(opens - closes)
    return v
}

function normalizeDuration(raw: string, concentration: boolean): string {
    let v = cleanLine(raw)
    if (concentration && /^up to\b/i.test(v)) {
        v = `Concentration, ${v.charAt(0).toLowerCase()}${v.slice(1)}`
    }
    v = v.replace(/^concentration,\s*/i, "Concentration, ")
    return v
}

const CLASS_LOOKUP = new Map(
    SPELL_CLASSES.map((c) => [c.toLowerCase(), c as string]),
)

/** Splits "Warlock and Wizard", maps case, drops non-classes, sorts. */
export function normalizeClasses(raw: string[]): string[] {
    const out = new Set<string>()
    for (const entry of raw) {
        for (const part of entry.split(/,|\band\b|\//i)) {
            const match = CLASS_LOOKUP.get(part.trim().toLowerCase())
            if (match) out.add(match)
        }
    }
    return [...out].sort()
}

export function normalizeSources(raw: string[]): string[] {
    const out = new Set<string>()
    for (const s of raw) {
        const trimmed = s.trim()
        if (!trimmed) continue
        out.add(SOURCE_ALIASES[trimmed] ?? trimmed)
    }
    return [...out].sort((a, b) => a.localeCompare(b))
}

function emptyToNull(v: string | null | undefined): string | null {
    if (v == null) return null
    const cleaned = cleanText(v)
    return cleaned ? cleaned : null
}

export function normalizeSpell<T extends StandardSpell>(spell: T): T {
    const concentration =
        Boolean(spell.concentration) ||
        /^concentration\b/i.test(spell.duration?.trim() ?? "")
    const components = SPELL_COMPONENTS.filter((c) =>
        (spell.components ?? []).includes(c),
    )
    const material = components.includes("M")
        ? emptyToNull(spell.materialComponents)
        : null

    return {
        ...spell,
        name: titleCaseSpellName(spell.name ?? ""),
        castingTime: normalizeCastingTime(spell.castingTime ?? ""),
        range: normalizeRange(spell.range ?? ""),
        duration: normalizeDuration(spell.duration ?? "", concentration),
        concentration,
        ritual: Boolean(spell.ritual),
        components,
        materialComponents: material,
        description: cleanText(spell.description ?? ""),
        higherLevels: emptyToNull(spell.higherLevels),
        classes: normalizeClasses(spell.classes ?? []),
        sources: normalizeSources(spell.sources ?? []),
        tags: [
            ...new Set(
                (spell.tags ?? [])
                    .map((t) => t.trim().toLowerCase())
                    .filter(Boolean),
            ),
        ],
        damageType: spell.damageType ? spell.damageType : null,
    }
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type IssueSeverity = "error" | "warning"

export interface SpellIssue {
    field: keyof StandardSpell | "attribution"
    severity: IssueSeverity
    message: string
}

const NORMALIZED_FIELDS: (keyof StandardSpell)[] = [
    "name",
    "castingTime",
    "range",
    "duration",
    "concentration",
    "components",
    "materialComponents",
    "description",
    "higherLevels",
    "classes",
    "sources",
]

/**
 * Returns every way `spell` deviates from the standard.
 *   • errors   — the spell must not be saved as-is
 *   • warnings — style drift (fixable with normalizeSpell) or incomplete
 *                attribution that an admin should resolve
 */
export function validateSpell(spell: StandardSpell): SpellIssue[] {
    const issues: SpellIssue[] = []
    const err = (field: SpellIssue["field"], message: string) =>
        issues.push({ field, severity: "error", message })
    const warn = (field: SpellIssue["field"], message: string) =>
        issues.push({ field, severity: "warning", message })

    // ── Required fields ──────────────────────────────────────────────────────
    if (!spell.name?.trim()) err("name", "Name is required")
    else if (spell.name.trim().length > 80)
        err("name", "Name must be 80 characters or fewer")

    if (!Number.isInteger(spell.level) || spell.level < 0 || spell.level > 9)
        err("level", "Level must be an integer from 0 (cantrip) to 9")

    if (!SPELL_SCHOOLS.includes(spell.school as SpellSchool))
        err("school", `School must be one of: ${SPELL_SCHOOLS.join(", ")}`)

    if (!spell.castingTime?.trim())
        err("castingTime", "Casting time is required")
    if (!spell.range?.trim()) err("range", "Range is required")
    if (!spell.duration?.trim()) err("duration", "Duration is required")
    if (!spell.description?.trim())
        err("description", "Description is required")

    // ── Components ───────────────────────────────────────────────────────────
    const comps = spell.components ?? []
    if (comps.length === 0)
        err("components", "At least one component (V, S, M) is required")
    const badComps = comps.filter(
        (c) => !SPELL_COMPONENTS.includes(c as SpellComponent),
    )
    if (badComps.length)
        err("components", `Unknown component(s): ${badComps.join(", ")}`)
    if (comps.includes("M") && !spell.materialComponents?.trim())
        err(
            "materialComponents",
            "Material component text is required when M is listed",
        )

    // ── Classes ──────────────────────────────────────────────────────────────
    const classes = spell.classes ?? []
    if (classes.length === 0)
        err("classes", "At least one class is required")
    const badClasses = classes.filter(
        (c) => !SPELL_CLASSES.includes(c as SpellClass),
    )
    if (badClasses.length)
        err("classes", `Not a spellcasting class: ${badClasses.join(", ")}`)

    // ── Damage type ──────────────────────────────────────────────────────────
    if (
        spell.damageType &&
        !DAMAGE_TYPES.includes(spell.damageType as DamageType)
    )
        err("damageType", `Unknown damage type: ${spell.damageType}`)

    // ── Attribution ──────────────────────────────────────────────────────────
    const sources = spell.sources ?? []
    if (sources.length === 0) {
        err("sources", "Every spell needs at least one source")
    }
    const unknown = sources.filter((s) => !SOURCES[s])
    if (unknown.length) {
        err(
            "sources",
            `Unregistered source(s): ${unknown.join(", ")} — add them to the source registry first`,
        )
    }
    const homebrew = sources.includes(HOMEBREW_SOURCE)
    if (homebrew && sources.length > 1)
        err("sources", "Homebrew cannot be combined with published sources")
    if (spell.isHomebrew !== undefined && spell.isHomebrew !== homebrew)
        err(
            "sources",
            homebrew
                ? 'Source is "Homebrew" but the spell is not flagged as homebrew'
                : "Spell is flagged as homebrew but cites a published source",
        )
    if (homebrew && !spell.addedBy)
        warn("attribution", "Homebrew spell has no recorded author (addedBy)")
    for (const s of sources) {
        const info = SOURCES[s]
        if (info?.needsInfo)
            warn("attribution", `${describeSource(s)}: ${info.needsInfo}`)
    }

    // ── Style drift ──────────────────────────────────────────────────────────
    const normalized = normalizeSpell(spell)
    for (const field of NORMALIZED_FIELDS) {
        const before = JSON.stringify(spell[field] ?? null)
        const after = JSON.stringify(normalized[field] ?? null)
        if (before !== after) {
            warn(
                field,
                `Not in house style — expected ${truncate(after)} but found ${truncate(before)}`,
            )
        }
    }

    return issues
}

export function hasErrors(issues: SpellIssue[]): boolean {
    return issues.some((i) => i.severity === "error")
}

function truncate(s: string, max = 60): string {
    return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
