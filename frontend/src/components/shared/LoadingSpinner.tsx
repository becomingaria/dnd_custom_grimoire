import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeMap = {
  sm:  'w-6 h-6',
  md:  'w-10 h-10',
  lg:  'w-16 h-16',
} as const;

export default function LoadingSpinner({ size = 'md', label = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4" role="status" aria-label={label}>
      <div className={`relative ${sizeMap[size]}`}>
        {/* Outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-grimoire-primary/20"
          style={{ borderTopColor: 'rgba(124, 58, 237, 0.9)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
        {/* Inner ring */}
        <motion.div
          className="absolute inset-1.5 rounded-full border-2 border-grimoire-accent/20"
          style={{ borderBottomColor: 'rgba(245, 158, 11, 0.9)' }}
          animate={{ rotate: -360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
        {/* Center glow */}
        <motion.div
          className="absolute inset-0 rounded-full bg-grimoire-primary/10"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
      {label && (
        <motion.p
          className="font-rajdhani text-sm tracking-widest text-grimoire-text-muted uppercase"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}
