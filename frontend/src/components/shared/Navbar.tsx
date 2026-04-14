import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Users, Home, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navLinks = [
  { to: '/',           label: 'Home',       icon: Home },
  { to: '/spells',     label: 'Spells',     icon: BookOpen },
  { to: '/characters', label: 'Characters', icon: Users },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-grimoire-border bg-grimoire-surface/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link to="/" className="group flex items-center gap-2.5">
          <motion.div
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-grimoire-primary/40 bg-grimoire-primary/10"
            whileHover={{ scale: 1.1, borderColor: 'rgba(124,58,237,0.8)' }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{ boxShadow: '0 0 12px rgba(124,58,237,0.25)' }}
          >
            <Sparkles size={18} className="text-grimoire-primary-light" />
          </motion.div>
          <span className="font-cinzel text-lg font-bold tracking-wider text-grimoire-text-base">
            Grimoire
          </span>
        </Link>

        {/* Navigation links */}
        <ul className="flex items-center gap-1">
          {navLinks.map(({ to, label, icon: Icon }) => {
            const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={[
                    'relative flex items-center gap-2 rounded-lg px-3.5 py-2 font-rajdhani text-sm font-medium',
                    'tracking-wide transition-colors duration-150',
                    isActive
                      ? 'text-grimoire-primary-light'
                      : 'text-grimoire-text-muted hover:text-grimoire-text-base',
                  ].join(' ')}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-lg border border-grimoire-primary/30 bg-grimoire-primary/10"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Auth section */}
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            {user && (
              <motion.div
                key="user-info"
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
              >
                <span className="hidden font-rajdhani text-sm text-grimoire-text-muted sm:block">
                  {user.username}
                </span>
                <button
                  onClick={() => void logout()}
                  className="flex items-center gap-1.5 rounded-lg border border-grimoire-border px-3 py-1.5 font-rajdhani text-sm font-medium text-grimoire-text-muted transition-colors hover:border-grimoire-danger/40 hover:text-grimoire-danger"
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </header>
  );
}
