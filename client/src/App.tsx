import { useEffect, useMemo, useState } from 'react';
import { getTeams, getRoster, analyze, getComprehensiveWeaknesses } from './api';
import type { AnalyzeResponse, Mode, Team, Player, RosterResponse } from './types';
import ModeToggle from './components/ModeToggle';
import LineupEditor from './components/LineupEditor';
import Results from './components/Results';
import Loader from './components/Loader';
import SplitCols from './components/SplitCols';

import { useAppDispatch, useAppSelector } from './store/hooks';
import { purgeExpired, selectRosterIfFresh, upsertRoster } from './store/rosterCacheSlice';

export default function App() {
  const dispatch = useAppDispatch();

  const [teams, setTeams] = useState<Team[]>([]);
  const [abbrev, setAbbrev] = useState<string>('');
  const [mode, setMode] = useState<Mode>('win-now');
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const [err, setErr] = useState<string>('');
  const [loadingTeams, setLoadingTeams] = useState<boolean>(false);
  const [loadingRoster, setLoadingRoster] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  useEffect(() => {
    setLoadingTeams(true);
    getTeams()
      .then(setTeams)
      .catch((e) => setErr(String(e)))
      .finally(() => setLoadingTeams(false));
  }, []);

  const rosterFromCache = useAppSelector((s) => (abbrev ? selectRosterIfFresh(s, abbrev) : null));
  const roster: RosterResponse | null = rosterFromCache ?? null;
  const players: Player[] = roster?.players ?? [];

  useEffect(() => {
    if (!abbrev) return;
    setErr('');
    setResult(null);
    dispatch(purgeExpired(undefined));
    if (rosterFromCache) return;

    setLoadingRoster(true);
    getRoster(abbrev)
      .then((r) => dispatch(upsertRoster({ teamAbrev: abbrev, roster: r })))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoadingRoster(false));
  }, [abbrev]);

  const loadRoster = (a: string) => setAbbrev(a);

  const runAnalyze = async () => {
    if (!abbrev) return;
    setAnalyzing(true);
    setErr('');
    setResult(null);
    try {
      const payload = { mode, teamAbbrev: abbrev };
      const data = await analyze(payload);
      setResult(data);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  const left = (
    <>
      <div className="section" style={{ paddingBottom: 0 }}>
        <div className="controls" style={{ marginBottom: 10 }}>
          <label>Team:</label>
          <select value={abbrev} onChange={(e) => loadRoster(e.target.value)}>
            <option value="">— select —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.abbr}>
                {t.abbr} — {t.name}
              </option>
            ))}
          </select>
          {loadingTeams && <Loader label="Loading…" />}
        </div>
        <ModeToggle mode={mode} setMode={setMode} />
      </div>

      <div className="section" style={{ position: 'relative', minHeight: 140 }}>
        {loadingRoster && (<div className="loading-overlay"><Loader label="Loading roster…" /></div>)}
        <LineupEditor team={roster?.team} players={players} mode={mode} onAnalyze={runAnalyze} />
      </div>
    </>
  );

  const right = (
    <>
      <div className="section">
        {err && <div className="muted" style={{ marginBottom: 10, color: '#f87171' }}>{err}</div>}
        {!result && !analyzing && <div className="muted">Run an analysis to see weak links and recommendations.</div>}
        <Results data={result} />
      </div>
      {analyzing && (<div className="loading-overlay"><Loader label="Analyzing…" /></div>)}
    </>
  );

  return (
    <div className="container">
      <h2>Hockey Lineup Optimizer</h2>
      <SplitCols left={left} right={right} initialLeftPct={70} />
    </div>
  );
}
