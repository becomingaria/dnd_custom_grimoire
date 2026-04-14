import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Star, Shield } from 'lucide-react';
import type { Character } from '@/types/character';
import { spellcastingAbilityLabel } from '@/types/character';

interface CharacterCardProps {
  character: Character;
  index?: number;
}

const classColorMap: Record<string, string> = {
  Wizard:    'from-blue-500/20 to-transparent',
  Sorcerer:  'from-purple-500/20 to-transparent',
  Warlock:   'from-violet-600/20 to-transparent',
  Cleric:    'from-yellow-500/20 to-transparent',
  Druid:     'from-green-500/20 to-transparent',
  Bard:      'from-pink-500/20 to-transparent',
  Paladin:   'from-amber-500/20 to-transparent',
  Ranger:    'from-emerald-600/20 to-transparent',
  Fighter:   'from-red-600/20 to-transparent',
  Rogue:     'from-slate-500/20 to-transparent',
  Monk:      'from-orange-500/20 to-transparent',
  Barbarian: 'from-red-700/20 to-transparent',
  Artificer: 'from-teal-500/20 to-transparent',
};

export default function CharacterCard({ character, index = 0 }: CharacterCardProps) {
  const navigate = useNavigate();
  const gradient = classColorMap[character.class] ?? 'from-grimoire-primary/20 to-transparent';

  return (
    <motion.article
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-grimoire-border bg-grimoire-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{
        scale: 1.025,
        borderColor: 'rgba(124,58,237,0.5)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 20px rgba(124,58,237,0.3)',
      }}
      onClick={() => navigate(`/characters/${character.characterId}`)}
    >
      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none opacity-60`}
      />

      <div className="relative p-5">
        {/* Name + class */}
        <div className="mb-3">
          <h3 className="font-cinzel text-lg font-bold text-grimoire-text-base group-hover:text-grimoire-primary-light transition-colors">
            {character.name}
          </h3>
          <p className="mt-0.5 font-rajdhani text-sm text-grimoire-text-muted">
            {character.class}{character.subclass ? ` · ${character.subclass}` : ''}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center rounded-lg border border-grimoire-border/50 bg-grimoire-surface/50 p-2">
            <Shield size={14} className="mb-1 text-grimoire-primary-light" />
            <span className="font-mono text-lg font-bold text-grimoire-text-base">{character.level}</span>
            <span className="font-rajdhani text-[10px] uppercase tracking-widest text-grimoire-text-faint">Level</span>
          </div>
          <div className="flex flex-col items-center rounded-lg border border-grimoire-border/50 bg-grimoire-surface/50 p-2">
            <BookOpen size={14} className="mb-1 text-grimoire-accent" />
            <span className="font-mono text-lg font-bold text-grimoire-text-base">{character.knownSpellIds.length}</span>
            <span className="font-rajdhani text-[10px] uppercase tracking-widest text-grimoire-text-faint">Known</span>
          </div>
          <div className="flex flex-col items-center rounded-lg border border-grimoire-border/50 bg-grimoire-surface/50 p-2">
            <Star size={14} className="mb-1 text-yellow-400" />
            <span className="font-mono text-lg font-bold text-grimoire-text-base">{character.preparedSpellIds.length}</span>
            <span className="font-rajdhani text-[10px] uppercase tracking-widest text-grimoire-text-faint">Prep</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-rajdhani text-xs text-grimoire-text-faint">
            {spellcastingAbilityLabel[character.spellcastingAbility as keyof typeof spellcastingAbilityLabel]} spellcasting
          </span>
          {character.spellSaveDC && (
            <span className="rounded border border-grimoire-border/60 bg-grimoire-surface px-2 py-0.5 font-mono text-xs text-grimoire-text-muted">
              DC {character.spellSaveDC}
            </span>
          )}
        </div>
      </div>

      {/* Bottom glow line */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-grimoire-primary/60 to-transparent"
        initial={{ opacity: 0.2 }}
        whileHover={{ opacity: 1 }}
      />
    </motion.article>
  );
}
