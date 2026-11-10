import { useCharacters, useUpdateCharacter } from "@/hooks/useCharacters"
import { useDiceTray } from "@/context/DiceTrayContext"
import { casterTypeFor, convictionMax, type CasterType } from "@/lib/conviction"
import type { Character } from "@/types/character"

export interface ConvictionState {
    characters: Character[]
    character: Character | null
    casterType: CasterType
    max: number
    current: number
    lockedOut: boolean
    isSaving: boolean
    /** Persist a new score. Rising above 0 always lifts the lock-out. */
    save: (next: number, opts?: { lockedOut?: boolean }) => Promise<void>
}

/** The tray's selected character and their Conviction Score. */
export function useConviction(): ConvictionState {
    const { characterId } = useDiceTray()
    const { data: characters = [] } = useCharacters()
    const update = useUpdateCharacter()

    const character =
        characters.find((c) => c.characterId === characterId) ??
        (characters.length === 1 ? characters[0] : null)

    const casterType = casterTypeFor(character?.class, character?.subclass)
    const max = character
        ? character.totalConviction ||
          convictionMax(character.level, casterType)
        : 0
    const current = character?.currentConviction ?? max
    const lockedOut = !!character?.convictionLockedOut && current <= 0

    async function save(next: number, opts: { lockedOut?: boolean } = {}) {
        if (!character) return
        const locked = next > 0 ? false : (opts.lockedOut ?? lockedOut)
        await update.mutateAsync({
            characterId: character.characterId,
            input: { currentConviction: next, convictionLockedOut: locked },
        })
    }

    return {
        characters,
        character,
        casterType,
        max,
        current,
        lockedOut,
        isSaving: update.isPending,
        save,
    }
}
