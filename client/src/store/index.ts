// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import rosterCacheReducer, { RosterCacheState } from './rosterCacheSlice';

export interface RootState {
  rosterCache: RosterCacheState;
}

const LS_KEY = 'hroster.cache.v1';

let preloaded: Partial<RootState> | undefined = undefined;
try {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) preloaded = { rosterCache: JSON.parse(raw) };
} catch { }

export const store = configureStore({
  reducer: { rosterCache: rosterCacheReducer },
  preloadedState: preloaded,
});

store.subscribe(() => {
  try {
    const state = store.getState() as RootState;
    localStorage.setItem(LS_KEY, JSON.stringify(state.rosterCache));
  } catch { }
});

export type AppDispatch = typeof store.dispatch;
export type { RootState as AppRootState };
