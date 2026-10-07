import { AlertTriangle } from 'lucide-react';
import { ANOMALY_TYPE_LABELS } from '../engine/anomaly-injector.js';

export function AnomalyControls({ config, setConfig }) {
  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const toggleType = (type) => {
    setConfig(prev => {
      const types = prev.anomalyTypes.includes(type)
        ? prev.anomalyTypes.filter(t => t !== type)
        : [...prev.anomalyTypes, type];
      return { ...prev, anomalyTypes: types };
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <AlertTriangle size={15} /> Anomaly Injection
      </div>
      <div className="card-body">
        {/* Anomaly Rate */}
        <div className="form-group">
          <label className="form-label">Anomaly Rate</label>
          <div className="range-group">
            <input
              type="range"
              min="0"
              max="100"
              value={config.anomalyPercent}
              onChange={(e) => update('anomalyPercent', Number(e.target.value))}
            />
            <span className="range-value" style={{ color: config.anomalyPercent > 50 ? 'var(--danger)' : config.anomalyPercent > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
              {config.anomalyPercent}%
            </span>
          </div>
        </div>

        {/* Anomaly Types */}
        <div className="form-group">
          <label className="form-label">Anomaly Types</label>
          <div className="checkbox-grid">
            {Object.entries(ANOMALY_TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`chip ${config.anomalyTypes.includes(key) ? 'active' : ''}`}
                onClick={() => toggleType(key)}
                style={config.anomalyTypes.includes(key) ? { borderColor: 'var(--danger)', color: 'var(--danger)', background: 'var(--danger-bg)' } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Pattern */}
        <div className="form-group">
          <label className="form-label">Pattern</label>
          <div className="toggle-group">
            <button
              className={`toggle-option ${config.anomalyPattern === 'random' ? 'active' : ''}`}
              onClick={() => update('anomalyPattern', 'random')}
            >
              Random
            </button>
            <button
              className={`toggle-option ${config.anomalyPattern === 'periodic' ? 'active' : ''}`}
              onClick={() => update('anomalyPattern', 'periodic')}
            >
              Periodic
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
