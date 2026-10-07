import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { UploadProgressBar } from '../common/UploadProgressBar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Sidebar />
      <main className="px-4 pt-16 pb-8 md:pl-[280px] md:pr-8 md:pt-8 min-h-screen">
        <Outlet />
      </main>
      <UploadProgressBar />
      <Toaster position="top-right" toastOptions={{
        className: 'glass-card border-border/50 text-foreground',
        style: { background: 'var(--color-card)', color: 'var(--color-foreground)' }
      }} />
    </div>
  );
}
