export type Mode = 'win-now' | 'rebuild';

export interface Team { id: string | number; abbr: string; name: string; }

export type Clause = 'NMC' | 'NTC' | 'M-NTC' | 'None' | string;

export interface Contract {
  status?: string;          // UFA/RFA/ELC/…
  yearsLeft?: number | null;
  aav?: number | null;
  clause?: Clause | null;   // NMC / NTC / M-NTC / None
}

export interface PlayerRating {
  skating?: number;
  shooting?: number;
  playmaking?: number;
  defending?: number;
  physicality?: number;
  conditioning?: number;
  character?: number;
  hockeySense?: number;
  goalieTechnique?: number;
  goalieOverallPositioning?: number;
}

export interface Player {
  id: string | number;
  playerId?: number;
  firstName: string;
  lastName: string;
  position?: string;
  teamAbbrev?: string;
  dateOfBirth?: string;
  height?: number;
  weight?: number;
  birthCity?: string;
  nationalityOne?: string;
  retired?: boolean;

  // Related data
  team?: Team;
  ratings?: PlayerRating;
  seasonStats?: any[];

  // Optional contract info
  contract?: Contract;

  // tolerated legacy fields from backend until unified
  capHit?: number | null;
  yearsLeft?: number | null;
  rfaUfa?: string | null;
  clause?: Clause | null; // if backend sends clause separately
}

export interface RosterResponse { team: Team; players: Player[]; }

export interface AnalyzeWeakLink { player: { name: string; position?: string }; reason: string; }
export interface AnalyzeReplacement {
  suggestionType: 'reassign' | 'replace';
  note: string;
  candidate?: { name: string; teamAbbrev?: string | null };
}
export interface AnalyzeResponse { weakLinks: AnalyzeWeakLink[]; replacements: AnalyzeReplacement[]; }

// Player search types
export interface PlayerSearchParams {
  search?: string;
  position?: string;
  teamAbbr?: string;
  minAge?: number;
  maxAge?: number;
  minOverall?: number;
  maxOverall?: number;
  league?: string;
  sortBy?: 'name' | 'age' | 'position' | 'team';
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface PlayerSearchResponse {
  players: Player[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    pages: number;
  };
}
