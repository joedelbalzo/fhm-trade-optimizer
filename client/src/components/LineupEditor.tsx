import { useMemo, useState } from 'react';
import type { Mode, Player, Team } from '../types';

interface Props {
  team?: Team;
  players: Player[];
  mode: Mode;
  onAnalyze: () => void;
}

type SortKey = 'name' | 'pos' | 'status' | 'years' | 'aav';
type StatusFilter = 'all' | 'UFA' | 'RFA' | 'ELC' | 'non-elc';

export default function LineupEditor({ team, players, mode, onAnalyze }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('pos');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [maxYearsLeft, setMaxYearsLeft] = useState<number | ''>('');

  const clean = (s: string) => s.replace(/B�ckstr�m/g, 'Backstrom').replace(/�/g, 'o');
  const fmtName = (p: Player) => clean(`${p.firstName} ${p.lastName}`);
  const getStatus = (p: Player) => {
    const raw = p.contract?.status ?? p.rfaUfa ?? '';
    const up = String(raw || '').toUpperCase();
    if (up.includes('UFA')) return 'UFA';
    if (up.includes('RFA')) return 'RFA';
    if (up.includes('ELC')) return 'ELC';
    return raw || '—';
  };
  const getYears = (p: Player) => {
    const y = p.contract?.yearsLeft ?? p.yearsLeft;
    return y == null || y === '' ? null : Number(y);
  };
  const getAav = (p: Player) => {
    const n = p.contract?.aav ?? p.capHit;
    return n == null ? null : Number(n);
  };
  const money = (n: number | null) => n == null ? '—' : (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${n.toLocaleString()}`);

  const rows = useMemo(() => players.map(p => ({
    id: p.id,
    name: fmtName(p),
    pos: p.position || '—',
    status: getStatus(p),
    years: getYears(p),
    aav: getAav(p),
  })), [players]);

  // filters
  const filtered = useMemo(() => rows.filter(r => {
    if (status === 'UFA' && r.status !== 'UFA') return false;
    if (status === 'RFA' && r.status !== 'RFA') return false;
    if (status === 'ELC' && r.status !== 'ELC') return false;
    if (status === 'non-elc' && r.status === 'ELC') return false;
    if (maxYearsLeft !== '' && r.years != null && r.years > Number(maxYearsLeft)) return false;
    return true;
  }), [rows, status, maxYearsLeft]);

  // sorting
  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (a: any, b: any) => a > b ? 1 : a < b ? -1 : 0;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * cmp(a.name, b.name);
        case 'pos': return dir * (cmp(a.pos, b.pos) || cmp(a.name, b.name));
        case 'status': {
          const order = (s: string) => ({ RFA: 0, ELC: 1, UFA: 2, '—': 3 }[s] ?? 4);
          return dir * (cmp(order(a.status), order(b.status)) || cmp(a.name, b.name));
        }
        case 'years': return dir * (cmp(a.years ?? Infinity, b.years ?? Infinity) || cmp(a.name, b.name));
        case 'aav': return dir * (cmp(a.aav ?? Infinity, b.aav ?? Infinity) || cmp(a.name, b.name));
        default: return 0;
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    setSortKey(prev => (prev === key ? prev : key));
    setSortDir(prev => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
  };
  const mark = (k: SortKey) => sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '';
  const badgeClass = (s: string) => `badge ${s === 'UFA' ? 'badge--ufa' : s === 'RFA' ? 'badge--rfa' : ''}`;

  const tradeablePreset = () => { setStatus('non-elc'); setMaxYearsLeft(2); };
  const clearFilters = () => { setStatus('all'); setMaxYearsLeft(''); };

  return (
    <div className="section">
      <div style={{ marginBottom: 12 }}>
        <button disabled={!players.length} onClick={onAnalyze}>Analyze ({mode})</button>
      </div>
      <h3>Lineup</h3>
      {team ? (<div style={{ marginBottom: 8 }}><b>{team.name}</b> ({team.abbr})</div>) : (<div className="muted">No team selected</div>)}

      {/* Filters */}
      <div className="filters">
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as StatusFilter)}>
            <option value="all">All</option>
            <option value="UFA">UFA only</option>
            <option value="RFA">RFA only</option>
            <option value="ELC">ELC only</option>
            <option value="non-elc">Non-ELC</option>
          </select>
        </div>
        <div className="field">
          <label>Max years left</label>
          <input
            type="number"
            min="0"
            placeholder="e.g. 2"
            value={maxYearsLeft}
            onChange={e => setMaxYearsLeft(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ width: 120 }}
          />
        </div>
        <button className="btn--ghost" onClick={tradeablePreset} title="Non-ELC + ≤2 years">
          Tradeable preset
        </button>
        <button className="btn--ghost" onClick={clearFilters}>Clear</button>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="table w100" aria-label="Lineup">
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort('name')} style={{ width: "40%" }}>Player <span className="sort-caret">{mark('name')}</span></th>
              <th className="sortable" onClick={() => toggleSort('pos')} style={{ width: "10%" }}>Pos <span className="sort-caret">{mark('pos')}</span></th>
              <th className="sortable" onClick={() => toggleSort('status')} style={{ width: "15%" }}>UFA/RFA <span className="sort-caret">{mark('status')}</span></th>
              <th className="sortable" onClick={() => toggleSort('years')} style={{ width: "15%" }}>Years Left <span className="sort-caret">{mark('years')}</span></th>
              <th className="sortable" onClick={() => toggleSort('aav')} style={{ width: "20%" }}>Salary (AAV) <span className="sort-caret">{mark('aav')}</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center' }}>No players match filters.</td></tr>
            ) : sorted.map(r => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.pos}</td>
                <td><span className={badgeClass(r.status)}>{r.status}</span></td>
                <td className="monospaced">{r.years ?? '—'}</td>
                <td className="monospaced">{money(r.aav)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


    </div >
  );
}
