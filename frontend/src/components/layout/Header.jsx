import { Bell, X, Sun, Moon, LogOut, User } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

export function Header({ title }) {
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between mb-6 md:mb-8 relative gap-2">
      <h2 className="text-xl md:text-3xl font-bold tracking-tight text-gradient transition-all truncate">{title}</h2>

      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <div className="relative">
          <button
            onClick={toggleTheme}
            className="relative p-2 rounded-xl hover:bg-muted transition-colors group mr-2"
          >
            <div className="relative h-5 w-5">
              <Sun className={cn("absolute inset-0 h-5 w-5 text-yellow-500 transition-all",
                theme === 'dark' ? "rotate-90 scale-0" : "rotate-0 scale-100"
              )} />
              <Moon className={cn("absolute inset-0 h-5 w-5 text-indigo-400 transition-all",
                theme === 'dark' ? "rotate-0 scale-100" : "-rotate-90 scale-0"
              )} />
            </div>
          </button>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications && unreadCount > 0) markAllAsRead();
            }}
            className="relative p-2 rounded-xl hover:bg-muted transition-colors group"
          >
            <Bell className="h-5 w-5 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background animate-pulse" />
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 md:w-96 max-w-96 glass-card border border-border/50 overflow-hidden z-50 origin-top-right text-foreground"
              >
                <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/50">
                  <h4 className="font-semibold text-sm">Notifications</h4>
                  <button onClick={() => setShowNotifications(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No new notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="p-4 border-b border-border/10 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between mb-1">
                          <span className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full border",
                            n.severity === 'critical'
                              ? "bg-red-500/10 text-red-500 border-red-500/20"
                              : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                          )}>
                            {n.severity.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {n.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <h5 className="text-sm font-medium text-foreground mb-0.5">{n.title}</h5>
                        <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <div className="relative ml-4 z-50">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 pr-3 rounded-full hover:bg-muted transition-colors border border-border/50"
          >
            <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <User className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium hidden md:block">{user?.name || user?.email || 'User'}</span>
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-48 glass-card border border-border/50 overflow-hidden z-50 origin-top-right text-foreground p-1"
              >
                <div className="px-3 py-2 border-b border-border/10 mb-1">
                  <p className="text-xs font-medium text-foreground">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-colors flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
