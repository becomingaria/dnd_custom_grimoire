/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // ─── Color Palette ──────────────────────────────────────────────────────
      colors: {
        grimoire: {
          bg:           '#07070f',
          surface:      '#0e0e1c',
          card:         '#141428',
          border:       '#252545',
          'border-glow':'#4040a0',
          primary:      '#7c3aed',
          'primary-light': '#a78bfa',
          secondary:    '#a855f7',
          accent:       '#f59e0b',
          'accent-light':'#fcd34d',
          danger:       '#ef4444',
          success:      '#22c55e',
          'text-base':  '#e2e8f0',
          'text-muted': '#94a3b8',
          'text-faint': '#475569',
        },
        school: {
          abjuration:    '#3b82f6',
          conjuration:   '#a855f7',
          divination:    '#06b6d4',
          enchantment:   '#ec4899',
          evocation:     '#ef4444',
          illusion:      '#8b5cf6',
          necromancy:    '#22c55e',
          transmutation: '#f59e0b',
        },
      },

      // ─── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        cinzel:    ['"Cinzel"', 'serif'],
        rajdhani:  ['"Rajdhani"', 'sans-serif'],
        mono:      ['"JetBrains Mono"', 'monospace'],
        sans:      ['"Rajdhani"', 'sans-serif'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1', fontWeight: '900' }],
        'hero':    ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }],
      },

      // ─── Animations ──────────────────────────────────────────────────────────
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(124, 58, 237, 0.4)' },
          '50%':       { boxShadow: '0 0 20px 6px rgba(124, 58, 237, 0.7)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'scan-line': {
          '0%':   { top: '0%' },
          '100%': { top: '100%' },
        },
        'rune-spin': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'float':      'float 4s ease-in-out infinite',
        'shimmer':    'shimmer 2.5s linear infinite',
        'scan-line':  'scan-line 4s linear infinite',
        'rune-spin':  'rune-spin 12s linear infinite',
      },

      // ─── Blur / Shadow ───────────────────────────────────────────────────────
      boxShadow: {
        'glow-sm':  '0 0 10px 2px rgba(124, 58, 237, 0.3)',
        'glow':     '0 0 20px 4px rgba(124, 58, 237, 0.45)',
        'glow-lg':  '0 0 40px 8px rgba(124, 58, 237, 0.5)',
        'glow-gold':'0 0 20px 4px rgba(245, 158, 11, 0.45)',
        'card':     '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        'card-hover':'0 8px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
      },

      // ─── Backgrounds ────────────────────────────────────────────────────────
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'shimmer-gradient':
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
        'card-gradient':
          'linear-gradient(145deg, rgba(20,20,40,0.9) 0%, rgba(14,14,28,0.95) 100%)',
        'hero-gradient':
          'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.2) 0%, transparent 65%)',
      },

      // ─── Border Radius ───────────────────────────────────────────────────────
      borderRadius: {
        'xl2': '1rem',
        'xl3': '1.5rem',
      },
    },
  },
  plugins: [],
};
