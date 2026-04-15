import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { UserPlus, Check } from "lucide-react"
import { useSpells, useCreateSpell } from "@/hooks/useSpells"
import { useCharacters, useAddKnownSpell } from "@/hooks/useCharacters"
import { useAuth } from "@/context/AuthContext"
import SpellList from "@/components/spells/SpellList"
import Drawer from "@/components/shared/Drawer"
import SpellForm from "@/components/spells/SpellForm"
import SpellInfoPanel from "@/components/spells/SpellInfoPanel"
import type { CreateSpellInput } from "@/types/spell"
import type { Spell } from "@/types/spell"
import type { Character } from "@/types/character"

export default function SpellsPage() {
    const [showCreate, setShowCreate] = useState(false)
    const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null)
    const [showCharacterPicker, setShowCharacterPicker] = useState(false)
    const [addingToCharacterId, setAddingToCharacterId] = useState<
        string | null
    >(null)
    const [addConfirmation, setAddConfirmation] = useState("")

    const { isAdmin } = useAuth()

    const { data: spells = [], isLoading } = useSpells()
    const { data: characters = [] } = useCharacters()
    const createSpell = useCreateSpell()
    const addKnownSpell = useAddKnownSpell()

    const existingSources = Array.from(
        new Set(spells.map((s) => s.source).filter(Boolean)),
    ).sort()

    async function handleCreate(data: CreateSpellInput) {
        await createSpell.mutateAsync(data)
        setShowCreate(false)
    }

    async function handleAddToCharacter(character: Character) {
        if (!selectedSpell) return
        setAddingToCharacterId(character.characterId)
        try {
            await addKnownSpell.mutateAsync({
                characterId: character.characterId,
                character,
                spellId: selectedSpell.spellId,
            })
            setShowCharacterPicker(false)
            setAddConfirmation(`Spell added to ${character.name}`)
            window.setTimeout(() => setAddConfirmation(""), 2400)
        } finally {
            setAddingToCharacterId(null)
        }
    }

    return (
        <>
            <SpellList
                spells={spells}
                isLoading={isLoading}
                onCreateSpell={() => setShowCreate(true)}
                onSelectSpell={setSelectedSpell}
            />

            <Drawer
                side='left'
                isOpen={!!selectedSpell}
                onClose={() => {
                    setSelectedSpell(null)
                    setShowCharacterPicker(false)
                    setAddConfirmation("")
                }}
                title={selectedSpell?.name}
                width='w-full max-w-md'
                footer={
                    selectedSpell ? (
                        <div className='space-y-2'>
                            <motion.button
                                onClick={() => setShowCharacterPicker(true)}
                                className='flex w-full items-center justify-center gap-2 rounded-lg border border-grimoire-primary/50 bg-grimoire-primary/15 py-2.5 font-rajdhani text-sm font-semibold text-grimoire-primary-light transition-colors hover:bg-grimoire-primary/25'
                                whileTap={{ scale: 0.97 }}
                            >
                                <UserPlus size={15} />
                                Add to character
                            </motion.button>
                            <AnimatePresence>
                                {addConfirmation && (
                                    <motion.p
                                        className='text-center font-rajdhani text-sm text-emerald-400'
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 4 }}
                                    >
                                        {addConfirmation}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </div>
                    ) : null
                }
            >
                {selectedSpell && <SpellInfoPanel spell={selectedSpell} />}
            </Drawer>

            <Drawer
                side='right'
                layer='overlay'
                isOpen={showCharacterPicker && !!selectedSpell}
                onClose={() => setShowCharacterPicker(false)}
                title='Add To Character'
                width='w-full max-w-sm'
            >
                {characters.length === 0 ? (
                    <p className='py-8 text-center font-rajdhani text-grimoire-text-faint'>
                        No characters found.
                    </p>
                ) : (
                    <div className='space-y-2'>
                        {characters
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((character) => {
                                const isAdding =
                                    addingToCharacterId ===
                                    character.characterId
                                return (
                                    <motion.button
                                        key={character.characterId}
                                        onClick={() =>
                                            void handleAddToCharacter(character)
                                        }
                                        disabled={isAdding}
                                        className='flex w-full items-center justify-between rounded-lg border border-grimoire-border/60 bg-grimoire-card/60 px-3 py-2.5 text-left transition-colors hover:border-grimoire-primary/40 hover:bg-grimoire-primary/10 disabled:opacity-60'
                                        whileHover={{ x: 2 }}
                                    >
                                        <div>
                                            <p className='font-rajdhani text-sm font-semibold text-grimoire-text-base'>
                                                {character.name}
                                            </p>
                                            <p className='font-rajdhani text-xs text-grimoire-text-faint'>
                                                {character.class} Lv.{" "}
                                                {character.level}
                                            </p>
                                        </div>
                                        {isAdding ? (
                                            <span className='font-rajdhani text-xs text-grimoire-text-faint'>
                                                Adding...
                                            </span>
                                        ) : (
                                            <Check
                                                size={14}
                                                className='text-grimoire-text-faint/60'
                                            />
                                        )}
                                    </motion.button>
                                )
                            })}
                    </div>
                )}
            </Drawer>

            <Drawer
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                title='New Spell'
            >
                <SpellForm
                    onSubmit={handleCreate}
                    onCancel={() => setShowCreate(false)}
                    isLoading={createSpell.isPending}
                    existingSources={existingSources}
                    isAdmin={isAdmin}
                />
            </Drawer>
        </>
    )
}
