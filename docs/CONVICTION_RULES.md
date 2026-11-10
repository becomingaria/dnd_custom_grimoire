# Conviction Casting in the Dice Tray

The dice tray implements *Spellcasting Variant: Conviction*. The rules live in
[`frontend/src/lib/conviction.ts`](../frontend/src/lib/conviction.ts) as plain
functions; the tray only calls them. This page records how the app reads the
rules, especially where the wording allows more than one reading.

## Turning it on

The **Conviction** switch in the dice tray header is per player (saved in the
browser). When it's on:

- the tray gets a **Cast** tab
- spells show a **Cast with Conviction** button (spell drawers and the
  Prepared Spells list) that opens the tray pre-filled with the spell and level
- d20 rolls offer **Spend 10 Conviction for +10** (*Adjusting a Roll*)

Conviction is tracked per character: `currentConviction` (may be negative) and
`convictionLockedOut`. The maximum is the character's **Total Conviction**,
or 10 × level when that's blank (Warlocks capped at 100).

## Casting cost

| Caster | Dice | How the app decides |
| --- | --- | --- |
| Full caster | 1d6 per spell level | Bard, Cleric, Druid, Sorcerer, Wizard, **Artificer** |
| Half-caster | 2d6 per level | Paladin, Ranger |
| One-third caster | 3d6 per level | Fighter with "Eldritch Knight" or Rogue with "Arcane Trickster" in the subclass |
| Warlock | 1d6 per level, cast at Pact slot level | Warlock (slot level = ⌈level ÷ 2⌉, max 5) |
| Non-caster | 1d6 per level (scrolls) | Barbarian, Monk, other Fighters/Rogues |

The caster type can be overridden in the tray. Cantrips cost nothing.

Added dice: **+1** not prepared, **+1** not on your spell list, metamagic
(one option, plus Empowered Spell which stacks), and any **extra d6** the GM
asks for (improvised effects, spells beyond your level).

## Rulings

These are the interpretations the code uses. Each is a one-line change in
`conviction.ts`, marked `RULING`.

1. **Artificers are full casters.** The PDF names only Paladin and Ranger as
   half-casters.
2. **Doubles are counted in pairs.** "For every matching pair … double the
   value": 5-5-4 = 24 (as in the PDF), 5-5-5 = 25 (one pair + one single),
   5-5-5-5 = 40.
3. **Doubles use the level the spell is cast at,** so a Warlock's 1st-level
   spell cast in a 3rd-level slot can roll doubles, and a half-caster's
   1st-level spell (2d6) can't.
4. **"Reaching 0"** happens when a cast takes you from above 0 to 0 or below:
   lose 1d10 hit points (minimum 1). It doesn't repeat while you stay below 0.
5. **Negative lock-out** triggers when the d100 is **equal to or lower than**
   how far below 0 you are, following the worked example ("15 or lower"). The
   lock-out lifts when your score rises above 0. Blood Magic ignores it.
6. **Wild Magic** is rolled after every cast that leaves you below 0.
7. **Rests and regained slots refill up to the maximum,** never past it.
   Warlocks also refill on a short rest.
8. **Twinned Spell** costs ½ the spell's level rounded down, minimum 1.
9. **Dreamtime** discards 1s and 2s before doubles are paired.
10. **Blood Magic** rolls d12s (doubles still apply) and the total is paid in
    hit points; Conviction doesn't change.

Not automated (table rulings): Circle Casting splits, Divine Smite, Sorcery
Point conversion, spell scrolls' save DCs, Dreamtime environment shaping. Use
**Extra d6** and **Caster type** to cover them.
