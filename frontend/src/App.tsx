import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './hooks/useAuth';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import PlayersPage from './pages/PlayersPage';
import SessionsPage from './pages/SessionsPage';
import DrillsPage from './pages/DrillsPage';
import ParentViewPage from './pages/ParentViewPage';
import NotFoundPage from './pages/NotFoundPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/parent/:token" element={<ParentViewPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/players" element={<PlayersPage />} />
                <Route path="/sessions" element={<SessionsPage />} />
                <Route path="/drills" element={<DrillsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
