/** Dice the tray can roll. 100 = percentile die. */
export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const
export type DieSides = (typeof DIE_SIDES)[number]

/**
 * Unbiased integer in 1..sides using the platform CSPRNG (rejection sampling
 * avoids the modulo bias of `Math.random() * n`).
 */
export function rollDie(sides: number): number {
    const max = Math.floor(0x100000000 / sides) * sides
    const buf = new Uint32Array(1)
    do {
        crypto.getRandomValues(buf)
    } while (buf[0] >= max)
    return (buf[0] % sides) + 1
}

export function rollDice(count: number, sides: number): number[] {
    return Array.from({ length: Math.max(0, count) }, () => rollDie(sides))
}

export interface RolledDie {
    sides: number
    value: number
    /** Not counted toward the total (e.g. the lower d20 at advantage). */
    dropped?: boolean
}

export type Advantage = "normal" | "advantage" | "disadvantage"

export interface PoolRoll {
    dice: RolledDie[]
    modifier: number
    total: number
    /** "2d6 + 1d8 + 3" */
    notation: string
}

export type DicePool = Partial<Record<DieSides, number>>

export function poolNotation(pool: DicePool, modifier = 0): string {
    const dice = DIE_SIDES.filter((s) => (pool[s] ?? 0) > 0)
        .map((s) => `${pool[s]}d${s}`)
        .join(" + ")
    if (!modifier) return dice
    const mod = `${modifier < 0 ? "−" : "+"} ${Math.abs(modifier)}`
    return dice ? `${dice} ${mod}` : String(modifier)
}

/**
 * Rolls a pool. Advantage/disadvantage applies when the pool is exactly one
 * d20: two d20s are rolled and the lower/higher one is dropped.
 */
export function rollPool(
    pool: DicePool,
    modifier = 0,
    advantage: Advantage = "normal",
): PoolRoll {
    const dice: RolledDie[] = []
    const singleD20 = isSingleD20(pool)

    for (const sides of DIE_SIDES) {
        const count = pool[sides] ?? 0
        if (sides === 20 && singleD20 && advantage !== "normal") {
            const [a, b] = rollDice(2, 20)
            const keepFirst = advantage === "advantage" ? a >= b : a <= b
            dice.push({ sides: 20, value: a, dropped: !keepFirst })
            dice.push({ sides: 20, value: b, dropped: keepFirst })
            continue
        }
        for (const value of rollDice(count, sides)) dice.push({ sides, value })
    }

    const total =
        dice.filter((d) => !d.dropped).reduce((sum, d) => sum + d.value, 0) +
        modifier
    return { dice, modifier, total, notation: poolNotation(pool, modifier) }
}

export function isSingleD20(pool: DicePool): boolean {
    const counts = DIE_SIDES.map((s) => pool[s] ?? 0)
    return (pool[20] ?? 0) === 1 && counts.reduce((a, b) => a + b, 0) === 1
}
