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
} from "lucide-react"
import { useSpells } from "@/hooks/useSpells"
import {
    useAddKnownSpell,
    useRemoveKnownSpell,
    useTogglePreparedSpell,
    useUpdateSpellNote,
} from "@/hooks/useCharacters"
import SchoolBadge from "@/components/spells/SchoolBadge"
import Modal from "@/components/shared/Modal"
import Drawer from "@/components/shared/Drawer"
import SpellInfoPanel from "@/components/spells/SpellInfoPanel"
import { spellLevelLabel, SPELL_SCHOOLS, DND_CLASSES } from "@/types/spell"
import type { Character } from "@/types/character"
import type { Spell, SpellSchool, DndClass } from "@/types/spell"

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
    const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null)
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
    const [noteValue, setNoteValue] = useState("")
    const [filterSchool, setFilterSchool] = useState<SpellSchool | "">("")
    const [filterLevel, setFilterLevel] = useState<number | "">("")
    const [filterClass, setFilterClass] = useState<DndClass | "">("")
    const [sortBy, setSortBy] = useState<SortOption>("name-asc")
    const [showFilters, setShowFilters] = useState(false)

    const { data: allSpells = [] } = useSpells()
    const addKnownSpell = useAddKnownSpell()
    const removeKnownSpell = useRemoveKnownSpell()
    const togglePrepared = useTogglePreparedSpell()
    const updateSpellNote = useUpdateSpellNote()

    // Resolve known spells from allSpells
    const knownSpells = allSpells.filter((s) =>
        character.knownSpellIds.includes(s.spellId),
    )
    const isPrepared = (spellId: string) =>
        character.preparedSpellIds.includes(spellId)

    const grouped = groupByLevel(knownSpells)
    const sortedLevels = [...grouped.keys()].sort((a, b) => a - b)

    // Spells available to add (not already known), filtered + sorted
    const addableSuggestions = useMemo(() => {
        let results = allSpells.filter(
            (s) => !character.knownSpellIds.includes(s.spellId),
        )
        if (addSearch.trim())
            results = results.filter((s) =>
                s.name.toLowerCase().includes(addSearch.toLowerCase()),
            )
        if (filterSchool)
            results = results.filter((s) => s.school === filterSchool)
        if (filterLevel !== "")
            results = results.filter((s) => s.level === filterLevel)
        if (filterClass)
            results = results.filter((s) => s.classes?.includes(filterClass))
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
        filterSchool,
        filterLevel,
        filterClass,
        sortBy,
    ])

    const hasActiveFilters =
        filterSchool !== "" || filterLevel !== "" || filterClass !== ""

    function clearModalFilters() {
        setFilterSchool("")
        setFilterLevel("")
        setFilterClass("")
    }

    function closeAddModal() {
        setShowAddModal(false)
        setAddSearch("")
        setShowFilters(false)
        clearModalFilters()
    }

    function handleAddSpell(spell: Spell) {
        // Close immediately — cache update in onMutate gives instant feedback
        closeAddModal()
        addKnownSpell.mutate({
            characterId: character.characterId,
            character,
            spellId: spell.spellId,
        })
    }

    function handleRemoveSpell(spellId: string) {
        removeKnownSpell.mutate({
            characterId: character.characterId,
            character,
            spellId,
        })
    }

    function handleToggle(spellId: string) {
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
            <div className='flex items-center justify-between'>
                <h3 className='font-cinzel text-xl font-bold text-grimoire-text-base'>
                    Spellbook
                    <span className='ml-3 font-mono text-sm text-grimoire-text-faint'>
                        {knownSpells.length} known ·{" "}
                        {character.preparedSpellIds.length} prepared
                    </span>
                </h3>
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
                    <div className='grid grid-cols-[2rem_1fr_5rem_7rem_6rem_minmax(8rem,1fr)_2rem] items-center gap-x-3 border-b border-grimoire-border bg-grimoire-surface/70 px-3 py-2'>
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
                                    {spells.map((spell, si) => (
                                        <motion.div
                                            key={spell.spellId}
                                            className={`group grid grid-cols-[2rem_1fr_5rem_7rem_6rem_minmax(8rem,1fr)_2rem] items-center gap-x-3 px-3 py-2.5 transition-colors hover:bg-grimoire-primary/5 ${si < spells.length - 1 ? "border-b border-grimoire-border/30" : ""}`}
                                            initial={{ opacity: 0, x: -6 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 6 }}
                                            layout
                                        >
                                            {/* Prepared bubble */}
                                            <div className='flex justify-center'>
                                                <motion.button
                                                    className='rounded-full focus:outline-none'
                                                    whileHover={{ scale: 1.15 }}
                                                    whileTap={{ scale: 0.85 }}
                                                    onClick={() =>
                                                        handleToggle(
                                                            spell.spellId,
                                                        )
                                                    }
                                                    title={
                                                        isPrepared(
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
                                                                    size={11}
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
                                                    <span className='rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] text-blue-400'>
                                                        Yes
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
                                                                e.target.value,
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
                                                                spell.spellId
                                                            ] ??
                                                            "Click to add a note"
                                                        }
                                                    >
                                                        {character.spellNotes?.[
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
                                    ))}
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
            >
                {selectedSpell && <SpellInfoPanel spell={selectedSpell} />}
            </Drawer>

            {/* Add Spell Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={closeAddModal}
                title='Add Spell to Spellbook'
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
                                    {
                                        [
                                            filterSchool,
                                            filterLevel !== "",
                                            filterClass,
                                        ].filter(Boolean).length
                                    }
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
                                                            setFilterLevel(
                                                                filterLevel ===
                                                                    lvl
                                                                    ? ""
                                                                    : lvl,
                                                            )
                                                        }
                                                        className={`rounded border px-2 py-0.5 font-mono text-xs transition-colors ${
                                                            filterLevel === lvl
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
                                                        setFilterSchool(
                                                            filterSchool ===
                                                                school
                                                                ? ""
                                                                : school,
                                                        )
                                                    }
                                                    className={`rounded border px-2 py-0.5 font-rajdhani text-xs transition-colors ${
                                                        filterSchool === school
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
                                                        setFilterClass(
                                                            filterClass === cls
                                                                ? ""
                                                                : cls,
                                                        )
                                                    }
                                                    className={`rounded border px-2 py-0.5 font-rajdhani text-xs transition-colors ${
                                                        filterClass === cls
                                                            ? "border-grimoire-primary bg-grimoire-primary/20 text-grimoire-primary-light"
                                                            : "border-grimoire-border text-grimoire-text-faint hover:border-grimoire-primary/40"
                                                    }`}
                                                >
                                                    {cls}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Clear */}
                                    {hasActiveFilters && (
                                        <button
                                            onClick={clearModalFilters}
                                            className='font-rajdhani text-xs text-grimoire-text-faint hover:text-grimoire-text-muted underline underline-offset-2 transition-colors'
                                        >
                                            Clear filters
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Results */}
                    <div className='max-h-72 space-y-1 overflow-y-auto pr-1'>
                        {addableSuggestions.length === 0 ? (
                            <p className='py-6 text-center font-rajdhani text-grimoire-text-faint'>
                                {addSearch || hasActiveFilters
                                    ? "No matching spells found."
                                    : "All spells already added."}
                            </p>
                        ) : (
                            addableSuggestions.map((spell) => (
                                <motion.button
                                    key={spell.spellId}
                                    className='flex w-full items-center gap-3 rounded-lg border border-grimoire-border/60 bg-grimoire-card/60 px-3 py-2.5 text-left hover:bg-grimoire-primary/10 hover:border-grimoire-primary/40 transition-colors'
                                    whileHover={{ x: 2 }}
                                    onClick={() => handleAddSpell(spell)}
                                >
                                    <SchoolBadge
                                        school={spell.school}
                                        size='xs'
                                    />
                                    <span className='flex-1 font-rajdhani font-semibold text-grimoire-text-base'>
                                        {spell.name}
                                    </span>
                                    <span className='font-rajdhani text-xs text-grimoire-text-faint'>
                                        {spellLevelLabel(spell.level)}
                                    </span>
                                </motion.button>
                            ))
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    )
}
