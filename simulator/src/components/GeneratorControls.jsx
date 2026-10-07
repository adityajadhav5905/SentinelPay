import { Sliders } from 'lucide-react';
import { CATEGORIES } from '../data/merchants.js';
import { LOCATIONS, CURRENCIES } from '../data/locations.js';

export function GeneratorControls({ config, setConfig }) {
  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const toggleCategory = (cat) => {
    setConfig(prev => {
      const cats = prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat];
      return { ...prev, categories: cats.length > 0 ? cats : prev.categories };
    });
  };

  const toggleLocation = (loc) => {
    setConfig(prev => {
      const locs = prev.locations.includes(loc)
        ? prev.locations.filter(l => l !== loc)
        : [...prev.locations, loc];
      return { ...prev, locations: locs.length > 0 ? locs : prev.locations };
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <Sliders size={15} /> Generator
      </div>
      <div className="card-body">
        {/* Categories */}
        <div className="form-group">
          <label className="form-label">Categories</label>
          <div className="checkbox-grid">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`chip ${config.categories.includes(cat) ? 'active' : ''}`}
                onClick={() => toggleCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Range */}
        <div className="form-group">
          <label className="form-label">Amount Range</label>
          <div className="form-row">
            <div>
              <input
                type="number"
                value={config.amountMin}
                onChange={(e) => update('amountMin', Math.max(1, Number(e.target.value)))}
                min="1"
                placeholder="Min"
              />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
            <div>
              <input
                type="number"
                value={config.amountMax}
                onChange={(e) => update('amountMax', Math.max(config.amountMin, Number(e.target.value)))}
                min="1"
                placeholder="Max"
              />
            </div>
          </div>
        </div>

        {/* Currency */}
        <div className="form-group">
          <label className="form-label">Currency</label>
          <select value={config.currency} onChange={(e) => update('currency', e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Locations */}
        <div className="form-group">
          <label className="form-label">Locations</label>
          <div className="checkbox-grid">
            {LOCATIONS.normal.slice(0, 10).map(loc => (
              <button
                key={loc}
                className={`chip ${config.locations.includes(loc) ? 'active' : ''}`}
                onClick={() => toggleLocation(loc)}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        {/* End Users */}
        <div className="form-group">
          <label className="form-label">End Users (auto-generated)</label>
          <div className="range-group">
            <input
              type="range"
              min="1"
              max="20"
              value={config.endUserCount}
              onChange={(e) => update('endUserCount', Number(e.target.value))}
            />
            <span className="range-value">{config.endUserCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
