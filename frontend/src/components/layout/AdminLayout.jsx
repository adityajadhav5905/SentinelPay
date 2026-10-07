import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BrainCircuit, Terminal, ArrowLeft, Menu, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Toaster } from 'sonner';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/admin/dashboard' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    { icon: BrainCircuit, label: 'Models', path: '/admin/models' },
    { icon: Terminal, label: 'API Playground', path: '/admin/playground' },
];

export function AdminLayout() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const sidebarContent = (
        <>
            <Link to="/dashboard" className="mb-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors px-2">
                <ArrowLeft className="h-4 w-4" /> Back to App
            </Link>

            <div className="mb-8 px-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                    Admin Console
                </h1>
                <p className="text-xs text-red-400 mt-1 uppercase tracking-wider font-semibold">Restricted Area</p>
            </div>

            <nav className="space-y-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium",
                                isActive
                                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                            )}
                        >
                            <Icon className={cn("h-4 w-4", isActive ? "text-red-500" : "text-zinc-500")} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto px-2">
                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg">
                    <p className="text-xs text-red-400 font-mono">Environment: PROD</p>
                </div>
            </div>
        </>
    );

    return (
        <div className="min-h-screen bg-zinc-950 text-foreground flex flex-col md:flex-row">
            {/* Mobile hamburger */}
            <button
                onClick={() => setMobileOpen(true)}
                className="fixed top-4 left-4 z-50 md:hidden p-2.5 rounded-xl bg-zinc-900 border border-red-900/30 text-zinc-300 hover:text-white transition-colors"
                aria-label="Open admin menu"
            >
                <Menu className="h-5 w-5" />
            </button>

            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 border-r border-red-900/20 bg-black/40 flex-col py-6 px-4 min-h-screen">
                {sidebarContent}
            </aside>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed left-0 top-0 h-screen w-72 bg-black border-r border-red-900/20 z-[70] flex flex-col py-6 px-4 md:hidden overflow-y-auto"
                        >
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                aria-label="Close menu"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            {sidebarContent}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            <main className="flex-1 p-4 pt-16 md:p-8 md:pt-8 overflow-auto bg-zinc-950/50">
                <Outlet />
            </main>

            <Toaster position="top-center" toastOptions={{
                className: 'border-red-900/50 bg-black text-white',
                style: { background: '#000', color: '#fff', borderColor: '#331111' }
            }} />
        </div>
    );
}
