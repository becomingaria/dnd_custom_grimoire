import { clsx } from 'clsx';
import type { SpellSchool } from '@/types/spell';
import { schoolColorClass } from '@/types/spell';

interface SchoolBadgeProps {
  school: SpellSchool;
  size?: 'xs' | 'sm' | 'md';
}

const sizeClass = {
  xs: 'px-1.5 py-0.5 text-xs',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

const schoolIcons: Record<SpellSchool, string> = {
  Abjuration:    '🛡',
  Conjuration:   '✨',
  Divination:    '🔮',
  Enchantment:   '💜',
  Evocation:     '🔥',
  Illusion:      '👁',
  Necromancy:    '💀',
  Transmutation: '⚗',
};

export default function SchoolBadge({ school, size = 'sm' }: SchoolBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded border font-rajdhani font-semibold tracking-wide',
        schoolColorClass[school],
        sizeClass[size]
      )}
    >
      <span aria-hidden="true">{schoolIcons[school]}</span>
      {school}
    </span>
  );
}
