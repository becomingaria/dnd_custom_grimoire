import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { CHARACTER_CLASSES, classSpellcastingAbility } from '@/types/character';
import type { CreateCharacterInput, UpdateCharacterInput, Character } from '@/types/character';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  class: z.string().min(1, 'Class is required'),
  subclass: z.string().max(60).optional(),
  level: z.coerce.number().int().min(1).max(20),
  spellcastingAbility: z.enum(['INT', 'WIS', 'CHA']),
  spellSaveDC: z.coerce.number().int().min(1).max(30).optional(),
  spellAttackBonus: z.coerce.number().int().min(-5).max(20).optional(),
  notes: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

interface CharacterFormProps {
  initial?: Character;
  onSubmit: (data: CreateCharacterInput | UpdateCharacterInput) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

const fieldClass =
  'w-full rounded-lg border border-grimoire-border bg-grimoire-surface px-3 py-2 font-rajdhani text-grimoire-text-base placeholder-grimoire-text-faint outline-none focus:border-grimoire-primary/60 focus:ring-1 focus:ring-grimoire-primary/40 transition-colors';

const labelClass = 'block font-rajdhani text-sm font-semibold uppercase tracking-wider text-grimoire-text-muted mb-1';

export default function CharacterForm({ initial, onSubmit, onCancel, isSaving }: CharacterFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          name: initial.name,
          class: initial.class,
          subclass: initial.subclass ?? '',
          level: initial.level,
          spellcastingAbility: initial.spellcastingAbility as 'INT' | 'WIS' | 'CHA',
          spellSaveDC: initial.spellSaveDC,
          spellAttackBonus: initial.spellAttackBonus,
          notes: initial.notes ?? '',
        }
      : {
          level: 1,
          spellcastingAbility: 'INT',
        },
  });

  // Auto-set spellcasting ability when class changes
  const watchedClass = watch('class');
  useEffect(() => {
    if (watchedClass) {
      const ability = classSpellcastingAbility[watchedClass as keyof typeof classSpellcastingAbility];
      if (ability) {
        setValue('spellcastingAbility', ability as 'INT' | 'WIS' | 'CHA');
      }
    }
  }, [watchedClass, setValue]);

  const submit = handleSubmit(async (data) => {
    const payload: CreateCharacterInput = {
      name: data.name,
      class: data.class,
      subclass: data.subclass || undefined,
      level: data.level,
      spellcastingAbility: data.spellcastingAbility,
      spellSaveDC: data.spellSaveDC,
      spellAttackBonus: data.spellAttackBonus,
      notes: data.notes || undefined,
      knownSpellIds: [],
      preparedSpellIds: [],
    };
    await onSubmit(payload);
  });

  const error = (key: keyof FormValues) =>
    errors[key] ? <p className="mt-1 font-rajdhani text-xs text-red-400">{errors[key]?.message}</p> : null;

  return (
    <motion.form
      onSubmit={submit}
      className="space-y-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Name */}
      <div>
        <label className={labelClass}>Character Name</label>
        <input {...register('name')} className={fieldClass} placeholder="Zara Brightflame" />
        {error('name')}
      </div>

      {/* Class + Level */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Class</label>
          <select {...register('class')} className={fieldClass}>
            <option value="">— Select class —</option>
            {CHARACTER_CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {error('class')}
        </div>
        <div>
          <label className={labelClass}>Level</label>
          <input {...register('level')} type="number" min={1} max={20} className={fieldClass} />
          {error('level')}
        </div>
      </div>

      {/* Subclass */}
      <div>
        <label className={labelClass}>Subclass <span className="normal-case tracking-normal font-normal text-grimoire-text-faint">(optional)</span></label>
        <input {...register('subclass')} className={fieldClass} placeholder="School of Evocation" />
        {error('subclass')}
      </div>

      {/* Spellcasting ability + DC + attack bonus */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Casting Ability</label>
          <select {...register('spellcastingAbility')} className={fieldClass}>
            <option value="INT">Intelligence</option>
            <option value="WIS">Wisdom</option>
            <option value="CHA">Charisma</option>
          </select>
          {error('spellcastingAbility')}
        </div>
        <div>
          <label className={labelClass}>Spell Save DC</label>
          <input {...register('spellSaveDC')} type="number" min={1} max={30} className={fieldClass} placeholder="14" />
          {error('spellSaveDC')}
        </div>
        <div>
          <label className={labelClass}>Attack Bonus</label>
          <input {...register('spellAttackBonus')} type="number" min={-5} max={20} className={fieldClass} placeholder="+6" />
          {error('spellAttackBonus')}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes <span className="normal-case tracking-normal font-normal text-grimoire-text-faint">(optional)</span></label>
        <textarea
          {...register('notes')}
          rows={4}
          className={`${fieldClass} resize-y`}
          placeholder="Backstory, special abilities, reminders…"
        />
        {error('notes')}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <motion.button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-grimoire-border px-4 py-2 font-rajdhani text-grimoire-text-muted hover:text-grimoire-text-base hover:border-grimoire-text-muted/40 transition-colors"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Cancel
        </motion.button>
        <motion.button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-grimoire-primary px-5 py-2 font-rajdhani font-semibold text-white hover:bg-grimoire-primary-light transition-colors disabled:opacity-50"
          whileHover={{ scale: isSaving ? 1 : 1.03 }}
          whileTap={{ scale: isSaving ? 1 : 0.97 }}
        >
          {isSaving ? 'Saving…' : initial ? 'Update Character' : 'Create Character'}
        </motion.button>
      </div>
    </motion.form>
  );
}
