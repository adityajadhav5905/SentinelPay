import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mlClient } from '../../api-integration/client';
import { Info, Upload, X, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ProfileStatusBanner — Non-blocking informational banner
 * 
 * Shows only when user's behavioral profile is NEW or INCOMPLETE.
 * Purely informational — warns that anomaly detection may not be accurate.
 * Dismissible (persisted in localStorage).
 */
export function ProfileStatusBanner({ userId }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Check localStorage for dismissal
  useEffect(() => {
    const key = `profile_banner_dismissed_${userId}`;
    if (localStorage.getItem(key) === 'true') {
      setDismissed(true);
    }
  }, [userId]);

  // Fetch profile status from ML service
  const { data: profileStatus, isLoading } = useQuery({
    queryKey: ['profileStatus', userId],
    queryFn: async () => {
      const res = await mlClient.get(`/v1/profile/${userId}/status`);
      return res.data;
    },
    enabled: !!userId && !dismissed,
    refetchInterval: 60000, // Check every minute
    retry: 1,
  });

  const handleDismiss = () => {
    const key = `profile_banner_dismissed_${userId}`;
    localStorage.setItem(key, 'true');
    setDismissed(true);
  };

  // Don't show if dismissed, loading, or profile is READY
  if (dismissed || isLoading || !profileStatus || profileStatus.profile_status === 'READY') {
    return null;
  }

  const isNew = profileStatus.profile_status === 'NEW';
  const monthsCovered = Math.max(0, profileStatus.data_months_covered || 0);
  const minMonths = profileStatus.min_months_required || 6;
  const progress = Math.min((monthsCovered / minMonths) * 100, 100);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-6"
      >
        <div className="relative bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Info className="w-5 h-5 text-indigo-400" />
            </div>

            <div className="flex-1 min-w-0">
              {isNew ? (
                <>
                  <p className="text-sm text-foreground/90 font-medium mb-1">
                    Anomaly detection accuracy improves with historical data
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Consider uploading at least 6 months of transaction history to build your behavioral profile.
                    Without sufficient data, detection results may be less accurate.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground/90 font-medium mb-1">
                    Your behavioral profile is building
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {monthsCovered.toFixed(1)} months of data covered.
                    Detection accuracy will improve as more data is added.
                  </p>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {monthsCovered.toFixed(1)}/{minMonths}mo
                    </span>
                  </div>
                </>
              )}

              {/* Upload link */}
              <button
                onClick={() => navigate('/upload')}
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Upload className="w-3 h-3" />
                <span>Upload historical data</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
