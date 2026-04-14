import { motion, AnimatePresence } from 'framer-motion';
import { Plus, User } from 'lucide-react';
import CharacterCard from './CharacterCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import type { Character } from '@/types/character';

interface CharacterListProps {
  characters: Character[];
  isLoading: boolean;
  onNew: () => void;
}

export default function CharacterList({ characters, isLoading, onNew }: CharacterListProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-cinzel text-2xl font-bold text-grimoire-text-base">
          Your Characters
          <span className="ml-3 font-mono text-sm text-grimoire-text-faint">({characters.length})</span>
        </h2>
        <motion.button
          className="flex items-center gap-2 rounded-lg border border-grimoire-primary/50 bg-grimoire-primary/10 px-4 py-2 font-rajdhani text-sm text-grimoire-primary-light hover:bg-grimoire-primary/20 transition-colors"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onNew}
        >
          <Plus size={16} />
          New Character
        </motion.button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <LoadingSpinner label="Loading characters…" />
        </div>
      ) : characters.length === 0 ? (
        <motion.div
          className="flex h-56 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-grimoire-border text-grimoire-text-faint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <User size={40} strokeWidth={1} />
          <p className="font-rajdhani text-lg">No characters yet. Create your first one!</p>
          <motion.button
            className="rounded-lg border border-grimoire-primary/50 bg-grimoire-primary/10 px-4 py-2 font-rajdhani text-grimoire-primary-light hover:bg-grimoire-primary/20 transition-colors"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onNew}
          >
            Create Character
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          layout
        >
          <AnimatePresence mode="popLayout">
            {characters.map((char, i) => (
              <CharacterCard key={char.characterId} character={char} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
