import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { AdminRoute } from './components/layout/AdminRoute';
import { NotificationProvider } from './contexts/NotificationContext';
import { UploadProvider } from './contexts/UploadContext';
import { AuthProvider } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import LiveFeed from './pages/LiveFeed';
import Settings from './pages/Settings';
import Analysis from './pages/Analysis';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminModels from './pages/admin/AdminModels';
import AdminPlayground from './pages/admin/AdminPlayground';
import LandingPage from './pages/LandingPage';
import { ThemeProvider } from './contexts/ThemeContext';
import Anomalies from './pages/Anomalies';
import Upload from './pages/Upload';
import Investigations from './pages/Investigations';
import KnowledgeBase from './pages/KnowledgeBase';

const ProtectedRoute = () => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-muted-foreground">Initializing session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const ProRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  const isPro = user?.subscription?.plan === 'Pro' || user?.subscription?.plan === 'Enterprise';

  if (!isPro) {
    return <Navigate to="/settings" replace />;
  }

  return <Outlet />;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
        <UploadProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* User Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/investigations" element={<Investigations />} />
                <Route path="/knowledge" element={<KnowledgeBase />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="/anomalies" element={<Anomalies />} />
                <Route path="/live" element={<LiveFeed />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>

            {/* Admin Routes */}
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/models" element={<AdminModels />} />
                <Route path="/admin/playground" element={<AdminPlayground />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </UploadProvider>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
