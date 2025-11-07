// src/store/rosterCacheSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RosterResponse } from '../types';

export type CacheEntry = { ts: number; roster: RosterResponse };

export interface RosterCacheState {
  byTeam: Record<string, CacheEntry | undefined>;
  ttlMs: number;
}

const initialState: RosterCacheState = {
  byTeam: {},
  ttlMs: 10 * 60 * 1000, // 10 minutes
};

const rosterCache = createSlice({
  name: 'rosterCache',
  initialState,
  reducers: {
    upsertRoster(
      state,
      action: PayloadAction<{ teamAbrev: string; roster: RosterResponse; now?: number }>
    ) {
      const { teamAbrev, roster, now } = action.payload;
      state.byTeam[teamAbrev] = { ts: now ?? Date.now(), roster };
    },
    setTTL(state, action: PayloadAction<number>) {
      state.ttlMs = action.payload;
    },
    purgeExpired(state, action: PayloadAction<{ now?: number } | undefined>) {
      const now = action?.payload?.now ?? Date.now();
      for (const [k, v] of Object.entries(state.byTeam)) {
        if (!v) continue;
        if (now - v.ts > state.ttlMs) delete state.byTeam[k];
      }
    },
    clearAll(state) {
      state.byTeam = {};
    },
  },
});

export const { upsertRoster, setTTL, purgeExpired, clearAll } = rosterCache.actions;
export default rosterCache.reducer;

// selectors
export const selectRosterIfFresh = (
  s: { rosterCache: RosterCacheState },
  teamAbrev: string
): RosterResponse | null => {
  const entry = s.rosterCache.byTeam[teamAbrev];
  if (!entry) return null;
  if (Date.now() - entry.ts > s.rosterCache.ttlMs) return null;
  return entry.roster;
};
