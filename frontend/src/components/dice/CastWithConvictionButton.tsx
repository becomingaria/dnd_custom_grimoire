import { Wand2 } from "lucide-react"
import { useDiceTray } from "@/context/DiceTrayContext"
import type { Spell } from "@/types/spell"

interface Props {
    spell: Pick<Spell, "name" | "level">
    /** Character to cast as; defaults to the tray's current character. */
    characterId?: string
    /** "icon" for dense rows, "full" for drawer footers. */
    variant?: "icon" | "full"
}

/**
 * Opens the dice tray's Conviction tab pre-filled for this spell. Renders
 * nothing unless the player has Conviction casting on, or for cantrips.
 */
export default function CastWithConvictionButton({
    spell,
    characterId,
    variant = "full",
}: Props) {
    const { convictionEnabled, castSpell, setCharacterId } = useDiceTray()
    if (!convictionEnabled || spell.level === 0) return null

    function cast() {
        if (characterId) setCharacterId(characterId)
        castSpell({ spellName: spell.name, spellLevel: spell.level })
    }

    if (variant === "icon") {
        return (
            <button
                type='button'
                onClick={cast}
                title={`Cast ${spell.name} with Conviction`}
                aria-label={`Cast ${spell.name} with Conviction`}
                className='flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-purple-400/40 bg-purple-500/10 text-purple-300 transition-colors hover:bg-purple-500/25'
            >
                <Wand2 size={13} />
            </button>
        )
    }

    return (
        <button
            type='button'
            onClick={cast}
            className='flex w-full items-center justify-center gap-2 rounded-lg border border-purple-400/40 bg-purple-500/10 py-2.5 font-rajdhani text-sm font-semibold text-purple-300 transition-colors hover:bg-purple-500/20'
        >
            <Wand2 size={15} />
            Cast with Conviction
        </button>
    )
}
