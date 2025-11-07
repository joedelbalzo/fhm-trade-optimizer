// client/src/api.ts

import type { AnalyzeResponse, Mode, RosterResponse, Team, Player, PlayerSearchResponse, PlayerSearchParams } from './types';

const base = '';

export async function getTeams(): Promise<Team[]> {
  const r = await fetch(`${base}/api/teams`);
  if (!r.ok) throw new Error('Failed to fetch teams');
  return r.json();
}

export async function getRoster(abbrev: string): Promise<RosterResponse> {
  const r = await fetch(`${base}/api/teams/${abbrev}/roster`);
  if (!r.ok) throw new Error('Team not found');
  return r.json();
}

export async function analyze(payload: {
  mode: Mode;
  teamAbbrev?: string;
  playerIds?: number[];
}): Promise<any> {
  const r = await fetch(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      teamAbbrev: payload.teamAbbrev, 
      mode: payload.mode 
    })
  });
  if (!r.ok) throw new Error('Analyze failed');
  return r.json();
}

export async function searchPlayers(params: PlayerSearchParams): Promise<PlayerSearchResponse> {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const r = await fetch(`${base}/api/players?${searchParams}`);
  if (!r.ok) throw new Error('Failed to search players');
  return r.json();
}

export async function getPlayer(playerId: number): Promise<Player> {
  const r = await fetch(`${base}/api/players/${playerId}`);
  if (!r.ok) throw new Error('Player not found');
  return r.json();
}

export async function getSimilarPlayers(playerId: number, excludeTeam = false): Promise<{
  targetPlayer: Player;
  similarPlayers: Array<Player & { similarity: number }>;
}> {
  const r = await fetch(`${base}/api/players/similar/${playerId}?excludeTeam=${excludeTeam}`);
  if (!r.ok) throw new Error('Failed to find similar players');
  return r.json();
}

export async function getPositions(): Promise<string[]> {
  const r = await fetch(`${base}/api/players/positions`);
  if (!r.ok) throw new Error('Failed to get positions');
  return r.json();
}

export async function getAdvancedAnalysis(teamAbbrev: string): Promise<any> {
  const r = await fetch(`${base}/api/analyze/advanced`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamAbbrev })
  });
  if (!r.ok) throw new Error('Advanced analysis failed');
  return r.json();
}

export async function getSpecialTeamsAnalysis(teamAbbrev: string): Promise<any> {
  const r = await fetch(`${base}/api/analyze/special-teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamAbbrev })
  });
  if (!r.ok) throw new Error('Special teams analysis failed');
  return r.json();
}
