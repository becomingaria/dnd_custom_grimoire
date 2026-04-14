import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Filter, SlidersHorizontal, PlusCircle, X } from "lucide-react"
import type { Spell, SpellSchool, DndClass } from "@/types/spell"
import { SPELL_SCHOOLS, DND_CLASSES } from "@/types/spell"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import SpellCard from "./SpellCard"
import LoadingSpinner from "@/components/shared/LoadingSpinner"

interface SpellListProps {
    spells: Spell[]
    isLoading?: boolean
    onCreateSpell?: () => void
    onSelectSpell?: (spell: Spell) => void
}

export default function SpellList({
    spells,
    isLoading,
    onCreateSpell,
    onSelectSpell,
}: SpellListProps) {
    const [search, setSearch] = useState("")
    const [selectedSchool, setSchool] = useLocalStorage<SpellSchool | "all">(
        "grimoire:spells:school",
        "all",
    )
    const [selectedLevel, setLevel] = useLocalStorage<number | "all">(
        "grimoire:spells:level",
        "all",
    )
    const [selectedSource, setSource] = useLocalStorage<string>(
        "grimoire:spells:source",
        "all",
    )
    const [selectedClass, setClass] = useLocalStorage<DndClass | "all">(
        "grimoire:spells:class",
        "all",
    )
    const [showFilters, setShowFilters] = useLocalStorage<boolean>(
        "grimoire:spells:showFilters",
        false,
    )

    const uniqueSources = Array.from(
        new Set(spells.map((s) => s.source).filter(Boolean)),
    ).sort()

    const filtered = spells.filter((s) => {
        if (search && !s.name.toLowerCase().includes(search.toLowerCase()))
            return false
        if (selectedSchool !== "all" && s.school !== selectedSchool)
            return false
        if (selectedLevel !== "all" && s.level !== selectedLevel) return false
        if (selectedSource !== "all" && s.source !== selectedSource)
            return false
        if (selectedClass !== "all" && !s.classes?.includes(selectedClass))
            return false
        return true
    })

    const clearFilters = () => {
        setSearch("")
        setSchool("all")
        setLevel("all")
        setSource("all")
        setClass("all")
    }

    const hasFilters =
        search ||
        selectedSchool !== "all" ||
        selectedLevel !== "all" ||
        selectedSource !== "all" ||
        selectedClass !== "all"

    return (
        <div className='space-y-6'>
            {/* Toolbar */}
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
                {/* Search */}
                <div className='relative flex-1'>
                    <Search
                        size={16}
                        className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-grimoire-text-faint'
                    />
                    <input
                        type='text'
                        placeholder='Search spells...'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className='w-full rounded-lg border border-grimoire-border bg-grimoire-surface py-2.5 pl-9 pr-4 font-rajdhani text-sm text-grimoire-text-base placeholder:text-grimoire-text-faint focus:border-grimoire-primary/50 focus:outline-none focus:ring-1 focus:ring-grimoire-primary/30'
                    />
                </div>

                {/* Filter toggle */}
                <button
                    onClick={() => setShowFilters((p) => !p)}
                    className={[
                        "flex items-center gap-2 rounded-lg border px-4 py-2.5 font-rajdhani text-sm font-medium transition-colors",
                        showFilters
                            ? "border-grimoire-primary/50 bg-grimoire-primary/10 text-grimoire-primary-light"
                            : "border-grimoire-border bg-grimoire-surface text-grimoire-text-muted hover:text-grimoire-text-base",
                    ].join(" ")}
                >
                    <SlidersHorizontal size={16} />
                    Filters
                    {hasFilters && (
                        <span className='flex h-4 w-4 items-center justify-center rounded-full bg-grimoire-primary text-[10px] text-white'>
                            !
                        </span>
                    )}
                </button>

                {/* Create button */}
                {onCreateSpell && (
                    <motion.button
                        onClick={onCreateSpell}
                        className='flex items-center gap-2 rounded-lg border border-grimoire-primary/40 bg-grimoire-primary/10 px-4 py-2.5 font-rajdhani text-sm font-semibold text-grimoire-primary-light transition-colors hover:border-grimoire-primary/70 hover:bg-grimoire-primary/20'
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                    >
                        <PlusCircle size={16} />
                        New Spell
                    </motion.button>
                )}
            </div>

            {/* Filter drawer */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        key='filters'
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className='overflow-hidden'
                    >
                        <div className='flex flex-wrap gap-3 rounded-xl border border-grimoire-border bg-grimoire-card p-4'>
                            {/* School filter */}
                            <div className='flex flex-col gap-1.5'>
                                <label className='font-rajdhani text-xs font-semibold uppercase tracking-widest text-grimoire-text-faint'>
                                    School
                                </label>
                                <div className='flex flex-wrap gap-1.5'>
                                    {(["all", ...SPELL_SCHOOLS] as const).map(
                                        (school) => (
                                            <button
                                                key={school}
                                                onClick={() =>
                                                    setSchool(school)
                                                }
                                                className={[
                                                    "rounded px-2.5 py-1 font-rajdhani text-xs font-medium capitalize transition-colors",
                                                    selectedSchool === school
                                                        ? "border border-grimoire-primary/50 bg-grimoire-primary/15 text-grimoire-primary-light"
                                                        : "border border-grimoire-border/60 bg-grimoire-surface text-grimoire-text-muted hover:text-grimoire-text-base",
                                                ].join(" ")}
                                            >
                                                {school === "all"
                                                    ? "All Schools"
                                                    : school}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>

                            {/* Level filter */}
                            <div className='flex flex-col gap-1.5'>
                                <label className='font-rajdhani text-xs font-semibold uppercase tracking-widest text-grimoire-text-faint'>
                                    Level
                                </label>
                                <div className='flex flex-wrap gap-1.5'>
                                    {(
                                        [
                                            "all",
                                            0,
                                            1,
                                            2,
                                            3,
                                            4,
                                            5,
                                            6,
                                            7,
                                            8,
                                            9,
                                        ] as const
                                    ).map((lvl) => (
                                        <button
                                            key={lvl}
                                            onClick={() => setLevel(lvl)}
                                            className={[
                                                "rounded px-2.5 py-1 font-rajdhani text-xs font-medium transition-colors",
                                                selectedLevel === lvl
                                                    ? "border border-grimoire-primary/50 bg-grimoire-primary/15 text-grimoire-primary-light"
                                                    : "border border-grimoire-border/60 bg-grimoire-surface text-grimoire-text-muted hover:text-grimoire-text-base",
                                            ].join(" ")}
                                        >
                                            {lvl === "all"
                                                ? "All"
                                                : lvl === 0
                                                  ? "Cantrip"
                                                  : `L${lvl}`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Source filter */}
                            {uniqueSources.length > 0 && (
                                <div className='flex flex-col gap-1.5'>
                                    <label className='font-rajdhani text-xs font-semibold uppercase tracking-widest text-grimoire-text-faint'>
                                        Source
                                    </label>
                                    <div className='flex flex-wrap gap-1.5'>
                                        {["all", ...uniqueSources].map(
                                            (src) => (
                                                <button
                                                    key={src}
                                                    onClick={() =>
                                                        setSource(src)
                                                    }
                                                    className={[
                                                        "rounded px-2.5 py-1 font-rajdhani text-xs font-medium transition-colors",
                                                        selectedSource === src
                                                            ? "border border-grimoire-primary/50 bg-grimoire-primary/15 text-grimoire-primary-light"
                                                            : "border border-grimoire-border/60 bg-grimoire-surface text-grimoire-text-muted hover:text-grimoire-text-base",
                                                    ].join(" ")}
                                                >
                                                    {src === "all"
                                                        ? "All Sources"
                                                        : src}
                                                </button>
                                            ),
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Class filter */}
                            <div className='flex flex-col gap-1.5'>
                                <label className='font-rajdhani text-xs font-semibold uppercase tracking-widest text-grimoire-text-faint'>
                                    Class
                                </label>
                                <div className='flex flex-wrap gap-1.5'>
                                    {(["all", ...DND_CLASSES] as const).map(
                                        (cls) => (
                                            <button
                                                key={cls}
                                                onClick={() => setClass(cls)}
                                                className={[
                                                    "rounded px-2.5 py-1 font-rajdhani text-xs font-medium capitalize transition-colors",
                                                    selectedClass === cls
                                                        ? "border border-grimoire-primary/50 bg-grimoire-primary/15 text-grimoire-primary-light"
                                                        : "border border-grimoire-border/60 bg-grimoire-surface text-grimoire-text-muted hover:text-grimoire-text-base",
                                                ].join(" ")}
                                            >
                                                {cls === "all"
                                                    ? "All Classes"
                                                    : cls}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>

                            {/* Clear */}
                            {hasFilters && (
                                <button
                                    onClick={clearFilters}
                                    className='ml-auto flex items-center gap-1.5 self-end rounded px-3 py-1.5 font-rajdhani text-xs text-grimoire-text-muted hover:text-grimoire-danger'
                                >
                                    <X size={12} />
                                    Clear
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Count */}
            <div className='flex items-center justify-between'>
                <p className='font-rajdhani text-sm text-grimoire-text-muted'>
                    {isLoading
                        ? "Loading spells…"
                        : `${filtered.length} spell${filtered.length !== 1 ? "s" : ""} found`}
                </p>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className='flex min-h-64 items-center justify-center'>
                    <LoadingSpinner label='Consulting the arcane tomes…' />
                </div>
            ) : filtered.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className='flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-grimoire-border/60 text-center'
                >
                    <Filter size={32} className='text-grimoire-text-faint' />
                    <p className='font-rajdhani text-lg text-grimoire-text-muted'>
                        No spells found
                    </p>
                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            className='font-rajdhani text-sm text-grimoire-primary-light hover:underline'
                        >
                            Clear filters
                        </button>
                    )}
                </motion.div>
            ) : (
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                    {filtered.map((spell, i) => (
                        <SpellCard
                            key={spell.spellId}
                            spell={spell}
                            index={i}
                            onSelect={onSelectSpell}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
