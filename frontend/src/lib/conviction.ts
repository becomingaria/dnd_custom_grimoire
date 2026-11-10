/**
 * Spellcasting Variant: Conviction — rules engine.
 *
 * Pure functions only (dice come from ./dice), so every rule here can be
 * tested without the UI. Interpretations of ambiguous wording are marked
 * "RULING" and documented in docs/CONVICTION_RULES.md.
 */
import { rollDice, rollDie } from "./dice"

// ─── Caster types ─────────────────────────────────────────────────────────────

export type CasterType = "full" | "half" | "third" | "warlock" | "none"

export const CASTER_TYPE_LABEL: Record<CasterType, string> = {
    full: "Full caster (1d6 / level)",
    half: "Half-caster (2d6 / level)",
    third: "One-third caster (3d6 / level)",
    warlock: "Warlock (casts at slot level)",
    none: "Non-caster (scrolls only, 1d6 / level)",
}

/** d6 per spell level. Non-casters pay the base cost for scrolls. */
const DICE_PER_LEVEL: Record<CasterType, number> = {
    full: 1,
    half: 2,
    third: 3,
    warlock: 1,
    none: 1,
}

/**
 * RULING: only Paladin and Ranger are half-casters (as the PDF lists);
 * Artificers pay the full-caster rate.
 */
export function casterTypeFor(
    characterClass: string | undefined,
    subclass?: string | null,
): CasterType {
    const cls = (characterClass ?? "").toLowerCase()
    const sub = (subclass ?? "").toLowerCase()
    if (cls === "warlock") return "warlock"
    if (cls === "paladin" || cls === "ranger") return "half"
    if (cls === "fighter" && sub.includes("eldritch knight")) return "third"
    if (cls === "rogue" && sub.includes("arcane trickster")) return "third"
    if (["barbarian", "monk", "fighter", "rogue"].includes(cls)) return "none"
    return "full"
}

/** Warlock Pact Magic slot level by warlock level (PHB Warlock table). */
export function warlockSlotLevel(level: number): number {
    return Math.min(5, Math.max(1, Math.ceil(level / 2)))
}

/** 10 × level; Warlocks cap at 100. */
export function convictionMax(level: number, casterType: CasterType): number {
    const max = 10 * Math.max(1, level)
    return casterType === "warlock" ? Math.min(max, 100) : max
}

// ─── Metamagic ────────────────────────────────────────────────────────────────

export interface MetamagicOption {
    id: string
    name: string
    summary: string
    /** Extra d6s for a spell of this level. */
    dice: (spellLevel: number) => number
    /** Can be combined with another option (Empowered Spell). */
    stacks?: boolean
}

export const METAMAGIC: MetamagicOption[] = [
    {
        id: "careful",
        name: "Careful Spell",
        summary:
            "Up to 2× your spellcasting modifier creatures auto-succeed on the save.",
        dice: () => 1,
    },
    {
        id: "distant",
        name: "Distant Spell",
        summary: "Double the range, or make Touch range 30 feet.",
        dice: () => 1,
    },
    {
        id: "extended",
        name: "Extended Spell",
        summary: "Double a duration of 1 minute or longer (max 24 hours).",
        dice: () => 1,
    },
    {
        id: "heightened",
        name: "Heightened Spell",
        summary: "One target has disadvantage on its first save.",
        dice: () => 1,
    },
    {
        id: "quickened",
        name: "Quickened Spell",
        summary: "Cast a 1-action spell as a bonus action.",
        dice: () => 1,
    },
    {
        id: "subtle",
        name: "Subtle Spell",
        summary: "Cast without somatic or verbal components.",
        dice: () => 1,
    },
    {
        id: "twinned",
        name: "Twinned Spell",
        summary: "Target a second creature (single-target spells only).",
        // RULING: ½ the spell's level, rounded down, minimum 1.
        dice: (level) => Math.max(1, Math.floor(level / 2)),
    },
    {
        id: "empowered",
        name: "Empowered Spell",
        summary:
            "Reroll up to 2× your spellcasting modifier damage dice. Can combine with another option.",
        dice: () => 1,
        stacks: true,
    },
]

// ─── Casting cost ─────────────────────────────────────────────────────────────

export interface CastOptions {
    spellLevel: number
    casterType: CasterType
    characterLevel: number
    notPrepared?: boolean
    notOnSpellList?: boolean
    /** Metamagic ids; at most one non-stacking option plus Empowered. */
    metamagic?: string[]
    /** Extra d6 the GM asks for (improvised effects, beyond your level…). */
    extraDice?: number
    /** Dreamtime: 1s and 2s are discarded from the roll. */
    dreamtime?: boolean
    /** Blood Magic: d12s, paid from hit points instead of Conviction. */
    bloodMagic?: boolean
}

export interface CastPlan {
    /** Level the spell is actually cast at (Warlocks cast at slot level). */
    castLevel: number
    dieSides: 6 | 12
    count: number
    /** Doubles only apply to spells of 2nd level or higher. */
    doubles: boolean
    breakdown: string[]
}

export function planCast(o: CastOptions): CastPlan {
    const castLevel =
        o.casterType === "warlock" && o.spellLevel > 0
            ? Math.max(o.spellLevel, warlockSlotLevel(o.characterLevel))
            : o.spellLevel

    const breakdown: string[] = []
    let count = 0
    if (castLevel > 0) {
        const base = castLevel * DICE_PER_LEVEL[o.casterType]
        count += base
        breakdown.push(
            o.casterType === "warlock" && castLevel > o.spellLevel
                ? `${base} for casting at slot level ${castLevel}`
                : `${base} for a level ${castLevel} spell`,
        )
    }
    if (o.notPrepared) {
        count += 1
        breakdown.push("+1 not prepared")
    }
    if (o.notOnSpellList) {
        count += 1
        breakdown.push("+1 not on your spell list")
    }
    for (const id of o.metamagic ?? []) {
        const mm = METAMAGIC.find((m) => m.id === id)
        if (!mm) continue
        const n = mm.dice(castLevel)
        count += n
        breakdown.push(`+${n} ${mm.name}`)
    }
    if (o.extraDice) {
        count += o.extraDice
        breakdown.push(`+${o.extraDice} extra (GM)`)
    }

    return {
        castLevel,
        dieSides: o.bloodMagic ? 12 : 6,
        count,
        doubles: castLevel >= 2,
        breakdown,
    }
}

// ─── Scoring (doubles, Dreamtime) ─────────────────────────────────────────────

export interface ScoredDie {
    value: number
    /** Counted at twice its face value (part of a matching pair). */
    doubled: boolean
    /** Discarded in Dreamtime (a 1 or 2). */
    discarded: boolean
    points: number
}

export interface ScoredRoll {
    dice: ScoredDie[]
    total: number
    pairs: number
}

/**
 * RULING: "for every matching pair, double the value on the face of these
 * dice" — each complete pair of equal faces is doubled; an odd one out of a
 * triple stays single. Dreamtime discards happen before pairing.
 */
export function scoreConvictionRoll(
    values: number[],
    opts: { doubles: boolean; dreamtime?: boolean },
): ScoredRoll {
    const dice: ScoredDie[] = values.map((value) => ({
        value,
        doubled: false,
        discarded: !!opts.dreamtime && value <= 2,
        points: 0,
    }))

    let pairs = 0
    if (opts.doubles) {
        const byFace = new Map<number, ScoredDie[]>()
        for (const d of dice) {
            if (d.discarded) continue
            byFace.set(d.value, [...(byFace.get(d.value) ?? []), d])
        }
        for (const group of byFace.values()) {
            const pairable = group.length - (group.length % 2)
            for (let i = 0; i < pairable; i++) group[i].doubled = true
            pairs += pairable / 2
        }
    }

    for (const d of dice) {
        d.points = d.discarded ? 0 : d.doubled ? d.value * 2 : d.value
    }
    return { dice, total: dice.reduce((s, d) => s + d.points, 0), pairs }
}

export function rollConviction(plan: CastPlan, dreamtime = false): ScoredRoll {
    return scoreConvictionRoll(rollDice(plan.count, plan.dieSides), {
        doubles: plan.doubles,
        dreamtime,
    })
}

// ─── Consequences ─────────────────────────────────────────────────────────────

export interface WildMagicEntry {
    roll: number
    effect: string
}

export interface CastOutcome {
    before: number
    after: number
    /** Blood Magic: hit points lost instead of Conviction. */
    hpCost?: number
    /** Crossed from above 0 to 0 or below: lose 1d10 HP (min 1 HP left). */
    reachedZero?: { hpLoss: number }
    /** Below 0: d100 lock-out check and a Wild Magic roll. */
    negative?: {
        d100: number
        lockedOut: boolean
        wildMagic: WildMagicEntry
    }
}

/**
 * RULING: the lock-out triggers when the d100 is equal to or lower than the
 * amount below zero (the worked example: "if the result is 15 or lower").
 */
export function resolveCast(
    current: number,
    cost: number,
    opts: { bloodMagic?: boolean } = {},
): CastOutcome {
    if (opts.bloodMagic) return { before: current, after: current, hpCost: cost }

    const after = current - cost
    const outcome: CastOutcome = { before: current, after }
    if (current > 0 && after <= 0) {
        outcome.reachedZero = { hpLoss: rollDie(10) }
    }
    if (after < 0) {
        const d100 = rollDie(100)
        outcome.negative = {
            d100,
            lockedOut: d100 <= -after,
            wildMagic: rollWildMagic(),
        }
    }
    return outcome
}

export function rollWildMagic(): WildMagicEntry {
    const roll = rollDie(20)
    return { roll, effect: WILD_MAGIC_TABLE[roll] }
}

// ─── Adjusting rolls, rests, regaining ────────────────────────────────────────

export const ADJUST_COST = 10
export const ADJUST_BONUS = 10

export function canAdjustRoll(current: number): boolean {
    return current >= ADJUST_COST
}

/** RULING: rests and regained slots refill up to the maximum, not past it. */
export function afterRest(current: number, max: number): number {
    return Math.min(max, current + max)
}

/** Regaining a Spell Slot: roll (slot level)d6 with doubles; add, capped at max. */
export function regainSlot(
    current: number,
    max: number,
    slotLevel: number,
): { roll: ScoredRoll; after: number } {
    const roll = scoreConvictionRoll(rollDice(slotLevel, 6), {
        doubles: slotLevel >= 2,
    })
    return { roll, after: Math.min(max, current + roll.total) }
}

// ─── Wild Magic table (d20) ───────────────────────────────────────────────────

export const WILD_MAGIC_TABLE: Record<number, string> = {
    20: "Your hair turns shock-white, you age by 1d6 years, and one of your eyes becomes permanently blind.",
    19: "Your nose disintegrates, leaving your face permanently sunken and skull-like.",
    18: "Your skin becomes covered in fish-like scales. Your eyes double in size, and the distance between them doubles.",
    17: "Chaotic force distorts your bones and joints. Until your next long rest, you have disadvantage on all Strength and Dexterity checks and saving throws.",
    16: "You cough up corrosive black ichor and take 1d12 acid damage.",
    15: "Holy fire erupts beneath your skin, dealing 2d12 radiant damage.",
    14: "Painful boils erupt across your body. Whenever you fail a Strength or Dexterity check, you take 1d6 necrotic damage.",
    13: "Whenever you cast a spell, roll a d10. On a 10, an insect burrows out through one of your veins, dealing 1 piercing damage. This curse ends only through remove curse cast at 7th level or wish.",
    12: "1d12 unattended objects within 30 feet transform into Mimics. They immediately attack the nearest creature.",
    11: "Your hair falls out, you age by 1d6 years, and your Dexterity score is reduced by 2, to a minimum of 10.",
    10: "You are polymorphed into a frog. Roll a d8: on 1–4, the effect lasts 1 hour; on 5–7, it lasts until you reach 0 hit points; on an 8, it lasts until removed by remove curse, greater restoration, or wish.",
    9: "You are teleported to a barren demiplane for 24 hours. All your weapons and equipment remain behind. When you return, you appear 1d4 miles from where you vanished, covered in thick white slime.",
    8: "Your abdomen swells with living serpents. Once per day at an unpredictable moment determined by the GM, you vomit up a swarm of poisonous snakes that is hostile to every nearby creature.",
    7: "Your tongue tears itself free from your mouth and falls to the floor. It regrows at dawn, but the effect repeats every evening at dusk.",
    6: "Your spine twists into a severe hunch. Your Dexterity score is reduced by 2 until cured by greater restoration or wish.",
    5: "A bolt of lightning strikes you. Make a DC 10 Dexterity saving throw. On a failure, you immediately drop to 0 hit points and suffer two failed death saving throws.",
    4: "A hostile duplicate of you appears in an unoccupied space within 30 feet. It has your statistics, abilities, equipment, and current hit points, and seeks to kill and replace you.",
    3: "A 10-foot-wide portal opens within 60 feet, releasing 20d6 zombies. Every hour for 48 hours, another 20d6 zombies emerge. The zombies attempt to incapacitate you and drag you through the portal.",
    2: "Your body collapses into a tar-like mass, transforming you into a Black Pudding. The transformation persists until removed by greater restoration or wish.",
    1: "A tear in reality opens within 30 feet. Black tendrils make one attack against every creature within 15 feet of the tear with a +5 bonus to hit. A creature hit is grappled and must succeed on a DC 15 Strength saving throw or be dragged into a hostile plane before the tear closes.",
}
