import { Play, Pause, Square, Download, RotateCcw } from 'lucide-react';

export function ControlBar({ status, onStart, onPause, onStop, onReset, onExport, elapsed, progress }) {
  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="control-bar">
      {status === 'idle' || status === 'stopped' || status === 'completed' ? (
        <button className="btn btn-success" onClick={onStart}>
          <Play size={15} /> Start
        </button>
      ) : status === 'running' ? (
        <button className="btn btn-warning" onClick={onPause}>
          <Pause size={15} /> Pause
        </button>
      ) : status === 'paused' ? (
        <button className="btn btn-success" onClick={onStart}>
          <Play size={15} /> Resume
        </button>
      ) : null}

      <button className="btn btn-danger" onClick={onStop} disabled={status === 'idle' || status === 'stopped'}>
        <Square size={15} /> Stop
      </button>

      <button className="btn btn-ghost" onClick={onReset}>
        <RotateCcw size={15} /> Reset
      </button>

      <div className="spacer" />

      {progress && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {progress}
        </span>
      )}

      <span className="session-timer">{formatTime(elapsed)}</span>

      <button className="btn btn-ghost btn-sm" onClick={onExport} title="Export CSV">
        <Download size={14} /> CSV
      </button>
    </div>
  );
}
