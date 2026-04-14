import type { ReactNode } from 'react';
import Navbar from './Navbar';
import ParticleBackground from './ParticleBackground';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="relative min-h-screen bg-grimoire-bg text-grimoire-text-base">
      {/* Animated particle canvas in background */}
      <ParticleBackground />

      {/* Radial hero glow at the top */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[500px]"
        style={{
          background:
            'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(124,58,237,0.18) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Navigation */}
      <Navbar />

      {/* Main content — offset by navbar height */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
