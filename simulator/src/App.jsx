import { useState, useRef, useCallback, useEffect } from 'react';
import { Sun, Moon, ExternalLink } from 'lucide-react';
import { ConnectionPanel } from './components/ConnectionPanel.jsx';
import { GeneratorControls } from './components/GeneratorControls.jsx';
import { TimingControls } from './components/TimingControls.jsx';
import { AnomalyControls } from './components/AnomalyControls.jsx';
import { PresetManager } from './components/PresetManager.jsx';
import { ActivityLog } from './components/ActivityLog.jsx';
import { StatsPanel } from './components/StatsPanel.jsx';
import { ControlBar } from './components/ControlBar.jsx';
import { generateTransaction, generateEndUserIds } from './engine/generator.js';
import { maybeInjectAnomaly } from './engine/anomaly-injector.js';
import { sendTransaction } from './engine/sender.js';
import { getDefaultConfig } from './engine/presets.js';


export default function App() {
  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sentinelpay_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.className = theme;
    localStorage.setItem('sentinelpay_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Connection
  const [apiUrl, setApiUrl] = useState('http://localhost:3000/v1/transactions');
  const [jwtToken, setJwtToken] = useState('bypass');
  const [connectionStatus, setConnectionStatus] = useState({ status: 'idle' });

  // Config — configRef is kept in sync so the engine always reads live values
  const [config, setConfig] = useState(getDefaultConfig());
  const configRef = useRef(config);
  const apiUrlRef = useRef(apiUrl);
  const jwtTokenRef = useRef(jwtToken);

  // Keep refs in sync with state
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { apiUrlRef.current = apiUrl; }, [apiUrl]);
  useEffect(() => { jwtTokenRef.current = jwtToken; }, [jwtToken]);

  // Engine state
  const [status, setStatus] = useState('idle'); // idle | running | paused | stopped | completed
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    total: 0, success: 0, failed: 0, anomalies: 0, avgResponseTime: 0,
  });
  const [rateHistory, setRateHistory] = useState([]);
  const [elapsed, setElapsed] = useState(0);

  // Refs for engine
  const engineRef = useRef({
    running: false,
    paused: false,
    index: 0,
    totalResponseTime: 0,
    rateCounter: 0,
    startTime: 0,
  });
  const timerRef = useRef(null);
  const rateRef = useRef(null);

  // Timer
  useEffect(() => {
    if (status === 'running') {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - engineRef.current.startTime);
      }, 1000);

      // Rate tracker — counts TPS every second
      rateRef.current = setInterval(() => {
        setRateHistory(prev => {
          const newHistory = [...prev, engineRef.current.rateCounter];
          engineRef.current.rateCounter = 0;
          // Keep last 60 data points
          return newHistory.slice(-60);
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      clearInterval(rateRef.current);
    }
    return () => {
      clearInterval(timerRef.current);
      clearInterval(rateRef.current);
    };
  }, [status]);

  // Compute delay — always reads from configRef so it's live
  const getDelay = useCallback(() => {
    const cfg = configRef.current;
    if (cfg.delayMode === 'constant') return cfg.delayConstant;
    const min = cfg.delayMin;
    const max = cfg.delayMax;
    return Math.floor(Math.random() * (max - min) + min);
  }, []);

  // Core simulation loop — reads from refs so it always uses latest UI config
  const runSimulation = useCallback(async () => {
    const engine = engineRef.current;
    engine.running = true;
    engine.paused = false;

    // Snapshot endUserIds at start from current config
    let endUserIds = generateEndUserIds(configRef.current.endUserCount);
    let lastEndUserCount = configRef.current.endUserCount;

    while (engine.running && engine.index < configRef.current.totalTransactions) {
      // Check pause
      while (engine.paused && engine.running) {
        await new Promise(r => setTimeout(r, 100));
      }
      if (!engine.running) break;

      // Read LIVE config on every iteration
      const cfg = configRef.current;

      // Regenerate endUserIds if count changed
      if (cfg.endUserCount !== lastEndUserCount) {
        endUserIds = generateEndUserIds(cfg.endUserCount);
        lastEndUserCount = cfg.endUserCount;
      }

      // Burst mode
      const burstSize = cfg.burstMode ? cfg.burstCount : 1;

      for (let b = 0; b < burstSize && engine.index < cfg.totalTransactions; b++) {
        if (!engine.running) break;

        // Generate transaction using live config (categories, amounts, locations, currency)
        const tx = generateTransaction(cfg, endUserIds);
        // Inject anomaly using live config (anomalyPercent, anomalyTypes, anomalyPattern)
        const finalTx = maybeInjectAnomaly(tx, cfg, engine.index);

        // Send using live API URL and token
        const result = await sendTransaction(finalTx, apiUrlRef.current, jwtTokenRef.current);

        // Track rate
        engine.rateCounter++;

        // Build log entry
        const now = new Date();
        const logEntry = {
          time: now.toLocaleTimeString('en-IN', { hour12: false }),
          success: result.success,
          txId: finalTx.txId,
          amount: finalTx.amount,
          currency: finalTx.currency,
          merchant: finalTx.merchant,
          category: finalTx.category,
          location: finalTx.location,
          isAnomaly: finalTx._meta.isAnomaly,
          anomalyType: finalTx._meta.anomalyType,
          responseTime: result.responseTime,
          statusCode: result.status,
          error: result.error,
        };

        // Update state
        engine.index++;
        engine.totalResponseTime += result.responseTime;

        setLogs(prev => [...prev.slice(-499), logEntry]); // Keep last 500
        setStats(prev => ({
          total: prev.total + 1,
          success: prev.success + (result.success ? 1 : 0),
          failed: prev.failed + (result.success ? 0 : 1),
          anomalies: prev.anomalies + (finalTx._meta.isAnomaly ? 1 : 0),
          avgResponseTime: Math.round(engine.totalResponseTime / engine.index),
        }));
      }

      // Delay between transactions/bursts — uses live config values
      if (engine.running && engine.index < configRef.current.totalTransactions) {
        const delay = configRef.current.burstMode ? configRef.current.burstPause : getDelay();
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (engine.running) {
      setStatus('completed');
    }
    engine.running = false;
  }, [getDelay]);

  // Controls
  const handleStart = useCallback(() => {
    if (status === 'paused') {
      engineRef.current.paused = false;
      setStatus('running');
      return;
    }
    // Fresh start
    if (status !== 'running') {
      engineRef.current.index = 0;
      engineRef.current.totalResponseTime = 0;
      engineRef.current.rateCounter = 0;
      engineRef.current.startTime = Date.now();
      setLogs([]);
      setStats({ total: 0, success: 0, failed: 0, anomalies: 0, avgResponseTime: 0 });
      setRateHistory([]);
      setElapsed(0);
      setStatus('running');
      runSimulation();
    }
  }, [status, runSimulation]);

  const handlePause = useCallback(() => {
    engineRef.current.paused = true;
    setStatus('paused');
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current.running = false;
    engineRef.current.paused = false;
    setStatus('stopped');
  }, []);

  const handleReset = useCallback(() => {
    engineRef.current.running = false;
    engineRef.current.paused = false;
    engineRef.current.index = 0;
    engineRef.current.totalResponseTime = 0;
    engineRef.current.rateCounter = 0;
    setStatus('idle');
    setLogs([]);
    setStats({ total: 0, success: 0, failed: 0, anomalies: 0, avgResponseTime: 0 });
    setRateHistory([]);
    setElapsed(0);
  }, []);

  const handleExport = useCallback(() => {
    if (logs.length === 0) return;
    const headers = 'Time,Status,TxID,Amount,Currency,Merchant,Category,Location,IsAnomaly,AnomalyType,ResponseTime,StatusCode,Error\n';
    const csv = logs.map(l =>
      `${l.time},${l.success ? 'OK' : 'FAIL'},${l.txId},${l.amount},${l.currency},"${l.merchant}","${l.category}","${l.location}",${l.isAnomaly},${l.anomalyType || ''},${l.responseTime},${l.statusCode},"${l.error || ''}"`
    ).join('\n');

    const blob = new Blob([headers + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinelpay-sim-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  const progress = status !== 'idle'
    ? `${engineRef.current.index} / ${config.totalTransactions}`
    : null;

  return (
    <div className="app" data-theme={theme}>
      {/* Header */}
      <header className="app-header">
        <h1>
          <span className="icon">⚡</span>
          SentinelPay Simulator
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {status === 'running' && <span className="header-badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'rgba(16,185,129,0.3)' }}>● RUNNING</span>}
          {status === 'paused' && <span className="header-badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)' }}>⏸ PAUSED</span>}
          {status === 'completed' && <span className="header-badge">✔ COMPLETED</span>}
          
          <a 
            href="http://localhost:5173" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="header-badge" 
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
            title="Open Main SentinelPay Console"
          >
            Open App <ExternalLink size={11} />
          </a>

          <button 
            onClick={toggleTheme} 
            className="theme-toggle-btn" 
            aria-label="Toggle light/dark theme"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={17} color="#f59e0b" /> : <Moon size={17} color="#4f46e5" />}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="app-body">
        {/* Sidebar - Controls */}
        <div className="sidebar">
          <ConnectionPanel
            apiUrl={apiUrl}
            setApiUrl={setApiUrl}
            jwtToken={jwtToken}
            setJwtToken={setJwtToken}
            connectionStatus={connectionStatus}
            setConnectionStatus={setConnectionStatus}
          />
          <PresetManager setConfig={setConfig} />
          <GeneratorControls config={config} setConfig={setConfig} />
          <TimingControls config={config} setConfig={setConfig} />
          <AnomalyControls config={config} setConfig={setConfig} />
        </div>

        {/* Main Panel */}
        <div className="main-panel">
          <StatsPanel stats={stats} rateHistory={rateHistory} />
          <ActivityLog logs={logs} />
        </div>
      </div>

      {/* Control Bar */}
      <ControlBar
        status={status}
        onStart={handleStart}
        onPause={handlePause}
        onStop={handleStop}
        onReset={handleReset}
        onExport={handleExport}
        elapsed={elapsed}
        progress={progress}
      />
    </div>
  );
}
