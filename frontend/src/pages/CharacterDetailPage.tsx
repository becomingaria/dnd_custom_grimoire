import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Edit2, Trash2, BookOpen, Star, Shield } from "lucide-react"
import {
    useCharacter,
    useUpdateCharacter,
    useDeleteCharacter,
} from "@/hooks/useCharacters"
import { useAuth } from "@/context/AuthContext"
import LoadingSpinner from "@/components/shared/LoadingSpinner"
import Modal from "@/components/shared/Modal"
import CharacterForm from "@/components/characters/CharacterForm"
import SpellbookPanel from "@/components/characters/SpellbookPanel"
import { spellcastingAbilityLabel } from "@/types/character"
import type { UpdateCharacterInput } from "@/types/character"

export default function CharacterDetailPage() {
    const { characterId } = useParams<{ characterId: string }>()
    const navigate = useNavigate()
    const { userId } = useAuth()
    const [showEdit, setShowEdit] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const {
        data: character,
        isLoading,
        error,
    } = useCharacter(characterId ?? "")
    const updateCharacter = useUpdateCharacter()
    const deleteCharacter = useDeleteCharacter()

    async function handleUpdate(data: UpdateCharacterInput) {
        if (!characterId) return
        await updateCharacter.mutateAsync({ characterId, input: data })
        setShowEdit(false)
    }

    async function handleDelete() {
        if (!characterId) return
        await deleteCharacter.mutateAsync(characterId)
        navigate("/characters")
    }

    if (isLoading) {
        return (
            <div className='flex h-64 items-center justify-center'>
                <LoadingSpinner label='Loading character…' />
            </div>
        )
    }

    if (error || !character) {
        return (
            <div className='py-16 text-center font-rajdhani text-grimoire-text-faint'>
                Character not found.
            </div>
        )
    }

    const isOwner = character.userId === userId

    return (
        <div className='mx-auto max-w-3xl space-y-6 py-8'>
            {/* Back */}
            <motion.button
                onClick={() => navigate(-1)}
                className='flex items-center gap-2 font-rajdhani text-sm text-grimoire-text-faint hover:text-grimoire-text-muted transition-colors'
                whileHover={{ x: -2 }}
            >
                <ArrowLeft size={16} />
                Back
            </motion.button>

            {/* Header card */}
            <motion.div
                className='rounded-2xl border border-grimoire-border bg-grimoire-card overflow-hidden'
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className='border-b border-grimoire-border p-6'>
                    <div className='flex items-start justify-between gap-4'>
                        <div>
                            <h1 className='font-cinzel text-3xl font-bold text-grimoire-text-base'>
                                {character.name}
                            </h1>
                            <p className='mt-1 font-rajdhani text-grimoire-text-muted'>
                                {character.class}
                                {character.subclass &&
                                    ` · ${character.subclass}`}
                                {" · Level "}
                                {character.level}
                            </p>
                        </div>
                        {isOwner && (
                            <div className='flex items-center gap-2'>
                                <motion.button
                                    onClick={() => setShowEdit(true)}
                                    className='flex items-center gap-1.5 rounded-lg border border-grimoire-border px-3 py-1.5 font-rajdhani text-sm text-grimoire-text-muted hover:text-grimoire-text-base hover:border-grimoire-primary/40 transition-colors'
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    <Edit2 size={14} /> Edit
                                </motion.button>
                                <motion.button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className='flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 font-rajdhani text-sm text-red-400 hover:bg-red-500/10 transition-colors'
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    <Trash2 size={14} /> Delete
                                </motion.button>
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className='mt-5 grid grid-cols-4 gap-3'>
                        {[
                            {
                                icon: Shield,
                                label: "Level",
                                value: character.level,
                                color: "text-grimoire-primary-light",
                            },
                            {
                                icon: BookOpen,
                                label: "Known",
                                value: character.knownSpellIds.length,
                                color: "text-grimoire-accent",
                            },
                            {
                                icon: Star,
                                label: "Prepared",
                                value: character.preparedSpellIds.length,
                                color: "text-yellow-400",
                            },
                            {
                                icon: Shield,
                                label: "Save DC",
                                value: character.spellSaveDC ?? "—",
                                color: "text-green-400",
                            },
                        ].map(({ icon: Icon, label, value, color }) => (
                            <div
                                key={label}
                                className='flex flex-col items-center justify-center rounded-xl border border-grimoire-border/60 bg-grimoire-surface/50 p-3 text-center'
                            >
                                <Icon size={14} className={`mb-1 ${color}`} />
                                <span
                                    className={`font-mono text-2xl font-bold ${color}`}
                                >
                                    {value}
                                </span>
                                <span className='font-rajdhani text-[10px] uppercase tracking-widest text-grimoire-text-faint'>
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Optional totals row */}
                    {(!!character.totalKnownSpells ||
                        !!character.totalSpellsPrepared ||
                        !!character.totalSanity) && (
                        <div className='mt-3 flex flex-wrap gap-3'>
                            {!!character.totalKnownSpells && (
                                <div className='flex flex-col items-center justify-center rounded-xl border border-grimoire-border/60 bg-grimoire-surface/50 px-4 py-2 text-center'>
                                    <span className='font-mono text-xl font-bold text-grimoire-accent'>
                                        {character.totalKnownSpells}
                                    </span>
                                    <span className='font-rajdhani text-[10px] uppercase tracking-widest text-grimoire-text-faint'>
                                        Total Known
                                    </span>
                                </div>
                            )}
                            {!!character.totalSpellsPrepared && (
                                <div className='flex flex-col items-center justify-center rounded-xl border border-grimoire-border/60 bg-grimoire-surface/50 px-4 py-2 text-center'>
                                    <span className='font-mono text-xl font-bold text-yellow-400'>
                                        {character.totalSpellsPrepared}
                                    </span>
                                    <span className='font-rajdhani text-[10px] uppercase tracking-widest text-grimoire-text-faint'>
                                        Total Prepared
                                    </span>
                                </div>
                            )}
                            {!!character.totalSanity && (
                                <div className='flex flex-col items-center justify-center rounded-xl border border-grimoire-border/60 bg-grimoire-surface/50 px-4 py-2 text-center'>
                                    <span className='font-mono text-xl font-bold text-purple-400'>
                                        {character.totalSanity}
                                    </span>
                                    <span className='font-rajdhani text-[10px] uppercase tracking-widest text-grimoire-text-faint'>
                                        Total Sanity
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Info row */}
                    <div className='mt-4 flex flex-wrap gap-4 font-rajdhani text-sm text-grimoire-text-faint'>
                        <span>
                            Spellcasting:{" "}
                            <span className='text-grimoire-text-muted'>
                                {
                                    spellcastingAbilityLabel[
                                        character.spellcastingAbility as keyof typeof spellcastingAbilityLabel
                                    ]
                                }
                            </span>
                        </span>
                        {character.spellAttackBonus !== undefined && (
                            <span>
                                Attack Bonus:{" "}
                                <span className='text-grimoire-text-muted'>
                                    +{character.spellAttackBonus}
                                </span>
                            </span>
                        )}
                    </div>

                    {character.notes && (
                        <p className='mt-4 rounded-lg border border-grimoire-border/40 bg-grimoire-surface/30 p-3 font-rajdhani text-sm italic text-grimoire-text-muted'>
                            {character.notes}
                        </p>
                    )}
                </div>

                {/* Spellbook */}
                <div className='p-6'>
                    <SpellbookPanel character={character} />
                </div>
            </motion.div>

            {/* Edit Modal */}
            <Modal
                isOpen={showEdit}
                onClose={() => setShowEdit(false)}
                title='Edit Character'
            >
                <CharacterForm
                    initial={character}
                    onSubmit={handleUpdate}
                    onCancel={() => setShowEdit(false)}
                    isSaving={updateCharacter.isPending}
                />
            </Modal>

            {/* Delete Confirm Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title='Delete Character'
            >
                <div className='space-y-4'>
                    <p className='font-rajdhani text-grimoire-text-muted'>
                        Are you sure you want to delete{" "}
                        <strong className='text-grimoire-text-base'>
                            {character.name}
                        </strong>
                        ? This cannot be undone.
                    </p>
                    <div className='flex justify-end gap-3'>
                        <motion.button
                            onClick={() => setShowDeleteConfirm(false)}
                            className='btn-ghost'
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            Cancel
                        </motion.button>
                        <motion.button
                            onClick={handleDelete}
                            disabled={deleteCharacter.isPending}
                            className='rounded-lg bg-red-600 px-4 py-2 font-rajdhani font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50'
                            whileHover={{
                                scale: deleteCharacter.isPending ? 1 : 1.03,
                            }}
                            whileTap={{
                                scale: deleteCharacter.isPending ? 1 : 0.97,
                            }}
                        >
                            {deleteCharacter.isPending ? "Deleting…" : "Delete"}
                        </motion.button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
