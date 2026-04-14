import { Amplify } from 'aws-amplify';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import awsConfig from '@/aws-exports';
import Layout from '@/components/shared/Layout';
import PageTransition from '@/components/shared/PageTransition';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import SpellsPage from '@/pages/SpellsPage';
import SpellDetailPage from '@/pages/SpellDetailPage';
import CharactersPage from '@/pages/CharactersPage';
import CharacterDetailPage from '@/pages/CharacterDetailPage';

// Configure Amplify
Amplify.configure(awsConfig);

// TanStack Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-grimoire-bg">
        <span className="font-cinzel text-grimoire-primary-light animate-pulse">Loading…</span>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />

        {/* Protected */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <PageTransition>
                  <HomePage />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/spells"
          element={
            <ProtectedRoute>
              <Layout>
                <PageTransition>
                  <SpellsPage />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/spells/:spellId"
          element={
            <ProtectedRoute>
              <Layout>
                <PageTransition>
                  <SpellDetailPage />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/characters"
          element={
            <ProtectedRoute>
              <Layout>
                <PageTransition>
                  <CharactersPage />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/characters/:characterId"
          element={
            <ProtectedRoute>
              <Layout>
                <PageTransition>
                  <CharacterDetailPage />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
