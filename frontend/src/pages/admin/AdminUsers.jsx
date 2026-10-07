import { useEffect, useState } from 'react';
import { adminApi } from '../../api-integration/admin';
import { authApi } from '../../api-integration/auth';
import { Loader2, Search, MoreVertical, Shield, UserX, UserCheck, Ban, RefreshCw, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const { user: currentUser } = useAuth(); // To prevent banning self

    useEffect(() => {
        loadUsers();
    }, [search, page]); // Debounce omitted for brevity, but ideal

    const loadUsers = async () => {
        try {
            setLoading(true);
            const result = await adminApi.getUsers({ search, limit: 15, page });
            setUsers(result.data);
            setTotalPages(result.meta?.totalPages || 1);
        } catch (error) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            await adminApi.updateUserRole(userId, newRole);
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            toast.success(`User updated to ${newRole}`);
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to update role';
            toast.error(errorMsg);
        }
    };

    const handleStatusChange = async (userId, currentStatus) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        if (currentStatus === 'ACTIVE' && !window.confirm('Are you sure you want to suspend this user?')) return;

        try {
            await adminApi.updateUserStatus(userId, newStatus);
            setUsers(users.map(u => u.id === userId ? { ...u, accountStatus: newStatus } : u));
            toast.success(`User account is now ${newStatus}`);
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to update status';
            toast.error(errorMsg);
        }
    };

    const handleForceReset = async (userId, userEmail) => {
        if (!window.confirm(`Force password reset for ${userEmail} on their next login?`)) return;
        try {
            await adminApi.forcePasswordReset(userId, true);
            toast.success('User flagged for forced password reset.');
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to flag user for reset';
            toast.error(errorMsg);
        }
    };

    const handleImpersonate = async (userId, userEmail) => {
        if (!window.confirm(`Are you sure you want to impersonate ${userEmail}? This will log you in as them.`)) return;
        try {
            const result = await authApi.impersonateUser(userId);
            toast.success(`Impersonating ${userEmail}`);
            // Set the new token and redirect home to assume their identity
            localStorage.setItem('sentinelpay_token', result.token);
            window.location.href = '/dashboard';
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to impersonate user';
            toast.error(errorMsg);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-foreground">User Management</h2>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-red-500 focus:border-red-500"
                        value={search}
                        onChange={e => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
            </div>

            <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-muted-foreground font-medium border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Plan</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></td></tr>
                        ) : users.map(user => (
                            <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-white">{user.name || 'No Name'}</span>
                                        <span className="text-zinc-500 text-xs">{user.email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${user.accountStatus === 'ACTIVE' || !user.accountStatus ? 'bg-green-500/10 text-green-500' :
                                        user.accountStatus === 'SUSPENDED' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
                                        }`}>
                                        {user.accountStatus || 'ACTIVE'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${user.role === 'ADMIN' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-zinc-400">
                                    {user.subscription?.plan || 'FREE'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        {/* Status Toggle */}
                                        {user.id !== currentUser.id && (
                                            <button
                                                onClick={() => handleStatusChange(user.id, user.accountStatus || 'ACTIVE')}
                                                title={user.accountStatus === 'ACTIVE' || !user.accountStatus ? 'Suspend User' : 'Unsuspend User'}
                                                className={`p-1.5 rounded-md transition-colors ${user.accountStatus === 'ACTIVE' || !user.accountStatus
                                                    ? 'hover:bg-yellow-500/20 text-zinc-400 hover:text-yellow-500'
                                                    : 'hover:bg-green-500/20 text-yellow-500 hover:text-green-500'
                                                    }`}
                                            >
                                                {user.accountStatus === 'ACTIVE' || !user.accountStatus ? <Ban className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                            </button>
                                        )}

                                        {/* Force Password Reset */}
                                        <button
                                            onClick={() => handleForceReset(user.id, user.email)}
                                            title="Force Password Reset"
                                            className="p-1.5 hover:bg-orange-500/20 text-zinc-400 hover:text-orange-500 rounded-md transition-colors"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                        </button>

                                        {/* Impersonate */}
                                        {user.role !== 'ADMIN' && (
                                            <button
                                                onClick={() => handleImpersonate(user.id, user.email)}
                                                title="Impersonate User"
                                                className="p-1.5 hover:bg-blue-500/20 text-zinc-400 hover:text-blue-500 rounded-md transition-colors"
                                            >
                                                <LogIn className="h-4 w-4" />
                                            </button>
                                        )}

                                        {/* Role Actions */}
                                        {user.role !== 'ADMIN' && (
                                            <button
                                                onClick={() => handleRoleChange(user.id, 'ADMIN')}
                                                title="Promote to Admin"
                                                className="p-1.5 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 rounded-md transition-colors"
                                            >
                                                <Shield className="h-4 w-4" />
                                            </button>
                                        )}
                                        {user.role === 'ADMIN' && user.id !== currentUser.id && (
                                            <button
                                                onClick={() => handleRoleChange(user.id, 'USER')}
                                                title="Demote to User"
                                                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
                                            >
                                                <UserX className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-4 pt-4">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-zinc-400">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
