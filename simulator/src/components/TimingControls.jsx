import { Timer } from 'lucide-react';

export function TimingControls({ config, setConfig }) {
  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  return (
    <div className="card">
      <div className="card-header">
        <Timer size={15} /> Timing
      </div>
      <div className="card-body">
        {/* Delay Mode */}
        <div className="form-group">
          <label className="form-label">Delay Mode</label>
          <div className="toggle-group">
            <button
              className={`toggle-option ${config.delayMode === 'constant' ? 'active' : ''}`}
              onClick={() => update('delayMode', 'constant')}
            >
              Constant
            </button>
            <button
              className={`toggle-option ${config.delayMode === 'random' ? 'active' : ''}`}
              onClick={() => update('delayMode', 'random')}
            >
              Random
            </button>
          </div>
        </div>

        {/* Constant Delay */}
        {config.delayMode === 'constant' && (
          <div className="form-group">
            <label className="form-label">Delay (ms)</label>
            <div className="range-group">
              <input
                type="range"
                min="100"
                max="30000"
                step="100"
                value={config.delayConstant}
                onChange={(e) => update('delayConstant', Number(e.target.value))}
              />
              <span className="range-value">{config.delayConstant >= 1000 ? `${(config.delayConstant / 1000).toFixed(1)}s` : `${config.delayConstant}ms`}</span>
            </div>
          </div>
        )}

        {/* Random Delay Range */}
        {config.delayMode === 'random' && (
          <div className="form-group">
            <label className="form-label">Delay Range (ms)</label>
            <div className="form-row">
              <div>
                <input
                  type="number"
                  value={config.delayMin}
                  onChange={(e) => update('delayMin', Math.max(100, Number(e.target.value)))}
                  min="100"
                  step="100"
                  placeholder="Min"
                />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
              <div>
                <input
                  type="number"
                  value={config.delayMax}
                  onChange={(e) => update('delayMax', Math.max(config.delayMin, Number(e.target.value)))}
                  min="100"
                  step="100"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>
        )}

        {/* Total Transactions */}
        <div className="form-group">
          <label className="form-label">Total Transactions</label>
          <div className="form-row">
            <input
              type="number"
              value={config.totalTransactions}
              onChange={(e) => update('totalTransactions', Math.max(1, Number(e.target.value)))}
              min="1"
              placeholder="Count"
            />
          </div>
        </div>

        {/* Burst Mode */}
        <div className="form-group">
          <label className="form-label">Burst Mode</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="toggle-group">
              <button
                className={`toggle-option ${!config.burstMode ? 'active' : ''}`}
                onClick={() => update('burstMode', false)}
              >
                Off
              </button>
              <button
                className={`toggle-option ${config.burstMode ? 'active' : ''}`}
                onClick={() => update('burstMode', true)}
              >
                On
              </button>
            </div>
          </div>
        </div>

        {config.burstMode && (
          <div className="form-group">
            <div className="form-row">
              <div>
                <label className="form-label">Burst Size</label>
                <input
                  type="number"
                  value={config.burstCount}
                  onChange={(e) => update('burstCount', Math.max(2, Number(e.target.value)))}
                  min="2"
                />
              </div>
              <div>
                <label className="form-label">Pause (ms)</label>
                <input
                  type="number"
                  value={config.burstPause}
                  onChange={(e) => update('burstPause', Math.max(100, Number(e.target.value)))}
                  min="100"
                  step="100"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
