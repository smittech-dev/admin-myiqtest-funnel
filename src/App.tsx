import { Loader2 } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthProvider } from '@/context/AuthProvider';
import { useAuth } from '@/context/auth-context';
import { DashboardPage } from '@/pages/Dashboard';
import { EmailMarketingPage } from '@/pages/EmailMarketing';
import { LoginPage } from '@/pages/Login';
import { QuizDetailPage } from '@/pages/QuizDetail';
import { QuizListPage } from '@/pages/QuizList';

function RequireAuth() {
  const { isAuthenticated, initializing } = useAuth();

  // Hold the route while the stored token is being verified, otherwise a
  // reload would redirect a signed-in operator to /login for a moment.
  if (initializing) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/quiz" element={<QuizListPage />} />
          <Route path="/email-marketing" element={<EmailMarketingPage />} />
          <Route path="/quiz/:id" element={<QuizDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
