import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export const AdminRoute = () => {
    const { user, loading, isAuthenticated } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <Loader2 className="animate-spin text-red-600 h-8 w-8" />
            </div>
        );
    }

    if (!isAuthenticated) return <Navigate to="/login" replace />;

    // Check if user is admin
    if (user?.role !== 'ADMIN') {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white p-6 text-center">
                <h1 className="text-4xl font-bold text-red-600 mb-4">403 Forbidden</h1>
                <p className="text-zinc-400 max-w-md mb-8">
                    You do not have permission to access the Neural Command Center.
                    This incident will be reported.
                </p>
                <Navigate to="/dashboard" replace />
                {/* Or a Back button */}
            </div>
        );
    }

    return <Outlet />;
};
