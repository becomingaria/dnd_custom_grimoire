import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  onClick?: () => void;
  hoverable?: boolean;
  as?: 'div' | 'article' | 'section' | 'li';
}

export default function GlowCard({
  children,
  className = '',
  glowColor = 'rgba(124, 58, 237, 0.35)',
  onClick,
  hoverable = false,
  as: Tag = 'div',
}: GlowCardProps) {
  const baseClass = [
    'relative rounded-xl border border-grimoire-border bg-grimoire-card',
    'backdrop-blur-sm overflow-hidden',
    hoverable ? 'cursor-pointer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.div
      // @ts-expect-error polymorphic not fully typed here
      as={Tag}
      className={baseClass}
      style={{ boxShadow: `0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)` }}
      whileHover={
        hoverable
          ? {
              scale: 1.02,
              boxShadow: `0 8px 40px rgba(0,0,0,0.8), 0 0 20px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`,
              borderColor: 'rgba(124, 58, 237, 0.5)',
            }
          : undefined
      }
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      onClick={onClick}
    >
      {/* Subtle top sheen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }}
      />
      {children}
    </motion.div>
  );
}

// Re-export AnimatePresence for convenience
export { AnimatePresence };
