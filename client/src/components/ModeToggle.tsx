// src/components/ModeToggle.tsx
import type { Mode } from '../types';

export default function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void; }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ marginRight: 12 }}>
        <input type="radio" name="mode" value="win-now" checked={mode === 'win-now'} onChange={() => setMode('win-now')} />
        {' '}Win-Now
      </label>
      <label>
        <input type="radio" name="mode" value="rebuild" checked={mode === 'rebuild'} onChange={() => setMode('rebuild')} />
        {' '}Rebuild
      </label>
    </div>
  );
}
