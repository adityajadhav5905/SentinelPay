import { useState } from 'react';
import { Plug, Zap, CheckCircle, XCircle, Loader, Eye, EyeOff, Key, Copy, Check } from 'lucide-react';
import { testConnection } from '../engine/sender.js';

export function ConnectionPanel({ apiUrl, setApiUrl, jwtToken, setJwtToken, connectionStatus, setConnectionStatus }) {
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setConnectionStatus({ status: 'testing' });
    const result = await testConnection(apiUrl, jwtToken);
    setConnectionStatus({
      status: result.connected ? 'connected' : 'error',
      message: result.message,
    });
    setTesting(false);
  };

  const copyToClipboard = () => {
    if (jwtToken) {
      navigator.clipboard.writeText(jwtToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plug size={16} className="text-accent" />
          <h3>Connection</h3>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className={`connection-indicator ${connectionStatus.status}`}>
            <span className={`connection-dot ${connectionStatus.status === 'connected' ? 'connected' : connectionStatus.status === 'error' ? 'error' : ''}`} />
            {connectionStatus.status === 'connected' ? <span style={{ color: 'var(--success)' }}>Live</span> :
              connectionStatus.status === 'error' ? <span style={{ color: 'var(--danger)' }}>Error</span> :
                connectionStatus.status === 'testing' ? <span style={{ color: 'var(--warning)' }}>Testing...</span> :
                  <span style={{ color: 'var(--text-muted)' }}>Offline</span>}
          </span>
        </div>
      </div>
      <div className="card-body">
        {/* API Endpoint */}
        <div className="form-group">
          <label className="form-label">API Endpoint</label>
          <input
            type="text"
            className="mono"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:3000/v1/transactions"
          />
        </div>

        {/* Auth Token (JWT / API Key) */}
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Key size={12} />
              Auth Token
            </div>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showToken ? 'text' : 'password'}
              className="mono"
              value={jwtToken}
              onChange={(e) => setJwtToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              style={{ paddingRight: 60 }}
            />
            <div style={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              gap: 2
            }}>
              <button
                onClick={() => setShowToken(!showToken)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 6,
                  display: 'flex',
                  borderRadius: 4,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {jwtToken === 'bypass' ? '⚡ Auth Bypass (Demo Mode)' : 'Required for ingestion'}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {jwtToken !== 'bypass' && (
                <button
                  onClick={() => setJwtToken('bypass')}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    height: 'auto',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid var(--accent, #38bdf8)',
                    borderRadius: 4,
                    color: 'var(--accent, #38bdf8)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  ⚡ Set Bypass
                </button>
              )}
              {jwtToken && (
                <button
                  onClick={copyToClipboard}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    height: 'auto',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.2s'
                  }}
                >
                  {copied ? <Check size={10} color="var(--success)" /> : <Copy size={10} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* User ID override */}
        <div className="form-group">
          <label className="form-label">User ID (auto-detected from token)</label>
          <input
            type="text"
            className="mono"
            placeholder="auto — set by ingestion service from auth"
            disabled
            style={{ opacity: 0.5 }}
          />
        </div>

        {/* Test Connection */}
        <button
          className={`btn ${testing ? 'btn-ghost' : 'btn-primary'}`}
          style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
          onClick={handleTest}
          disabled={testing || !apiUrl}
        >
          {testing ? <Loader size={14} className="animate-spin" /> : <Zap size={14} />}
          {testing ? 'Verifying...' : 'Test Connection'}
        </button>

        {connectionStatus.message && (
          <div style={{
            marginTop: 10,
            padding: 8,
            borderRadius: 6,
            background: connectionStatus.status === 'connected' ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${connectionStatus.status === 'connected' ? 'var(--success)' : 'var(--danger)'}`,
            color: connectionStatus.status === 'connected' ? 'var(--success)' : 'var(--danger)',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            {connectionStatus.status === 'connected' ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {connectionStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}
