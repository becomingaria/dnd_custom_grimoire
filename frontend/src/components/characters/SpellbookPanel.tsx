import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, StarOff, Plus, X, Search, BookOpen } from 'lucide-react';
import { useSpells } from '@/hooks/useSpells';
import { useTogglePreparedSpell } from '@/hooks/useCharacters';
import SchoolBadge from '@/components/spells/SchoolBadge';
import Modal from '@/components/shared/Modal';
import { spellLevelLabel } from '@/types/spell';
import type { Character } from '@/types/character';
import type { Spell } from '@/types/spell';

interface SpellbookPanelProps {
  character: Character;
}

function groupByLevel(spells: Spell[]): Map<number, Spell[]> {
  const map = new Map<number, Spell[]>();
  for (const spell of spells) {
    const arr = map.get(spell.level) ?? [];
    arr.push(spell);
    map.set(spell.level, arr);
  }
  return map;
}

export default function SpellbookPanel({ character }: SpellbookPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  const { data: allSpells = [] } = useSpells();
  const togglePrepared = useTogglePreparedSpell();

  // Resolve known spells from allSpells
  const knownSpells = allSpells.filter((s) => character.knownSpellIds.includes(s.spellId));
  const isPrepared = (spellId: string) => character.preparedSpellIds.includes(spellId);

  const grouped = groupByLevel(knownSpells);
  const sortedLevels = [...grouped.keys()].sort((a, b) => a - b);

  // Spells available to add (not already known)
  const addableSuggestions = allSpells.filter(
    (s) =>
      !character.knownSpellIds.includes(s.spellId) &&
      (addSearch.trim() === '' ||
        s.name.toLowerCase().includes(addSearch.toLowerCase()))
  );

  async function handleAddSpell(spell: Spell) {
    // Use the characters API directly via invalidation helper
    // We'll call characters API add spell endpoint
    const { charactersApi } = await import('@/api/characters');
    await charactersApi.addKnownSpell(character.characterId, character, spell.spellId);
    setShowAddModal(false);
    setAddSearch('');
  }

  async function handleRemoveSpell(spellId: string) {
    const { charactersApi } = await import('@/api/characters');
    await charactersApi.removeKnownSpell(character.characterId, character, spellId);
  }

  function handleToggle(spellId: string) {
    togglePrepared.mutate({ characterId: character.characterId, spellId });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-cinzel text-xl font-bold text-grimoire-text-base">
          Spellbook
          <span className="ml-3 font-mono text-sm text-grimoire-text-faint">
            {knownSpells.length} known · {character.preparedSpellIds.length} prepared
          </span>
        </h3>
        <motion.button
          className="flex items-center gap-2 rounded-lg border border-grimoire-primary/50 bg-grimoire-primary/10 px-3 py-1.5 font-rajdhani text-sm text-grimoire-primary-light hover:bg-grimoire-primary/20 transition-colors"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={14} />
          Add Spell
        </motion.button>
      </div>

      {knownSpells.length === 0 ? (
        <motion.div
          className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-grimoire-border text-grimoire-text-faint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <BookOpen size={32} strokeWidth={1} />
          <p className="font-rajdhani">No spells in spellbook yet.</p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {sortedLevels.map((level) => {
            const spells = grouped.get(level)!;
            return (
              <div key={level}>
                <h4 className="mb-2 font-cinzel text-sm font-bold uppercase tracking-widest text-grimoire-text-faint border-b border-grimoire-border pb-1">
                  {spellLevelLabel(level)}
                </h4>
                <div className="space-y-2">
                  <AnimatePresence>
                    {spells.map((spell) => (
                      <motion.div
                        key={spell.spellId}
                        className="group flex items-center gap-3 rounded-lg border border-grimoire-border/60 bg-grimoire-card/80 px-3 py-2.5"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        layout
                      >
                        {/* Prepare toggle */}
                        <motion.button
                          className={`flex-shrink-0 rounded-md p-1 transition-colors ${
                            isPrepared(spell.spellId)
                              ? 'text-yellow-400 hover:text-yellow-300'
                              : 'text-grimoire-text-faint hover:text-grimoire-text-muted'
                          }`}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.85 }}
                          onClick={() => handleToggle(spell.spellId)}
                          title={isPrepared(spell.spellId) ? 'Unprepare' : 'Prepare'}
                        >
                          {isPrepared(spell.spellId) ? <Star size={16} fill="currentColor" /> : <StarOff size={16} />}
                        </motion.button>

                        {/* Spell info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-rajdhani font-semibold text-grimoire-text-base truncate">{spell.name}</p>
                          <p className="font-rajdhani text-xs text-grimoire-text-faint">
                            {spell.castingTime} · {spell.range}
                          </p>
                        </div>

                        <SchoolBadge school={spell.school} size="xs" />

                        {/* Remove button */}
                        <motion.button
                          className="ml-1 flex-shrink-0 rounded-md p-1 text-grimoire-text-faint opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.85 }}
                          onClick={() => handleRemoveSpell(spell.spellId)}
                          title="Remove from spellbook"
                        >
                          <X size={14} />
                        </motion.button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Spell Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setAddSearch(''); }}
        title="Add Spell to Spellbook"
      >
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-grimoire-text-faint" />
            <input
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search spells…"
              className="w-full rounded-lg border border-grimoire-border bg-grimoire-surface pl-9 pr-3 py-2 font-rajdhani text-grimoire-text-base placeholder-grimoire-text-faint outline-none focus:border-grimoire-primary/60"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {addableSuggestions.length === 0 ? (
              <p className="py-6 text-center font-rajdhani text-grimoire-text-faint">
                {addSearch ? 'No matching spells found.' : 'All spells already added.'}
              </p>
            ) : (
              addableSuggestions.map((spell) => (
                <motion.button
                  key={spell.spellId}
                  className="flex w-full items-center gap-3 rounded-lg border border-grimoire-border/60 bg-grimoire-card/60 px-3 py-2.5 text-left hover:bg-grimoire-primary/10 hover:border-grimoire-primary/40 transition-colors"
                  whileHover={{ x: 2 }}
                  onClick={() => handleAddSpell(spell)}
                >
                  <SchoolBadge school={spell.school} size="xs" />
                  <span className="flex-1 font-rajdhani font-semibold text-grimoire-text-base">{spell.name}</span>
                  <span className="font-rajdhani text-xs text-grimoire-text-faint">{spellLevelLabel(spell.level)}</span>
                </motion.button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
