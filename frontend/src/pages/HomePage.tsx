import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BookOpen, Users, Sparkles, ArrowRight } from 'lucide-react';
import { useSpells } from '@/hooks/useSpells';
import { useCharacters } from '@/hooks/useCharacters';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { data: spells = [] } = useSpells();
  const { data: characters = [] } = useCharacters();
  const { user } = useAuth();

  const spellSchools = new Set(spells.map((s) => s.school)).size;
  const homebrewCount = spells.filter((s) => s.isHomebrew).length;

  const stats = [
    { label: 'Total Spells', value: spells.length, icon: BookOpen, color: 'text-grimoire-primary-light' },
    { label: 'Spell Schools', value: spellSchools, icon: Sparkles, color: 'text-yellow-400' },
    { label: 'Homebrew', value: homebrewCount, icon: Sparkles, color: 'text-amber-400' },
    { label: 'Characters', value: characters.length, icon: Users, color: 'text-green-400' },
  ];

  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-grimoire-border bg-grimoire-card px-8 py-16 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,rgba(124,58,237,0.12),transparent)]" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          {user && (
            <p className="mb-3 font-rajdhani text-sm uppercase tracking-widest text-grimoire-primary-light">
              Welcome back, {user.signInDetails?.loginId?.split('@')[0] ?? 'Adventurer'}
            </p>
          )}
          <h1 className="font-cinzel text-5xl font-bold tracking-widest text-grimoire-text-base text-glow md:text-6xl">
            THE GRIMOIRE
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-rajdhani text-lg text-grimoire-text-muted">
            Your personal arcane library. Manage, craft, and master every spell in your arsenal.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/spells"
                className="flex items-center gap-2 rounded-xl bg-grimoire-primary px-6 py-3 font-rajdhani font-semibold text-white shadow-lg hover:bg-grimoire-primary-light transition-colors"
              >
                <BookOpen size={18} />
                Browse Spells
                <ArrowRight size={16} />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/characters"
                className="flex items-center gap-2 rounded-xl border border-grimoire-border bg-grimoire-surface px-6 py-3 font-rajdhani font-semibold text-grimoire-text-base hover:border-grimoire-primary/40 transition-colors"
              >
                <Users size={18} />
                Your Characters
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="mb-4 font-cinzel text-xl font-bold text-grimoire-text-base">Arcane Overview</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, color }, i) => (
            <motion.div
              key={label}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-grimoire-border bg-grimoire-card p-6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              whileHover={{ scale: 1.04, borderColor: 'rgba(124,58,237,0.4)' }}
            >
              <Icon size={24} className={color} />
              <span className={`font-mono text-3xl font-bold ${color}`}>{value}</span>
              <span className="font-rajdhani text-sm text-grimoire-text-faint">{label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div whileHover={{ scale: 1.015 }}>
          <Link
            to="/spells"
            className="block rounded-xl border border-grimoire-border bg-grimoire-card p-6 hover:border-grimoire-primary/40 transition-all group"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-grimoire-primary/10 text-grimoire-primary-light">
                <BookOpen size={20} />
              </div>
              <h3 className="font-cinzel text-lg font-bold text-grimoire-text-base group-hover:text-grimoire-primary-light transition-colors">
                Spell Compendium
              </h3>
            </div>
            <p className="font-rajdhani text-grimoire-text-muted">
              Browse all {spells.length} spells. Filter by school, level, or class. Create your own homebrew spells.
            </p>
          </Link>
        </motion.div>

        <motion.div whileHover={{ scale: 1.015 }}>
          <Link
            to="/characters"
            className="block rounded-xl border border-grimoire-border bg-grimoire-card p-6 hover:border-grimoire-primary/40 transition-all group"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
                <Users size={20} />
              </div>
              <h3 className="font-cinzel text-lg font-bold text-grimoire-text-base group-hover:text-grimoire-primary-light transition-colors">
                Characters
              </h3>
            </div>
            <p className="font-rajdhani text-grimoire-text-muted">
              Manage your {characters.length} character{characters.length !== 1 ? 's' : ''}. Track known and prepared spells for each one.
            </p>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
