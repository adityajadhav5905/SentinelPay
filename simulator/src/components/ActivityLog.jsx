import { useRef, useEffect } from 'react';

export function ActivityLog({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  if (logs.length === 0) {
    return (
      <div className="activity-log" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14 }}>No transactions sent yet. Configure and press Start.</p>
      </div>
    );
  }

  return (
    <div className="activity-log">
      {logs.map((log, i) => (
        <div key={i} className="log-entry">
          <span className="time">{log.time}</span>
          <span className="status">{log.success ? '✅' : '❌'}</span>
          <span className="tx-id">{log.txId}</span>
          <span className="amount">{log.currency} {log.amount.toLocaleString()}</span>
          <span className="merchant">{log.merchant}</span>
          {log.isAnomaly && <span className="badge anomaly">🚨 {log.anomalyType || 'ANOMALY'}</span>}
          {!log.isAnomaly && log.success && <span className="badge normal">NORMAL</span>}
          {!log.success && (
            <span className="badge anomaly" title={log.error}>{log.statusCode || 'ERR'}</span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 40, textAlign: 'right' }}>{log.responseTime}ms</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
