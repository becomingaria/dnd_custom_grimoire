import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-2xl',
}: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-grimoire-bg/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            key="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            className={`fixed inset-x-4 top-[10%] z-50 mx-auto ${maxWidth} rounded-xl border border-grimoire-border bg-grimoire-card shadow-card`}
            style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.8), 0 0 40px rgba(124,58,237,0.2)' }}
            initial={{ opacity: 0, scale: 0.92, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between border-b border-grimoire-border px-6 py-4">
                <h2
                  id="modal-title"
                  className="font-cinzel text-lg font-semibold tracking-wide text-grimoire-text-base"
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-grimoire-text-muted transition-colors hover:bg-grimoire-border/40 hover:text-grimoire-text-base"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="max-h-[70vh] overflow-y-auto p-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
