import { useState, useEffect, useRef } from 'react';
import { Header } from '../components/layout/Header';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Wifi, WifiOff, Volume2, VolumeX,
  Pause, Play, Trash2, AlertTriangle, ShieldAlert,
  Zap, RefreshCw, ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { analyticsApi } from '../api-integration/analytics';

export default function LiveFeed() {
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [anomalies, setAnomalies] = useState([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0 });
  const [initialLoading, setInitialLoading] = useState(true);
  const eventSourceRef = useRef(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  // Load initial anomalies so feed is immediately populated
  useEffect(() => {
    const loadInitialFeed = async () => {
      try {
        setInitialLoading(true);
        const res = await analyticsApi.getAnomalies({ limit: 15 });
        const items = res?.data || [];
        if (items.length > 0) {
          setAnomalies(items);
          setStats({
            total: items.length,
            critical: items.filter(a => a.severity?.toUpperCase() === 'CRITICAL').length,
            high: items.filter(a => a.severity?.toUpperCase() === 'HIGH').length
          });
        }
      } catch (err) {
        console.error('Failed to load initial live feed items:', err);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialFeed();
  }, []);

  // Connect to SSE Stream
  useEffect(() => {
    const effectiveToken = token || localStorage.getItem('sentinelpay_token') || 'bypass';

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const url = `${import.meta.env.VITE_API_URL_ANALYTICS || 'http://localhost:3003'}/events/anomalies?token=${effectiveToken}`;
      const es = new EventSource(url);

      es.onopen = () => {
        setIsConnected(true);
      };

      es.onerror = () => {
        setIsConnected(false);
      };

      es.onmessage = (event) => {
        if (isPaused) return;

        try {
          const parsed = JSON.parse(event.data);

          if (parsed.type === 'anomaly' || parsed.tx_id || parsed.score) {
            const data = parsed.data || parsed;

            // Format item
            const formattedItem = {
              id: data.id || `live_${Date.now()}`,
              displayId: data.displayId || data.tx_id || `TXN-${Date.now().toString().slice(-4)}`,
              merchant: data.merchant || data.location || 'Digital Payment',
              severity: (data.severity || (data.score > 0.85 ? 'CRITICAL' : 'HIGH')).toUpperCase(),
              score: data.score || 0.85,
              amount: data.amount ? Number(data.amount) : 120.00,
              currency: data.currency || 'USD',
              explanation: data.explanation || 'Real-time anomaly detected via live stream.',
              timestamp: data.timestamp || new Date().toISOString(),
              userId: data.userId || 'Current Session'
            };

            // Update Stats
            setStats(prev => ({
              total: prev.total + 1,
              critical: prev.critical + (formattedItem.severity === 'CRITICAL' ? 1 : 0),
              high: prev.high + (formattedItem.severity === 'HIGH' ? 1 : 0)
            }));

            // Add to feed list (limit to 50 items)
            setAnomalies(prev => [formattedItem, ...prev].slice(0, 50));

            // Play Alert Sound
            if (soundEnabled && (formattedItem.severity === 'CRITICAL' || formattedItem.severity === 'HIGH')) {
              try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(formattedItem.severity === 'CRITICAL' ? 880 : 440, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.2);
              } catch {}
            }
          }
        } catch (e) {
          console.error('Error parsing live event:', e);
        }
      };

      eventSourceRef.current = es;
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [token, isPaused, soundEnabled]);

  const clearFeed = () => {
    setAnomalies([]);
    setStats({ total: 0, critical: 0, high: 0 });
    toast.info('Live feed cleared');
  };

  return (
    <div className="min-h-screen pb-20 relative max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Live Monitoring Stream
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 text-foreground">
            Live Operations Feed
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time transaction anomaly stream and instant alerts from connected payment gateways.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/investigations')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all"
          >
            <ShieldAlert className="h-4 w-4" />
            Open Investigations
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="sticky top-4 z-40 bg-card/80 backdrop-blur-md border border-border/50 p-3 md:p-4 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 md:gap-4">
        {/* Status Indicator */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors",
            isConnected
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          )}>
            <Wifi className="w-3 h-3" />
            <span>{isConnected ? 'Stream Connected' : 'Stream Ready'}</span>
          </div>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
        </div>

        {/* Stats Counters */}
        <div className="flex items-center gap-4 md:gap-6 text-sm">
          <div className="flex flex-col items-center">
            <span className="text-[10px] md:text-xs text-muted-foreground uppercase font-medium">Events</span>
            <span className="font-mono text-base md:text-lg font-bold text-foreground">{stats.total}</span>
          </div>
          <div className="w-px h-6 md:h-8 bg-border/50" />
          <div className="flex flex-col items-center text-red-500">
            <span className="text-[10px] md:text-xs opacity-80 uppercase font-medium">Critical</span>
            <span className="font-mono text-base md:text-lg font-bold">{stats.critical}</span>
          </div>
          <div className="w-px h-6 md:h-8 bg-border/50" />
          <div className="flex flex-col items-center text-orange-500">
            <span className="text-[10px] md:text-xs opacity-80 uppercase font-medium">High</span>
            <span className="font-mono text-base md:text-lg font-bold">{stats.high}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "p-2 rounded-xl transition-colors",
              soundEnabled ? "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            title={soundEnabled ? "Mute Alerts" : "Enable Alerts"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              "p-2 rounded-xl transition-colors border",
              isPaused
                ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20"
                : "bg-muted/50 text-foreground border-border/50 hover:bg-muted"
            )}
            title={isPaused ? "Resume Feed" : "Pause Feed"}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>

          <button
            onClick={clearFeed}
            className="p-2 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Clear Feed"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-3 relative min-h-[400px]">
        {initialLoading ? (
          <div className="py-24 text-center text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
            Loading live events stream...
          </div>
        ) : anomalies.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-muted-foreground/50 border border-dashed border-border rounded-2xl">
            <Activity className="w-12 h-12 mb-3 opacity-30 text-cyan-400" />
            <p className="text-base font-semibold text-foreground">Waiting for live stream events</p>
            <p className="text-xs text-muted-foreground mt-1">Start transactions in the simulator or upload a batch feed.</p>
          </div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {anomalies.map((item) => (
              <motion.div
                key={item.id || Math.random()}
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                layout
                onClick={() => navigate(`/investigations?txId=${encodeURIComponent(item.displayId || item.id)}`)}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-indigo-500/50 group",
                  "bg-card text-card-foreground",
                  item.severity === 'CRITICAL' ? "border-red-500/40 shadow-red-500/5" :
                    item.severity === 'HIGH' ? "border-orange-500/40 shadow-orange-500/5" :
                      "border-border"
                )}
              >
                {/* Severity Stripe */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1",
                  item.severity === 'CRITICAL' ? "bg-red-500" :
                    item.severity === 'HIGH' ? "bg-orange-500" :
                      item.severity === 'MEDIUM' ? "bg-yellow-500" : "bg-green-500"
                )} />

                <div className="flex items-start justify-between gap-4 pl-3">
                  <div className="flex items-start gap-3.5 flex-1">
                    <div className={cn(
                      "p-2.5 rounded-lg shrink-0",
                      item.severity === 'CRITICAL' ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                        item.severity === 'HIGH' ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" :
                          "bg-muted text-muted-foreground"
                    )}>
                      {item.severity === 'CRITICAL' ? <ShieldAlert className="w-5 h-5" /> :
                        item.severity === 'HIGH' ? <Zap className="w-5 h-5" /> :
                          <AlertTriangle className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.merchant || 'Digital Transaction'}
                        </h3>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                          item.severity === 'CRITICAL' ? "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30" :
                            item.severity === 'HIGH' ? "bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30" :
                              "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30"
                        )}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.explanation || 'Real-time anomaly detected.'}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono mt-1">
                        <span className="bg-muted px-1.5 py-0.5 rounded">ID: {item.displayId || item.id?.slice(0, 8)}</span>
                        <span>Time: {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline flex items-center gap-1 ml-auto">
                          Inspect Case <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-right shrink-0">
                    <span className="text-base font-bold text-foreground tabular-nums">
                      ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-xs font-bold font-mono",
                        item.score > 0.8 ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"
                      )}>
                        Risk: {Math.round((item.score || 0.8) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
