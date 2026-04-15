import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Check,
    Plus,
    X,
    Search,
    BookOpen,
    SlidersHorizontal,
    ChevronDown,
    Pencil,
    RotateCcw,
    BookMarked,
} from "lucide-react"
import { useSpells } from "@/hooks/useSpells"
import {
    useAddKnownSpells,
    useRemoveKnownSpell,
    useRemoveKnownSpells,
    useResetPreparedSpells,
    useTogglePreparedSpell,
    useUpdateSpellNote,
} from "@/hooks/useCharacters"
import SchoolBadge from "@/components/spells/SchoolBadge"
import Drawer from "@/components/shared/Drawer"
import SpellInfoPanel from "@/components/spells/SpellInfoPanel"
import { spellLevelLabel, SPELL_SCHOOLS, DND_CLASSES } from "@/types/spell"
import type { Character } from "@/types/character"
import type { Spell, SpellSchool, DndClass } from "@/types/spell"
import { useLocalStorage } from "@/hooks/useLocalStorage"

type SortOption = "name-asc" | "name-desc" | "level-asc" | "level-desc"

interface SpellbookPanelProps {
    character: Character
}

function groupByLevel(spells: Spell[]): Map<number, Spell[]> {
    const map = new Map<number, Spell[]>()
    for (const spell of spells) {
        const arr = map.get(spell.level) ?? []
        arr.push(spell)
        map.set(spell.level, arr)
    }
    return map
}

export default function SpellbookPanel({ character }: SpellbookPanelProps) {
    const [showAddModal, setShowAddModal] = useState(false)
    const [addSearch, setAddSearch] = useState("")
    const [pendingSpellIds, setPendingSpellIds] = useState<Set<string>>(
        new Set(),
    )
    const [removeSelectedIds, setRemoveSelectedIds] = useState<Set<string>>(
        new Set(),
    )
    const [showPreparedDrawer, setShowPreparedDrawer] = useState(false)
    const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null)
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
    const [noteValue, setNoteValue] = useState("")
    const [filterSchools, setFilterSchools] = useLocalStorage<SpellSchool[]>(
        "grimoire:addspell:school:v2",
        [],
    )
    const [filterLevels, setFilterLevels] = useLocalStorage<number[]>(
        "grimoire:addspell:level:v2",
        [],
    )
    const [filterClasses, setFilterClasses] = useLocalStorage<DndClass[]>(
        "grimoire:addspell:class:v2",
        [],
    )
    const [filterSources, setFilterSources] = useLocalStorage<string[]>(
        "grimoire:addspell:source:v2",
        [],
    )
    const [sortBy, setSortBy] = useLocalStorage<SortOption>(
        "grimoire:addspell:sort",
        "name-asc",
    )
    const [showFilters, setShowFilters] = useState(false)

    const { data: allSpells = [] } = useSpells()
    const uniqueSources = useMemo(
        () =>
            Array.from(
                new Set(allSpells.map((s) => s.source).filter(Boolean)),
            ).sort(),
        [allSpells],
    )
    const addKnownSpells = useAddKnownSpells()
    const removeKnownSpell = useRemoveKnownSpell()
    const removeKnownSpells = useRemoveKnownSpells()
    const resetPrepared = useResetPreparedSpells()
    const togglePrepared = useTogglePreparedSpell()
    const updateSpellNote = useUpdateSpellNote()

    // Resolve known spells from allSpells
    const knownSpells = allSpells.filter((s) =>
        character.knownSpellIds.includes(s.spellId),
    )
    const knownCantrips = knownSpells.filter((s) => s.level === 0)
    const knownCantripIds = new Set(knownCantrips.map((s) => s.spellId))
    const preparedSpells = knownSpells.filter(
        (s) => s.level === 0 || character.preparedSpellIds.includes(s.spellId),
    )
    const preparedCount = knownSpells.filter(
        (s) => s.level > 0 && character.preparedSpellIds.includes(s.spellId),
    ).length
    const isPrepared = (spellId: string) =>
        knownCantripIds.has(spellId) ||
        character.preparedSpellIds.includes(spellId)

    const grouped = groupByLevel(knownSpells)
    const sortedLevels = [...grouped.keys()].sort((a, b) => a - b)

    function toggleInList<T>(list: T[], value: T): T[] {
        return list.includes(value)
            ? list.filter((v) => v !== value)
            : [...list, value]
    }

    // Spells available to add (not already known), filtered + sorted
    const addableSuggestions = useMemo(() => {
        let results = allSpells.filter(
            (s) => !character.knownSpellIds.includes(s.spellId),
        )
        if (addSearch.trim())
            results = results.filter((s) =>
                s.name.toLowerCase().includes(addSearch.toLowerCase()),
            )
        if (filterSchools.length > 0)
            results = results.filter((s) => filterSchools.includes(s.school))
        if (filterLevels.length > 0)
            results = results.filter((s) => filterLevels.includes(s.level))
        if (filterClasses.length > 0)
            results = results.filter((s) =>
                filterClasses.some((cls) => s.classes?.includes(cls)),
            )
        if (filterSources.length > 0)
            results = results.filter((s) => filterSources.includes(s.source))
        results = [...results].sort((a, b) => {
            if (sortBy === "name-asc") return a.name.localeCompare(b.name)
            if (sortBy === "name-desc") return b.name.localeCompare(a.name)
            if (sortBy === "level-asc")
                return a.level - b.level || a.name.localeCompare(b.name)
            if (sortBy === "level-desc")
                return b.level - a.level || a.name.localeCompare(b.name)
            return 0
        })
        return results
    }, [
        allSpells,
        character.knownSpellIds,
        addSearch,
        filterSchools,
        filterLevels,
        filterClasses,
        filterSources,
        sortBy,
    ])

    const hasActiveFilters =
        filterSchools.length > 0 ||
        filterLevels.length > 0 ||
        filterClasses.length > 0 ||
        filterSources.length > 0

    function clearModalFilters() {
        setFilterSchools([])
        setFilterLevels([])
        setFilterClasses([])
        setFilterSources([])
    }

    function closeAddModal() {
        setShowAddModal(false)
        setAddSearch("")
        setShowFilters(false)
        setPendingSpellIds(new Set())
        // Intentionally NOT clearing filters — they persist so the next
        // time the modal opens the user's selections are still there.
    }

    function togglePending(spellId: string) {
        setPendingSpellIds((prev) => {
            const next = new Set(prev)
            if (next.has(spellId)) next.delete(spellId)
            else next.add(spellId)
            return next
        })
    }

    function handleAddSelected() {
        const spellIds = [...pendingSpellIds]
        setPendingSpellIds(new Set())
        addKnownSpells.mutate({
            characterId: character.characterId,
            character,
            spellIds,
        })
    }

    function handleRemoveSpell(spellId: string) {
        removeKnownSpell.mutate({
            characterId: character.characterId,
            character,
            spellId,
        })
    }

    function handleRemoveSelected() {
        const spellIds = [...removeSelectedIds]
        setRemoveSelectedIds(new Set())
        removeKnownSpells.mutate({
            characterId: character.characterId,
            character,
            spellIds,
        })
    }

    function handleResetPrepared() {
        resetPrepared.mutate({ characterId: character.characterId })
    }

    function toggleRemoveSelected(spellId: string) {
        setRemoveSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(spellId)) next.delete(spellId)
            else next.add(spellId)
            return next
        })
    }

    function handleToggle(spellId: string) {
        if (knownCantripIds.has(spellId)) return
        togglePrepared.mutate({
            characterId: character.characterId,
            character,
            spellId,
        })
    }

    function startEditNote(spellId: string) {
        setEditingNoteId(spellId)
        setNoteValue(character.spellNotes?.[spellId] ?? "")
    }

    function saveNote(spellId: string) {
        setEditingNoteId(null)
        updateSpellNote.mutate({
            characterId: character.characterId,
            character,
            spellId,
            note: noteValue,
        })
    }

    return (
        <div className='space-y-6'>
            {/* Header */}
            <div className='flex flex-wrap items-center gap-2 justify-between'>
                <h3 className='font-cinzel text-xl font-bold text-grimoire-text-base'>
                    Spellbook
                    <span className='ml-3 font-mono text-sm text-grimoire-text-faint'>
                        {knownSpells.length} known · {preparedCount} prepared
                    </span>
                </h3>
                <div className='flex items-center gap-2'>
                    {preparedSpells.length > 0 && (
                        <motion.button
                            className='flex items-center gap-1.5 rounded-lg border border-blue-500/50 bg-blue-500/10 px-3 py-1.5 font-rajdhani text-sm text-blue-300 hover:bg-blue-500/20 transition-colors'
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setShowPreparedDrawer(true)}
                            title='View prepared spells'
                        >
                            <BookMarked size={14} />
                            Prepared ({preparedCount})
                        </motion.button>
                    )}
                    {preparedCount > 0 && (
                        <motion.button
                            className='flex items-center gap-1.5 rounded-lg border border-grimoire-border/60 bg-grimoire-surface/60 px-3 py-1.5 font-rajdhani text-sm text-grimoire-text-muted hover:border-red-500/40 hover:text-red-400 transition-colors'
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={handleResetPrepared}
                            title='Clear all prepared spells'
                        >
                            <RotateCcw size={14} />
                            Reset Prepared
                        </motion.button>
                    )}
                    <motion.button
                        className='flex items-center gap-2 rounded-lg border border-grimoire-primary/50 bg-grimoire-primary/10 px-3 py-1.5 font-rajdhani text-sm text-grimoire-primary-light hover:bg-grimoire-primary/20 transition-colors'
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                            setShowAddModal(true)
                            setShowFilters(false)
                        }}
                    >
                        <Plus size={14} />
                        Add Spell
                    </motion.button>
                </div>
            </div>

            {/* Bulk-remove toolbar */}
            <AnimatePresence>
                {removeSelectedIds.size > 0 && (
                    <motion.div
                        className='flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2'
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                    >
                        <span className='font-rajdhani text-sm text-red-400'>
                            {removeSelectedIds.size} spell
                            {removeSelectedIds.size !== 1 ? "s" : ""} selected
                        </span>
                        <div className='flex items-center gap-2'>
                            {removeSelectedIds.size < knownSpells.length && (
                                <button
                                    onClick={() =>
                                        setRemoveSelectedIds(
                                            new Set(
                                                knownSpells.map(
                                                    (s) => s.spellId,
                                                ),
                                            ),
                                        )
                                    }
                                    className='font-rajdhani text-xs text-blue-300 hover:text-blue-200 transition-colors'
                                >
                                    Select all
                                </button>
                            )}
                            <button
                                onClick={() => setRemoveSelectedIds(new Set())}
                                className='font-rajdhani text-xs text-grimoire-text-faint hover:text-grimoire-text-muted transition-colors'
                            >
                                Cancel
                            </button>
                            <motion.button
                                onClick={handleRemoveSelected}
                                className='flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/15 px-3 py-1 font-rajdhani text-sm font-semibold text-red-400 hover:bg-red-500/25 transition-colors'
                                whileTap={{ scale: 0.96 }}
                            >
                                <X size={13} />
                                Remove {removeSelectedIds.size}
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {knownSpells.length === 0 ? (
                <motion.div
                    className='flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-grimoire-border text-grimoire-text-faint'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <BookOpen size={32} strokeWidth={1} />
                    <p className='font-rajdhani'>No spells in spellbook yet.</p>
                </motion.div>
            ) : (
                <div className='rounded-xl border border-grimoire-border overflow-hidden'>
                    {/* Column headers */}
                    <div className='grid grid-cols-[1.5rem_2rem_1fr_5rem_7rem_6rem_minmax(8rem,1fr)_2rem] items-center gap-x-3 border-b border-grimoire-border bg-grimoire-surface/70 px-3 py-2'>
                        <span />
                        <span className='font-cinzel text-[10px] uppercase tracking-widest text-grimoire-text-faint text-center'>
                            P
                        </span>
                        <span className='font-cinzel text-[10px] uppercase tracking-widest text-grimoire-text-faint'>
                            Name
                        </span>
                        <span className='font-cinzel text-[10px] uppercase tracking-widest text-grimoire-text-faint text-center'>
                            Conc.
                        </span>
                        <span className='font-cinzel text-[10px] uppercase tracking-widest text-grimoire-text-faint'>
                            Duration
                        </span>
                        <span className='font-cinzel text-[10px] uppercase tracking-widest text-grimoire-text-faint'>
                            Source
                        </span>
                        <span className='font-cinzel text-[10px] uppercase tracking-widest text-grimoire-text-faint'>
                            Notes
                        </span>
                        <span />
                    </div>

                    {sortedLevels.map((level, li) => {
                        const spells = grouped.get(level)!
                        return (
                            <div key={level}>
                                {/* Level divider */}
                                <div
                                    className={`border-b border-grimoire-border/40 bg-grimoire-surface/30 px-3 py-1 ${li > 0 ? "border-t border-grimoire-border/40" : ""}`}
                                >
                                    <span className='font-cinzel text-xs font-bold uppercase tracking-widest text-grimoire-text-faint'>
                                        {spellLevelLabel(level)}
                                    </span>
                                </div>

                                <AnimatePresence initial={false}>
                                    {spells.map((spell, si) => {
                                        const isRemoveSelected =
                                            removeSelectedIds.has(spell.spellId)
                                        return (
                                            <motion.div
                                                key={spell.spellId}
                                                className={`group grid grid-cols-[1.5rem_2rem_1fr_5rem_7rem_6rem_minmax(8rem,1fr)_2rem] items-center gap-x-3 px-3 py-2.5 transition-colors ${isRemoveSelected ? "bg-red-500/8" : "hover:bg-grimoire-primary/5"} ${si < spells.length - 1 ? "border-b border-grimoire-border/30" : ""}`}
                                                initial={{ opacity: 0, x: -6 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 6 }}
                                                layout
                                            >
                                                {/* Remove-select checkbox */}
                                                <div className='flex justify-center'>
                                                    <motion.button
                                                        className='rounded-sm focus:outline-none'
                                                        whileHover={{
                                                            scale: 1.15,
                                                        }}
                                                        whileTap={{
                                                            scale: 0.85,
                                                        }}
                                                        onClick={() =>
                                                            toggleRemoveSelected(
                                                                spell.spellId,
                                                            )
                                                        }
                                                        title={
                                                            isRemoveSelected
                                                                ? "Deselect"
                                                                : "Select for removal"
                                                        }
                                                    >
                                                        <AnimatePresence
                                                            mode='wait'
                                                            initial={false}
                                                        >
                                                            {isRemoveSelected ? (
                                                                <motion.span
                                                                    key='checked'
                                                                    className='flex h-4 w-4 items-center justify-center rounded border border-red-500 bg-red-500/20'
                                                                    initial={{
                                                                        scale: 0.5,
                                                                        opacity: 0,
                                                                    }}
                                                                    animate={{
                                                                        scale: 1,
                                                                        opacity: 1,
                                                                    }}
                                                                    exit={{
                                                                        scale: 0.5,
                                                                        opacity: 0,
                                                                    }}
                                                                    transition={{
                                                                        duration: 0.12,
                                                                    }}
                                                                >
                                                                    <Check
                                                                        size={
                                                                            10
                                                                        }
                                                                        strokeWidth={
                                                                            3
                                                                        }
                                                                        className='text-red-400'
                                                                    />
                                                                </motion.span>
                                                            ) : (
                                                                <motion.span
                                                                    key='unchecked'
                                                                    className='flex h-4 w-4 items-center justify-center rounded border border-grimoire-border/40 opacity-0 group-hover:opacity-100 transition-opacity'
                                                                    initial={{
                                                                        scale: 0.5,
                                                                        opacity: 0,
                                                                    }}
                                                                    animate={{
                                                                        scale: 1,
                                                                        opacity: 1,
                                                                    }}
                                                                    exit={{
                                                                        scale: 0.5,
                                                                        opacity: 0,
                                                                    }}
                                                                    transition={{
                                                                        duration: 0.12,
                                                                    }}
                                                                />
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.button>
                                                </div>

                                                {/* Prepared bubble */}
                                                <div className='flex justify-center'>
                                                    <motion.button
                                                        className='rounded-full focus:outline-none'
                                                        whileHover={{
                                                            scale: 1.15,
                                                        }}
                                                        whileTap={{
                                                            scale: 0.85,
                                                        }}
                                                        onClick={() =>
                                                            handleToggle(
                                                                spell.spellId,
                                                            )
                                                        }
                                                        disabled={
                                                            spell.level === 0
                                                        }
                                                        title={
                                                            spell.level === 0
                                                                ? "Cantrips are always prepared"
                                                                : isPrepared(
                                                                        spell.spellId,
                                                                    )
                                                                  ? "Unprepare"
                                                                  : "Prepare"
                                                        }
                                                    >
                                                        <AnimatePresence
                                                            mode='wait'
                                                            initial={false}
                                                        >
                                                            {isPrepared(
                                                                spell.spellId,
                                                            ) ? (
                                                                <motion.span
                                                                    key='prepared'
                                                                    className='flex h-5 w-5 items-center justify-center rounded-full bg-blue-500'
                                                                    initial={{
                                                                        scale: 0.5,
                                                                        opacity: 0,
                                                                    }}
                                                                    animate={{
                                                                        scale: 1,
                                                                        opacity: 1,
                                                                    }}
                                                                    exit={{
                                                                        scale: 0.5,
                                                                        opacity: 0,
                                                                    }}
                                                                    transition={{
                                                                        duration: 0.15,
                                                                    }}
                                                                >
                                                                    <Check
                                                                        size={
                                                                            11
                                                                        }
                                                                        strokeWidth={
                                                                            3
                                                                        }
                                                                        className='text-white'
                                                                    />
                                                                </motion.span>
                                                            ) : (
                                                                <motion.span
                                                                    key='unprepared'
                                                                    className='flex h-5 w-5 items-center justify-center rounded-full border-2 border-grimoire-border/60'
                                                                    initial={{
                                                                        scale: 0.5,
                                                                        opacity: 0,
                                                                    }}
                                                                    animate={{
                                                                        scale: 1,
                                                                        opacity: 1,
                                                                    }}
                                                                    exit={{
                                                                        scale: 0.5,
                                                                        opacity: 0,
                                                                    }}
                                                                    transition={{
                                                                        duration: 0.15,
                                                                    }}
                                                                />
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.button>
                                                </div>

                                                {/* Name */}
                                                <button
                                                    className='truncate text-left font-rajdhani font-semibold text-grimoire-text-base hover:text-grimoire-primary-light hover:underline underline-offset-2 transition-colors'
                                                    onClick={() =>
                                                        setSelectedSpell(spell)
                                                    }
                                                >
                                                    {spell.name}
                                                </button>

                                                {/* Concentration */}
                                                <div className='flex justify-center'>
                                                    {spell.concentration ? (
                                                        <span
                                                            title='Concentration'
                                                            className='relative flex h-5 w-5 items-center justify-center'
                                                            style={{
                                                                transform:
                                                                    "rotate(45deg)",
                                                            }}
                                                        >
                                                            <span className='absolute inset-0 rounded-sm border border-blue-500/60 bg-blue-500/15' />
                                                            <span
                                                                className='relative font-mono text-[10px] font-bold text-blue-400'
                                                                style={{
                                                                    transform:
                                                                        "rotate(-45deg)",
                                                                }}
                                                            >
                                                                C
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className='font-mono text-[10px] text-grimoire-text-faint/40'>
                                                            —
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Duration */}
                                                <p className='truncate font-rajdhani text-xs text-grimoire-text-muted'>
                                                    {spell.duration}
                                                </p>

                                                {/* Source */}
                                                <p
                                                    className='truncate font-rajdhani text-xs text-grimoire-text-faint'
                                                    title={spell.source}
                                                >
                                                    {spell.source ?? (
                                                        <span className='text-grimoire-text-faint/40'>
                                                            —
                                                        </span>
                                                    )}
                                                </p>

                                                {/* Notes — inline edit */}
                                                <div className='min-w-0'>
                                                    {editingNoteId ===
                                                    spell.spellId ? (
                                                        <input
                                                            autoFocus
                                                            value={noteValue}
                                                            onChange={(e) =>
                                                                setNoteValue(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            onBlur={() =>
                                                                saveNote(
                                                                    spell.spellId,
                                                                )
                                                            }
                                                            onKeyDown={(e) => {
                                                                if (
                                                                    e.key ===
                                                                    "Enter"
                                                                )
                                                                    saveNote(
                                                                        spell.spellId,
                                                                    )
                                                                if (
                                                                    e.key ===
                                                                    "Escape"
                                                                )
                                                                    setEditingNoteId(
                                                                        null,
                                                                    )
                                                            }}
                                                            placeholder='Add a note…'
                                                            className='w-full rounded border border-grimoire-primary/50 bg-grimoire-surface px-1.5 py-0.5 font-rajdhani text-xs text-grimoire-text-base outline-none'
                                                        />
                                                    ) : (
                                                        <button
                                                            className='group/note flex w-full items-center gap-1 truncate text-left'
                                                            onClick={() =>
                                                                startEditNote(
                                                                    spell.spellId,
                                                                )
                                                            }
                                                            title={
                                                                character
                                                                    .spellNotes?.[
                                                                    spell
                                                                        .spellId
                                                                ] ??
                                                                "Click to add a note"
                                                            }
                                                        >
                                                            {character
                                                                .spellNotes?.[
                                                                spell.spellId
                                                            ] ? (
                                                                <span className='truncate font-rajdhani text-xs text-grimoire-text-muted'>
                                                                    {
                                                                        character
                                                                            .spellNotes[
                                                                            spell
                                                                                .spellId
                                                                        ]
                                                                    }
                                                                </span>
                                                            ) : (
                                                                <span className='font-rajdhani text-xs text-grimoire-text-faint/40 opacity-0 transition-opacity group-hover:opacity-100'>
                                                                    Add note…
                                                                </span>
                                                            )}
                                                            <Pencil
                                                                size={10}
                                                                className='flex-shrink-0 text-grimoire-text-faint/40 opacity-0 transition-opacity group-hover/note:opacity-100'
                                                            />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Remove */}
                                                <motion.button
                                                    className='flex-shrink-0 rounded-md p-1 text-grimoire-text-faint opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all'
                                                    whileHover={{ scale: 1.15 }}
                                                    whileTap={{ scale: 0.85 }}
                                                    onClick={() =>
                                                        handleRemoveSpell(
                                                            spell.spellId,
                                                        )
                                                    }
                                                    title='Remove from spellbook'
                                                >
                                                    <X size={13} />
                                                </motion.button>
                                            </motion.div>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Spell Detail Drawer */}
            <Drawer
                side='left'
                isOpen={!!selectedSpell}
                onClose={() => setSelectedSpell(null)}
                title={selectedSpell?.name}
                width='w-full max-w-md'
                layer='overlay'
            >
                {selectedSpell && <SpellInfoPanel spell={selectedSpell} />}
            </Drawer>

            {/* Prepared Spells Drawer */}
            <Drawer
                side='right'
                isOpen={showPreparedDrawer}
                onClose={() => setShowPreparedDrawer(false)}
                title={`Prepared Spells (${preparedSpells.length})`}
                width='w-full max-w-sm'
            >
                {preparedSpells.length === 0 ? (
                    <p className='py-8 text-center font-rajdhani text-grimoire-text-faint'>
                        No spells prepared.
                    </p>
                ) : (
                    <div className='space-y-4'>
                        {(() => {
                            const groupedPrepared = groupByLevel(preparedSpells)
                            const levels = [...groupedPrepared.keys()].sort(
                                (a, b) => a - b,
                            )

                            return levels.map((level) => {
                                const spells = [
                                    ...(groupedPrepared.get(level) ?? []),
                                ].sort((a, b) => a.name.localeCompare(b.name))

                                return (
                                    <div key={level} className='space-y-1'>
                                        <h4 className='font-cinzel text-[11px] uppercase tracking-widest text-grimoire-text-faint'>
                                            {spellLevelLabel(level)}
                                        </h4>
                                        {spells.map((spell) => (
                                            <motion.button
                                                key={spell.spellId}
                                                className='flex w-full items-center gap-3 rounded-lg border border-grimoire-border/60 bg-grimoire-card/60 px-3 py-2.5 text-left transition-colors hover:bg-grimoire-primary/10 hover:border-grimoire-primary/40'
                                                whileHover={{ x: 2 }}
                                                onClick={() => {
                                                    setSelectedSpell(spell)
                                                }}
                                            >
                                                <SchoolBadge
                                                    school={spell.school}
                                                    size='xs'
                                                />
                                                <span className='flex-1 font-rajdhani font-semibold text-grimoire-text-base'>
                                                    {spell.name}
                                                </span>
                                                <span className='font-rajdhani text-xs text-grimoire-text-faint'>
                                                    {spellLevelLabel(
                                                        spell.level,
                                                    )}
                                                </span>
                                            </motion.button>
                                        ))}
                                    </div>
                                )
                            })
                        })()}
                    </div>
                )}
            </Drawer>

            {/* Add Spell Drawer */}
            <Drawer
                side='right'
                isOpen={showAddModal}
                onClose={closeAddModal}
                title='Add Spell to Spellbook'
                width='w-full max-w-md'
                footer={
                    pendingSpellIds.size > 0 ? (
                        <motion.button
                            onClick={handleAddSelected}
                            className='flex w-full items-center justify-center gap-2 rounded-lg border border-grimoire-primary/50 bg-grimoire-primary/15 py-2.5 font-rajdhani text-sm font-semibold text-grimoire-primary-light transition-colors hover:bg-grimoire-primary/25'
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <Plus size={15} />
                            Add {pendingSpellIds.size} spell
                            {pendingSpellIds.size !== 1 ? "s" : ""}
                        </motion.button>
                    ) : null
                }
            >
                <div className='space-y-3'>
                    {/* Search + filter toggle row */}
                    <div className='flex gap-2'>
                        <div className='relative flex-1'>
                            <Search
                                size={14}
                                className='absolute left-3 top-1/2 -translate-y-1/2 text-grimoire-text-faint'
                            />
                            <input
                                value={addSearch}
                                onChange={(e) => setAddSearch(e.target.value)}
                                placeholder='Search spells…'
                                className='w-full rounded-lg border border-grimoire-border bg-grimoire-surface pl-9 pr-3 py-2 font-rajdhani text-grimoire-text-base placeholder-grimoire-text-faint outline-none focus:border-grimoire-primary/60'
                                autoFocus
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters((v) => !v)}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 font-rajdhani text-sm transition-colors ${
                                showFilters || hasActiveFilters
                                    ? "border-grimoire-primary/60 bg-grimoire-primary/15 text-grimoire-primary-light"
                                    : "border-grimoire-border text-grimoire-text-muted hover:border-grimoire-primary/40 hover:text-grimoire-text-base"
                            }`}
                        >
                            <SlidersHorizontal size={13} />
                            Filters
                            {hasActiveFilters && (
                                <span className='ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-grimoire-primary text-[9px] text-white'>
                                    {filterSchools.length +
                                        filterLevels.length +
                                        filterClasses.length +
                                        filterSources.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Filter + sort panel */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.18 }}
                                className='overflow-hidden'
                            >
                                <div className='space-y-3 rounded-lg border border-grimoire-border/60 bg-grimoire-surface/60 p-3'>
                                    {/* Sort */}
                                    <div className='flex items-center gap-2'>
                                        <span className='w-14 font-rajdhani text-xs text-grimoire-text-faint'>
                                            Sort
                                        </span>
                                        <div className='relative flex-1'>
                                            <select
                                                value={sortBy}
                                                onChange={(e) =>
                                                    setSortBy(
                                                        e.target
                                                            .value as SortOption,
                                                    )
                                                }
                                                className='w-full appearance-none rounded-lg border border-grimoire-border bg-grimoire-card px-3 py-1.5 pr-7 font-rajdhani text-sm text-grimoire-text-base outline-none focus:border-grimoire-primary/60'
                                            >
                                                <option value='name-asc'>
                                                    Name A → Z
                                                </option>
                                                <option value='name-desc'>
                                                    Name Z → A
                                                </option>
                                                <option value='level-asc'>
                                                    Level (low → high)
                                                </option>
                                                <option value='level-desc'>
                                                    Level (high → low)
                                                </option>
                                            </select>
                                            <ChevronDown
                                                size={12}
                                                className='pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-grimoire-text-faint'
                                            />
                                        </div>
                                    </div>

                                    {/* Level */}
                                    <div className='flex items-start gap-2'>
                                        <span className='mt-1 w-14 font-rajdhani text-xs text-grimoire-text-faint'>
                                            Level
                                        </span>
                                        <div className='flex flex-wrap gap-1'>
                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(
                                                (lvl) => (
                                                    <button
                                                        key={lvl}
                                                        onClick={() =>
                                                            setFilterLevels(
                                                                (prev) =>
                                                                    toggleInList(
                                                                        prev,
                                                                        lvl,
                                                                    ),
                                                            )
                                                        }
                                                        className={`rounded border px-2 py-0.5 font-mono text-xs transition-colors ${
                                                            filterLevels.includes(
                                                                lvl,
                                                            )
                                                                ? "border-grimoire-primary bg-grimoire-primary/20 text-grimoire-primary-light"
                                                                : "border-grimoire-border text-grimoire-text-faint hover:border-grimoire-primary/40"
                                                        }`}
                                                    >
                                                        {lvl === 0 ? "C" : lvl}
                                                    </button>
                                                ),
                                            )}
                                        </div>
                                    </div>

                                    {/* School */}
                                    <div className='flex items-start gap-2'>
                                        <span className='mt-1 w-14 font-rajdhani text-xs text-grimoire-text-faint'>
                                            School
                                        </span>
                                        <div className='flex flex-wrap gap-1'>
                                            {SPELL_SCHOOLS.map((school) => (
                                                <button
                                                    key={school}
                                                    onClick={() =>
                                                        setFilterSchools(
                                                            (prev) =>
                                                                toggleInList(
                                                                    prev,
                                                                    school,
                                                                ),
                                                        )
                                                    }
                                                    className={`rounded border px-2 py-0.5 font-rajdhani text-xs transition-colors ${
                                                        filterSchools.includes(
                                                            school,
                                                        )
                                                            ? "border-grimoire-primary bg-grimoire-primary/20 text-grimoire-primary-light"
                                                            : "border-grimoire-border text-grimoire-text-faint hover:border-grimoire-primary/40"
                                                    }`}
                                                >
                                                    {school}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Class */}
                                    <div className='flex items-start gap-2'>
                                        <span className='mt-1 w-14 font-rajdhani text-xs text-grimoire-text-faint'>
                                            Class
                                        </span>
                                        <div className='flex flex-wrap gap-1'>
                                            {DND_CLASSES.map((cls) => (
                                                <button
                                                    key={cls}
                                                    onClick={() =>
                                                        setFilterClasses(
                                                            (prev) =>
                                                                toggleInList(
                                                                    prev,
                                                                    cls,
                                                                ),
                                                        )
                                                    }
                                                    className={`rounded border px-2 py-0.5 font-rajdhani text-xs transition-colors ${
                                                        filterClasses.includes(
                                                            cls,
                                                        )
                                                            ? "border-grimoire-primary bg-grimoire-primary/20 text-grimoire-primary-light"
                                                            : "border-grimoire-border text-grimoire-text-faint hover:border-grimoire-primary/40"
                                                    }`}
                                                >
                                                    {cls}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Source */}
                                    {uniqueSources.length > 0 && (
                                        <div className='flex items-start gap-2'>
                                            <span className='mt-1 w-14 font-rajdhani text-xs text-grimoire-text-faint'>
                                                Source
                                            </span>
                                            <div className='flex flex-wrap gap-1'>
                                                {uniqueSources.map((src) => (
                                                    <button
                                                        key={src}
                                                        onClick={() =>
                                                            setFilterSources(
                                                                (prev) =>
                                                                    toggleInList(
                                                                        prev,
                                                                        src,
                                                                    ),
                                                            )
                                                        }
                                                        className={`rounded border px-2 py-0.5 font-rajdhani text-xs transition-colors ${
                                                            filterSources.includes(
                                                                src,
                                                            )
                                                                ? "border-grimoire-primary bg-grimoire-primary/20 text-grimoire-primary-light"
                                                                : "border-grimoire-border text-grimoire-text-faint hover:border-grimoire-primary/40"
                                                        }`}
                                                    >
                                                        {src}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Clear + select-all row */}
                                    <div className='flex items-center gap-3'>

                                        {hasActiveFilters && (
                                            <button
                                                onClick={clearModalFilters}
                                                className='font-rajdhani text-xs text-grimoire-text-faint hover:text-grimoire-text-muted underline underline-offset-2 transition-colors'
                                            >
                                                Clear filters
                                            </button>
                                        )}
                                        {addableSuggestions.length > 0 && (
                                            <button
                                                onClick={() =>
                                                    setPendingSpellIds(
                                                        new Set(
                                                            addableSuggestions.map(
                                                                (s) =>
                                                                    s.spellId,
                                                            ),
                                                        ),
                                                    )
                                                }
                                                className='ml-auto font-rajdhani text-xs text-grimoire-primary-light hover:underline underline-offset-2 transition-colors'
                                            >
                                                Select all (
                                                {addableSuggestions.length})
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Results */}
                    <div className='space-y-4'>
                        {addableSuggestions.length === 0 ? (
                            <p className='py-6 text-center font-rajdhani text-grimoire-text-faint'>
                                {addSearch || hasActiveFilters
                                    ? "No matching spells found."
                                    : "All spells already added."}
                            </p>
                        ) : (
                            (() => {
                                const grouped = groupByLevel(addableSuggestions)
                                const levels = Array.from(grouped.keys()).sort(
                                    (a, b) => a - b,
                                )
                                return levels.map((level) => {
                                    const spells = grouped.get(level)!
                                    return (
                                        <div key={level}>
                                            <h4 className='mb-1.5 font-cinzel text-[10px] uppercase tracking-widest text-grimoire-text-faint border-b border-grimoire-border/40 pb-1'>
                                                {spellLevelLabel(level)}
                                            </h4>
                                            <div className='space-y-1'>
                                                {spells.map((spell) => {
                                                    const isPending =
                                                        pendingSpellIds.has(
                                                            spell.spellId,
                                                        )
                                                    return (
                                                        <motion.button
                                                            key={spell.spellId}
                                                            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                                                isPending
                                                                    ? "border-grimoire-primary/60 bg-grimoire-primary/15"
                                                                    : "border-grimoire-border/60 bg-grimoire-card/60 hover:bg-grimoire-primary/10 hover:border-grimoire-primary/40"
                                                            }`}
                                                            whileHover={{
                                                                x: 2,
                                                            }}
                                                            onClick={() =>
                                                                togglePending(
                                                                    spell.spellId,
                                                                )
                                                            }
                                                        >
                                                            {/* Checkbox */}
                                                            <span className='flex-shrink-0'>
                                                                <AnimatePresence
                                                                    mode='wait'
                                                                    initial={
                                                                        false
                                                                    }
                                                                >
                                                                    {isPending ? (
                                                                        <motion.span
                                                                            key='checked'
                                                                            className='flex h-5 w-5 items-center justify-center rounded-full bg-blue-500'
                                                                            initial={{
                                                                                scale: 0.5,
                                                                                opacity: 0,
                                                                            }}
                                                                            animate={{
                                                                                scale: 1,
                                                                                opacity: 1,
                                                                            }}
                                                                            exit={{
                                                                                scale: 0.5,
                                                                                opacity: 0,
                                                                            }}
                                                                            transition={{
                                                                                duration: 0.12,
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                size={
                                                                                    11
                                                                                }
                                                                                strokeWidth={
                                                                                    3
                                                                                }
                                                                                className='text-white'
                                                                            />
                                                                        </motion.span>
                                                                    ) : (
                                                                        <motion.span
                                                                            key='unchecked'
                                                                            className='flex h-5 w-5 items-center justify-center rounded-full border-2 border-grimoire-border/60'
                                                                            initial={{
                                                                                scale: 0.5,
                                                                                opacity: 0,
                                                                            }}
                                                                            animate={{
                                                                                scale: 1,
                                                                                opacity: 1,
                                                                            }}
                                                                            exit={{
                                                                                scale: 0.5,
                                                                                opacity: 0,
                                                                            }}
                                                                            transition={{
                                                                                duration: 0.12,
                                                                            }}
                                                                        />
                                                                    )}
                                                                </AnimatePresence>
                                                            </span>
                                                            <SchoolBadge
                                                                school={
                                                                    spell.school
                                                                }
                                                                size='xs'
                                                            />
                                                            <span className='flex-1 font-rajdhani font-semibold text-grimoire-text-base'>
                                                                {spell.name}
                                                            </span>
                                                        </motion.button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })
                            })()
                        )}
                    </div>
                </div>
            </Drawer>
        </div>
    )
}
