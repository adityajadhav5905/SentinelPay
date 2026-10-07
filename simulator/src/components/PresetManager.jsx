import { Bookmark } from 'lucide-react';
import { PRESETS } from '../engine/presets.js';

export function PresetManager({ setConfig }) {
  const applyPreset = (key) => {
    setConfig(JSON.parse(JSON.stringify(PRESETS[key].config)));
  };

  return (
    <div className="card">
      <div className="card-header">
        <Bookmark size={15} /> Presets
      </div>
      <div className="card-body">
        <div className="preset-row">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              key={key}
              className="preset-btn"
              onClick={() => applyPreset(key)}
              title={preset.description}
            >
              {preset.icon} {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
