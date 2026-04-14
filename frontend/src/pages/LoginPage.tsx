import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import ParticleBackground from '@/components/shared/ParticleBackground';
import { Eye, EyeOff, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-grimoire-bg p-4">
      <ParticleBackground />

      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(124,58,237,0.15),transparent)]" />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-grimoire-primary/40 bg-grimoire-primary/10 text-grimoire-primary-light"
            animate={{ boxShadow: ['0 0 20px rgba(124,58,237,0.2)', '0 0 40px rgba(124,58,237,0.4)', '0 0 20px rgba(124,58,237,0.2)'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles size={32} />
          </motion.div>
          <div className="text-center">
            <h1 className="font-cinzel text-3xl font-bold tracking-widest text-grimoire-text-base text-glow">
              GRIMOIRE
            </h1>
            <p className="mt-1 font-rajdhani text-sm text-grimoire-text-faint tracking-widest uppercase">
              DnD 5e Spell Manager
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-grimoire-border/60 bg-grimoire-card/80 p-8 shadow-2xl backdrop-blur-md">
          <h2 className="mb-6 font-cinzel text-lg font-semibold text-grimoire-text-base">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block font-rajdhani text-sm font-semibold uppercase tracking-wider text-grimoire-text-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="grimoire-input"
                placeholder="wizard@arcane.academy"
              />
            </div>

            <div>
              <label className="mb-1 block font-rajdhani text-sm font-semibold uppercase tracking-wider text-grimoire-text-muted">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="grimoire-input pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-grimoire-text-faint hover:text-grimoire-text-muted transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-rajdhani text-sm text-red-400"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={isLoading}
              className="btn-primary mt-2 w-full"
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    className="block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  Entering…
                </span>
              ) : (
                'Enter the Grimoire'
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
