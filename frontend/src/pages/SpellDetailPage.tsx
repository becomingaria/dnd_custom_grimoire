import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit2, Trash2, Clock, Crosshair, Timer, Zap, RefreshCw } from 'lucide-react';
import { useSpell, useUpdateSpell, useDeleteSpell } from '@/hooks/useSpells';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Modal from '@/components/shared/Modal';
import SpellForm from '@/components/spells/SpellForm';
import SchoolBadge from '@/components/spells/SchoolBadge';
import { spellLevelLabel, schoolGlowStyle } from '@/types/spell';
import type { UpdateSpellInput } from '@/types/spell';

export default function SpellDetailPage() {
  const { spellId } = useParams<{ spellId: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: spell, isLoading, error } = useSpell(spellId ?? '');
  const updateSpell = useUpdateSpell();
  const deleteSpell = useDeleteSpell();

  async function handleUpdate(data: UpdateSpellInput) {
    if (!spellId) return;
    await updateSpell.mutateAsync({ spellId, data });
    setShowEdit(false);
  }

  async function handleDelete() {
    if (!spellId) return;
    await deleteSpell.mutateAsync(spellId);
    navigate('/spells');
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner label="Loading spell…" />
      </div>
    );
  }

  if (error || !spell) {
    return (
      <div className="py-16 text-center font-rajdhani text-grimoire-text-faint">
        Spell not found.
      </div>
    );
  }

  const isOwner = spell.createdBy === userId;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      {/* Back */}
      <motion.button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 font-rajdhani text-sm text-grimoire-text-faint hover:text-grimoire-text-muted transition-colors"
        whileHover={{ x: -2 }}
      >
        <ArrowLeft size={16} />
        Back
      </motion.button>

      {/* Card */}
      <motion.div
        className="rounded-2xl border border-grimoire-border bg-grimoire-card overflow-hidden"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ boxShadow: schoolGlowStyle[spell.school] }}
      >
        {/* Header */}
        <div className="border-b border-grimoire-border p-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-cinzel text-3xl font-bold text-grimoire-text-base">{spell.name}</h1>
              <p className="mt-1 font-rajdhani text-grimoire-text-muted">
                {spellLevelLabel(spell.level)} · <SchoolBadge school={spell.school} size="sm" />
              </p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-grimoire-border px-3 py-1.5 font-rajdhani text-sm text-grimoire-text-muted hover:text-grimoire-text-base hover:border-grimoire-primary/40 transition-colors"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Edit2 size={14} /> Edit
                </motion.button>
                <motion.button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 font-rajdhani text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Trash2 size={14} /> Delete
                </motion.button>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { icon: Clock, label: 'Casting Time', value: spell.castingTime },
              { icon: Crosshair, label: 'Range', value: spell.range },
              { icon: Timer, label: 'Duration', value: spell.duration },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg border border-grimoire-border/60 bg-grimoire-surface/50 p-3 text-center">
                <Icon size={14} className="mx-auto mb-1 text-grimoire-text-faint" />
                <p className="font-mono text-sm text-grimoire-text-base">{value}</p>
                <p className="font-rajdhani text-[10px] uppercase tracking-widest text-grimoire-text-faint">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {spell.components.map((c) => (
              <span key={c} className="rounded border border-grimoire-border px-2 py-0.5 font-mono text-xs text-grimoire-text-muted">{c}</span>
            ))}
            {spell.concentration && (
              <span className="flex items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-xs text-blue-400">
                <Zap size={10} /> Concentration
              </span>
            )}
            {spell.ritual && (
              <span className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-xs text-amber-400">
                <RefreshCw size={10} /> Ritual
              </span>
            )}
            {spell.isHomebrew && (
              <span className="rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-xs text-purple-400">Homebrew</span>
            )}
          </div>

          {/* Material */}
          {spell.materialComponents && (
            <p className="font-rajdhani text-sm italic text-grimoire-text-faint">
              Materials: {spell.materialComponents}
            </p>
          )}

          {/* Description */}
          <div>
            <h3 className="mb-2 font-cinzel text-sm font-bold uppercase tracking-widest text-grimoire-text-faint">Description</h3>
            <p className="whitespace-pre-line font-rajdhani leading-relaxed text-grimoire-text-muted">{spell.description}</p>
          </div>

          {/* At Higher Levels */}
          {spell.higherLevels && (
            <div>
              <h3 className="mb-2 font-cinzel text-sm font-bold uppercase tracking-widest text-grimoire-text-faint">At Higher Levels</h3>
              <p className="whitespace-pre-line font-rajdhani leading-relaxed text-grimoire-text-muted">{spell.higherLevels}</p>
            </div>
          )}

          {/* Classes */}
          {spell.classes && spell.classes.length > 0 && (
            <div>
              <h3 className="mb-2 font-cinzel text-sm font-bold uppercase tracking-widest text-grimoire-text-faint">Classes</h3>
              <div className="flex flex-wrap gap-2">
                {spell.classes.map((c) => (
                  <span key={c} className="rounded border border-grimoire-border/60 bg-grimoire-surface px-2 py-0.5 font-rajdhani text-sm text-grimoire-text-muted">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {spell.tags && spell.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {spell.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-grimoire-border/50 px-2.5 py-0.5 font-rajdhani text-xs text-grimoire-text-faint">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Spell">
        <SpellForm
          initial={spell}
          onSubmit={handleUpdate}
          onCancel={() => setShowEdit(false)}
          isSaving={updateSpell.isPending}
        />
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Spell">
        <div className="space-y-4">
          <p className="font-rajdhani text-grimoire-text-muted">
            Are you sure you want to delete <strong className="text-grimoire-text-base">{spell.name}</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <motion.button
              onClick={() => setShowDeleteConfirm(false)}
              className="btn-ghost"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Cancel
            </motion.button>
            <motion.button
              onClick={handleDelete}
              disabled={deleteSpell.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 font-rajdhani font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              whileHover={{ scale: deleteSpell.isPending ? 1 : 1.03 }}
              whileTap={{ scale: deleteSpell.isPending ? 1 : 0.97 }}
            >
              {deleteSpell.isPending ? 'Deleting…' : 'Delete'}
            </motion.button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
