/**
 * Role-aware player evaluation for hockey (FHM-friendly).
 * - No external deps
 * - No switch statements (maps/objects only)
 * - Explainable outputs: impact, misuse, confidence, drivers, recommendation
 *
 * HOW TO USE (minimal):
 *   1) Collect league benchmarks per role (means & stddevs for metrics below).
 *   2) Build a PlayerInput with bio + season stats + ratings + deployment.
 *   3) Call evaluatePlayer(player, league).
 *
 * You can start with rough league means/sds, then refine from your data.
 */

/* ==============================
   Types
   ============================== */

export type Position = 'F' | 'D' | 'G';

export type Role =
  | 'scorer'
  | 'playmaker'
  | 'twoWayF'
  | 'defensiveC'
  | 'grinder'
  | 'offensiveD'
  | 'shutdownD'
  | 'goalie';

export interface PlayerBio {
  firstName?: string;
  lastName?: string;
  nickName?: string;
  position: Position;
  birthYear?: number | null;
  teamAbbrev?: string | null;
}

export interface SeasonCounting {
  gamesPlayed?: number;
  goals?: number;
  assists?: number;
  points?: number; // convenience
  penaltyMinutes?: number;
  hits?: number;
  fights?: number;
  fightsWon?: number;
  giveaways?: number;
  takeaways?: number;
  shotBlocks?: number;
  shotsOnGoal?: number;
  faceoffs?: number;
  faceoffWins?: number;
  plusMinus?: number;
  powerPlayGoals?: number;
  powerPlayAssists?: number;
  shortHandedGoals?: number;
  shortHandedAssists?: number;
  gameWinningGoals?: number;
}

export interface SeasonDeployment {
  timeOnIce?: number;                 // total minutes
  powerPlayTimeOnIce?: number;        // minutes
  shortHandedTimeOnIce?: number;      // minutes
  // If you have zone starts / QoC / QoT, feed them in here (optional):
  ozStartPct?: number;                // 0..1 (optional)
  qocTier?: number;                   // higher = tougher (optional)
  qotTier?: number;                   // higher = better linemates (optional)
}

export interface SeasonRates {
  goalsFor60?: number;
  goalsAgainst60?: number;
  shotsFor60?: number;
  shotsAgainst60?: number;
  pdo?: number; // 100=neutral typical
  // Corsi / Fenwick:
  corsiFors?: number;
  corsiAgainst?: number;
  corsiForPercentage?: number;
  corsiForPercentageRelative?: number;
  fenwickFor?: number;
  fenwickAgainst?: number;
  fenwickForPercentage?: number;
  fenwickForPercentageRelative?: number;
  // Goalie-only (if you track):
  savePct?: number;
  gaa?: number;
  hdSavePct?: number;
  // Expected goals (if available):
  xGF60?: number;
  xGA60?: number;
}

export interface Ratings // subset; add more as you like
{
  // Mental / IQ
  offensiveRead?: number;
  defensiveRead?: number;
  hockeySense?: number;

  // Physical
  speed?: number;
  skating?: number;
  strength?: number;
  physicality?: number;
  stamina?: number;

  // Offense
  shooting?: number;          // shot power
  shootingAccuracy?: number;
  shootingRange?: number;
  playmaking?: number;
  passing?: number;
  gettingOpen?: number;
  puckHandling?: number;
  screening?: number;

  // Defense
  checking?: number;
  hitting?: number;
  stickchecking?: number;
  positioning?: number;
  shotBlocking?: number;
  faceoffs?: number;

  // Goalie (if GK)
  gPositioning?: number;
  goalieOverallPositioning?: number;
  blocker?: number;
  glove?: number;
  lowShots?: number;
  reflexes?: number;
  rebound?: number;
  recovery?: number;
  gPassing?: number;
  gPokecheck?: number;
  gPuckhandling?: number;
  gSkating?: number;
  goalieTechnique?: number;
}

export interface PlayerInput {
  bio: PlayerBio;
  season: SeasonCounting & SeasonDeployment & SeasonRates;
  ratings: Ratings;
}

export interface MeanSd {
  mean: number;
  sd: number; // if 0 or tiny, z will be 0 to avoid blow-ups
}

export type MetricKey =
  | 'goals60' | 'primA60' | 'xGF60' | 'shotsF60' | 'shootAcc'
  | 'xGA60' | 'cfRel' | 'takeaways60' | 'blocks60' | 'pkGA60'
  | 'giveaways60' | 'penalties60' | 'faceoffPct' | 'pdo'
  | 'ppP60'
  // D helpers
  | 'dzStarts' | 'qoc' | 'qot'
  // goalie
  | 'svPct' | 'hdSvPct' | 'gsaX'
  ;

export type MetricSummary = Record<MetricKey, MeanSd | undefined>;

export interface LeagueRoleBenchmarks {
  // Benchmarks used for z-scoring within role
  [role: string]: MetricSummary | undefined;
}

export interface LeagueContext {
  // Replacement level: define as 25th percentile ≈ mean - 0.674*sd for Impact by role
  impactMeanSdByRole: Record<Role, MeanSd>;
  // For z-scoring each ingredient by role:
  metricsByRole: LeagueRoleBenchmarks;
  // Global reference for PDO (optional), defaults if missing:
  pdoRef?: MeanSd; // e.g., mean 100, sd ~2
  // Minimum minutes for confidence (per role you can vary if you like):
  minTOIForConfidence?: number; // e.g., 300 EV min
}

/* ==============================
   Helpers (math, normalization)
   ============================== */

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const safe = (x?: number | null, def = 0) => (Number.isFinite(x as number) ? (x as number) : def);
const z = (val: number, ms?: MeanSd) => {
  const sd = ms?.sd ?? 0;
  return sd > 1e-8 ? (val - (ms!.mean)) / sd : 0;
};
const shrink = (val: number, n: number, priorMean: number, priorWeight: number) =>
  (val * n + priorMean * priorWeight) / (n + priorWeight + 1e-9);

const cosineDistance = (a: number[], b: number[]) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] ?? 0, bi = b[i] ?? 0;
    dot += ai * bi; na += ai * ai; nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  const cos = dot / denom;
  return 1 - clamp(cos, -1, 1); // distance in [0,2]; we treat 0..1 range typically
};

/* ==============================
   Role prototypes (classification)
   ============================== */

/**
 * We classify by computing dot products between:
 *   - Skill vector (from ratings)
 *   - Usage vector (from deployment)
 * and role prototype vectors. Highest logit wins (keep probs if desired).
 */

type FeatureGetter = (p: PlayerInput) => number;

const feat = {
  // Ratings (scale them to 0..1 if you like; here assume 1..20 or 1..100 → normalize yourself upstream)
  shootingAcc: (p: PlayerInput) => safe(p.ratings.shootingAccuracy),
  shooting: (p: PlayerInput) => safe(p.ratings.shooting),
  passing: (p: PlayerInput) => safe(p.ratings.passing),
  gettingOpen: (p: PlayerInput) => safe(p.ratings.gettingOpen),
  puckHandling: (p: PlayerInput) => safe(p.ratings.puckHandling),
  offensiveRead: (p: PlayerInput) => safe(p.ratings.offensiveRead),
  defensiveRead: (p: PlayerInput) => safe(p.ratings.defensiveRead),
  speed: (p: PlayerInput) => safe(p.ratings.speed) || safe(p.ratings.skating),
  strength: (p: PlayerInput) => safe(p.ratings.strength),
  physicality: (p: PlayerInput) => safe(p.ratings.physicality),
  stickcheck: (p: PlayerInput) => safe(p.ratings.stickchecking),
  positioning: (p: PlayerInput) => safe(p.ratings.positioning),
  shotBlock: (p: PlayerInput) => safe(p.ratings.shotBlocking),
  checking: (p: PlayerInput) => safe(p.ratings.checking),
  faceoffs: (p: PlayerInput) => safe(p.ratings.faceoffs),

  // Deployment shares
  toi: (p: PlayerInput) => safe(p.season.timeOnIce),
  ppToi: (p: PlayerInput) => safe(p.season.powerPlayTimeOnIce),
  pkToi: (p: PlayerInput) => safe(p.season.shortHandedTimeOnIce),
  ppShare: (p: PlayerInput) => {
    const toi = feat.toi(p); if (!toi) return 0;
    return safe(p.season.powerPlayTimeOnIce) / toi;
  },
  pkShare: (p: PlayerInput) => {
    const toi = feat.toi(p); if (!toi) return 0;
    return safe(p.season.shortHandedTimeOnIce) / toi;
  },
  ozStart: (p: PlayerInput) => safe(p.season.ozStartPct, 0.5),
};

type Proto = Record<string, number>;

const ROLE_PROTOS: Record<Role, { skill: Proto; usage: Proto; allowedPositions: Position[] }> = {
  scorer: {
    allowedPositions: ['F'],
    skill: { shootingAcc: 1.0, shooting: 0.6, gettingOpen: 0.5, offensiveRead: 0.4, passing: 0.2 },
    usage: { ppShare: 0.8, ozStart: 0.3 }
  },
  playmaker: {
    allowedPositions: ['F'],
    skill: { passing: 1.0, gettingOpen: 0.6, offensiveRead: 0.5, puckHandling: 0.4, shootingAcc: 0.2 },
    usage: { ppShare: 0.7, ozStart: 0.2 }
  },
  twoWayF: {
    allowedPositions: ['F'],
    skill: { defensiveRead: 0.7, positioning: 0.5, stickcheck: 0.4, faceoffs: 0.3, offensiveRead: 0.2 },
    usage: { pkShare: 0.6 }
  },
  defensiveC: {
    allowedPositions: ['F'],
    skill: { defensiveRead: 0.8, positioning: 0.6, faceoffs: 0.8, stickcheck: 0.4, strength: 0.3 },
    usage: { pkShare: 0.7 }
  },
  grinder: {
    allowedPositions: ['F'],
    skill: { physicality: 0.8, checking: 0.6, strength: 0.4, stickcheck: 0.3, shotBlock: 0.3 },
    usage: { pkShare: 0.5 }
  },
  offensiveD: {
    allowedPositions: ['D'],
    skill: { passing: 0.8, offensiveRead: 0.6, puckHandling: 0.5, shootingAcc: 0.3 },
    usage: { ppShare: 0.7, ozStart: 0.2 }
  },
  shutdownD: {
    allowedPositions: ['D'],
    skill: { defensiveRead: 0.9, positioning: 0.7, stickcheck: 0.5, shotBlock: 0.6, strength: 0.3 },
    usage: { pkShare: 0.7 }
  },
  goalie: {
    allowedPositions: ['G'],
    skill: {
      reflexes: 0.6, gPositioning: 0.6, recovery: 0.4, glove: 0.3, blocker: 0.3, goalieTechnique: 0.3
    },
    usage: {} // goalie usage is workload, not PP/PK shares
  }
};

const getFeature = (name: string): FeatureGetter =>
  (feat as Record<string, FeatureGetter>)[name] || ((_p) => 0);

const dot = (proto: Proto, p: PlayerInput) =>
  Object.entries(proto).reduce((acc, [k, w]) => acc + w * getFeature(k)(p), 0);

export const classifyRole = (p: PlayerInput): { role: Role; logits: Record<Role, number> } => {
  const logits: Record<Role, number> = {} as any;
  (Object.keys(ROLE_PROTOS) as Role[]).forEach(r => {
    const rp = ROLE_PROTOS[r];
    logits[r] = (rp.allowedPositions.includes(p.bio.position))
      ? dot(rp.skill, p) + dot(rp.usage, p)
      : -1e9; // disallow role for other positions
  });
  // argmax:
  let best: Role = 'scorer', bestVal = -Infinity;
  (Object.keys(logits) as Role[]).forEach(r => {
    if (logits[r] > bestVal) { best = r; bestVal = logits[r]; }
  });
  return { role: best, logits };
};

/* ==============================
   Impact ingredients (O/D/T/C)
   ============================== */

interface ZInputs {
  // offense
  goals60: number;
  primA60: number;
  xGF60: number;
  shotsF60: number;
  shootAcc: number;

  // defense
  xGA60: number;         // negative contributor
  cfRel: number;
  takeaways60: number;
  blocks60: number;
  pkGA60: number;        // negative contributor

  // transition/discipline
  giveaways60: number;   // negative contributor
  penalties60: number;   // negative contributor
  faceoffPct: number;
  pdo: number;

  // context (optional but supported)
  dzStarts: number; // 0..1
  qoc: number;
  qot: number;

  // goalie
  svPct: number;
  hdSvPct: number;
  gsaX: number;
}

const toPer60 = (count: number, toiMin: number) => (toiMin > 0 ? (60 * count) / toiMin : 0);

const buildZInputs = (p: PlayerInput): ZInputs => {
  const s = p.season;
  const toi = safe(s.timeOnIce);
  const gp = safe(p.season.gamesPlayed);

  const goals = safe(s.goals);
  const assists = safe(s.assists);
  const primA = Math.max(0, assists - Math.floor(assists * 0.4)); // rough proxy; replace with true primary A if you have it
  const shotsF60 = s.shotsFor60 ?? toPer60(s.shotsOnGoal ?? 0, toi);
  const takeaways60 = toPer60(s.takeaways ?? 0, toi);
  const blocks60 = toPer60(s.shotBlocks ?? 0, toi);
  const giveaways60 = toPer60(s.giveaways ?? 0, toi);

  // PP points/60 (rough): use PP goals+assists if you have them
  const ppMin = safe(s.powerPlayTimeOnIce);
  const ppPoints = safe(s.powerPlayGoals) + safe(s.powerPlayAssists);
  const ppP60 = ppMin > 0 ? (60 * ppPoints) / ppMin : 0;

  const faceoffPct = (safe(s.faceoffWins) / Math.max(1, safe(s.faceoffs))) * 100;

  return {
    goals60: toPer60(goals, toi),
    primA60: toPer60(primA, toi),
    xGF60: safe(s.xGF60),
    shotsF60,
    shootAcc: safe(p.ratings.shootingAccuracy),

    xGA60: safe(s.xGA60) || safe(s.goalsAgainst60), // prefer xGA/60 if available
    cfRel: safe(s.corsiForPercentageRelative),
    takeaways60,
    blocks60,
    pkGA60: 0, // if you can compute GA/60 while on PK, feed here

    giveaways60,
    penalties60: toPer60(s.penaltyMinutes ?? 0, toi),
    faceoffPct,
    pdo: safe(s.pdo, 100),

    dzStarts: clamp(s.ozStartPct === undefined ? 0.5 : 1 - safe(s.ozStartPct), 0, 1),
    qoc: safe(s.qocTier),
    qot: safe(s.qotTier),

    svPct: safe(s.savePct),
    hdSvPct: safe(s.hdSavePct),
    gsaX: 0 // if you have GSAx (goals saved above expected), put it here
  };
};

/* ==============================
   Role weight templates
   ============================== */

type Bundle = 'O' | 'D' | 'T' | 'C';

const ROLE_BUNDLE_WEIGHTS: Record<Role, Record<Bundle, number>> = {
  scorer: { O: 0.65, D: 0.10, T: 0.15, C: 0.10 },
  playmaker: { O: 0.55, D: 0.15, T: 0.20, C: 0.10 },
  twoWayF: { O: 0.35, D: 0.40, T: 0.15, C: 0.10 },
  defensiveC: { O: 0.15, D: 0.55, T: 0.20, C: 0.10 },
  grinder: { O: 0.35, D: 0.35, T: 0.15, C: 0.15 },
  offensiveD: { O: 0.45, D: 0.30, T: 0.15, C: 0.10 },
  shutdownD: { O: 0.15, D: 0.55, T: 0.20, C: 0.10 },
  goalie: { O: 0.00, D: 1.00, T: 0.00, C: 0.00 } // goalies use D as shot-stopping
};

interface IngredientZ {
  O: number; D: number; T: number; C: number;
  drivers: Array<{ name: string; z: number }>;
}

const pickTopDrivers = (arr: Array<{ name: string; z: number }>, k = 3) =>
  arr.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, k);

/**
 * Build O/D/T/C bundle z-scores using role-specific metric z-scores.
 * We z-score each metric vs league role benchmarks, then aggregate with simple weights.
 */
const buildIngredientZ = (
  role: Role,
  zi: ZInputs,
  league: LeagueContext
): IngredientZ => {
  const M = league.metricsByRole[role] ?? {};

  // z-score helpers (negative metrics invert)
  const zpos = (key: MetricKey, val: number) => z(val, M[key]);
  const zneg = (key: MetricKey, val: number) => -z(val, M[key]); // invert so "higher bad" becomes negative

  const drivers: Array<{ name: string; z: number }> = [];

  const O =
    0.50 * zpos('goals60', zi.goals60) +
    0.20 * zpos('primA60', zi.primA60) +
    0.15 * zpos('xGF60', zi.xGF60) +
    0.10 * zpos('shotsF60', zi.shotsF60) +
    0.05 * zpos('shootAcc', zi.shootAcc) +
    0.10 * zpos('ppP60', zi.ppP60 ?? 0);

  drivers.push(
    { name: 'goals/60', z: zpos('goals60', zi.goals60) },
    { name: 'xGF/60', z: zpos('xGF60', zi.xGF60) },
    { name: 'PP P/60', z: zpos('ppP60', zi.ppP60 ?? 0) }
  );

  const D =
    0.45 * zneg('xGA60', zi.xGA60) +
    0.20 * zpos('cfRel', zi.cfRel) +
    0.15 * zpos('takeaways60', zi.takeaways60) +
    0.10 * zpos('blocks60', zi.blocks60) +
    0.10 * zneg('pkGA60', zi.pkGA60);

  drivers.push(
    { name: 'xGA/60 (neg)', z: zneg('xGA60', zi.xGA60) },
    { name: 'takeaways/60', z: zpos('takeaways60', zi.takeaways60) },
    { name: 'blocks/60', z: zpos('blocks60', zi.blocks60) }
  );

  const T =
    0.40 * zneg('giveaways60', zi.giveaways60) +
    0.20 * zpos('faceoffPct', zi.faceoffPct) +
    0.20 * zpos('cfRel', zi.cfRel) +
    0.20 * zpos('shotsF60', zi.shotsF60);

  drivers.push(
    { name: 'giveaways/60 (neg)', z: zneg('giveaways60', zi.giveaways60) },
    { name: 'CF% Rel', z: zpos('cfRel', zi.cfRel) }
  );

  const C =
    0.60 * zneg('penalties60', zi.penalties60) +
    0.20 * zpos('qoc', zi.qoc) +      // context: harder comp → small credit
    0.10 * zneg('dzStarts', zi.dzStarts) + // more DZ starts → small credit (invert neg)
    0.10 * (-Math.abs(zpos('pdo', zi.pdo))); // penalize extreme PDO luck

  drivers.push(
    { name: 'penalties/60 (neg)', z: zneg('penalties60', zi.penalties60) },
    { name: 'PDO luck (neg)', z: -Math.abs(zpos('pdo', zi.pdo)) }
  );

  // Goalie override: treat D as shot-stopping mix
  if (role === 'goalie') {
    const Dz =
      0.65 * zpos('svPct', zi.svPct) +
      0.20 * zpos('hdSvPct', zi.hdSvPct) +
      0.15 * zpos('gsaX', zi.gsaX);
    drivers.push(
      { name: 'SV%', z: zpos('svPct', zi.svPct) },
      { name: 'HD SV%', z: zpos('hdSvPct', zi.hdSvPct) }
    );
    return { O: 0, D: Dz, T: 0, C, drivers: pickTopDrivers(drivers) };
  }

  return { O, D, T, C, drivers: pickTopDrivers(drivers) };
};

/* ==============================
   Context adjustments
   ============================== */

const applyContextAdjustments = (role: Role, ing: IngredientZ, zi: ZInputs): IngredientZ => {
  // Gentle, capped nudges for fairness:
  const d = { ...ing };
  // Tougher QoC: + up to 0.15 to D
  d.D += clamp(0.03 * (zi.qoc - 1), -0.15, 0.15);
  // Poor QoT: + up to 0.10 to O (harder to produce with weak linemates)
  d.O += clamp(0.02 * (1 - zi.qot), -0.10, 0.10);
  // Heavy DZ: + up to 0.10 to D
  d.D += clamp(0.20 * (zi.dzStarts - 0.5), -0.10, 0.10);
  return d;
};

/* ==============================
   Impact score / Replacement
   ============================== */

export interface ImpactOutput {
  role: Role;
  bundles: IngredientZ;
  impactScore: number;          // final
  impactZWithinRole: number;    // z vs role impact mean/sd
  replacementZDelta: number;    // (impact - repl) / sd_role
  drivers: Array<{ name: string; z: number }>;
}

const roleWeightedImpact = (role: Role, ing: IngredientZ) => {
  const w = ROLE_BUNDLE_WEIGHTS[role];
  return w.O * ing.O + w.D * ing.D + w.T * ing.T + w.C * ing.C;
};

const replacementThreshold = (ms: MeanSd) =>
  ms.mean - 0.67448975 * ms.sd; // ~25th percentile for Normal

/* ==============================
   Misuse score (fit vs deployment)
   ============================== */

const SKILL_VEC = (p: PlayerInput) => [
  safe(p.ratings.shootingAccuracy),
  safe(p.ratings.passing),
  safe(p.ratings.gettingOpen),
  safe(p.ratings.puckHandling),
  safe(p.ratings.offensiveRead),
  safe(p.ratings.defensiveRead),
  safe(p.ratings.positioning),
  safe(p.ratings.stickchecking),
  safe(p.ratings.shotBlocking),
  safe(p.ratings.physicality),
  safe(p.ratings.strength),
  safe(p.ratings.faceoffs)
];

const DEPLOY_VEC = (p: PlayerInput) => [
  // usage emphasis: PP vs PK vs DZ/OZ
  (() => { const toi = safe(p.season.timeOnIce); return toi ? safe(p.season.powerPlayTimeOnIce) / toi : 0; })(),
  (() => { const toi = safe(p.season.timeOnIce); return toi ? safe(p.season.shortHandedTimeOnIce) / toi : 0; })(),
  safe(p.season.ozStartPct, 0.5),
  safe(p.season.qocTier, 1),
  safe(p.season.qotTier, 1)
];

export interface MisuseOutput {
  misuseScore: number; // 0..~2 (cosine distance). Treat >0.4 severe, 0.25..0.4 moderate, <0.25 minor
  severity: 'minor' | 'moderate' | 'severe';
  notes: string[];
}

/* ==============================
   Confidence & volatility
   ============================== */

export interface ConfidenceOutput {
  confidence: number;   // 0..1
  volatility: number;   // 0..1 (higher = less certain)
}

/* ==============================
   Final evaluation
   ============================== */

export interface Evaluation {
  bio: PlayerBio;
  role: Role;
  logits: Record<Role, number>;
  impact: ImpactOutput;
  misuse: MisuseOutput;
  confidence: ConfidenceOutput;
  recommendation: 'replace' | 'reassign' | 'monitor';
  reasons: string[]; // top drivers / rationale
}

export const evaluatePlayer = (player: PlayerInput, league: LeagueContext): Evaluation => {
  // 1) classify role
  const { role, logits } = classifyRole(player);

  // 2) build normalized z-inputs (+ shrink noisy rates lightly toward neutral)
  const ziRaw = buildZInputs(player);
  const toi = safe(player.season.timeOnIce);
  const priorWeight = 120; // minutes of prior; tune by role
  const shrunk = {
    ...ziRaw,
    goals60: shrink(ziRaw.goals60, toi, league.metricsByRole[role]?.goals60?.mean ?? 0, priorWeight),
    primA60: shrink(ziRaw.primA60, toi, league.metricsByRole[role]?.primA60?.mean ?? 0, priorWeight),
    xGF60: shrink(ziRaw.xGF60, toi, league.metricsByRole[role]?.xGF60?.mean ?? 0, priorWeight),
    xGA60: shrink(ziRaw.xGA60, toi, league.metricsByRole[role]?.xGA60?.mean ?? 2.2, priorWeight), // default ~2.2 GA/60
    shotsF60: shrink(ziRaw.shotsF60, toi, league.metricsByRole[role]?.shotsF60?.mean ?? 28, priorWeight),
    takeaways60: shrink(ziRaw.takeaways60, toi, league.metricsByRole[role]?.takeaways60?.mean ?? 1.0, priorWeight),
    blocks60: shrink(ziRaw.blocks60, toi, league.metricsByRole[role]?.blocks60?.mean ?? 1.2, priorWeight),
    giveaways60: shrink(ziRaw.giveaways60, toi, league.metricsByRole[role]?.giveaways60?.mean ?? 1.2, priorWeight),
    penalties60: shrink(ziRaw.penalties60, toi, league.metricsByRole[role]?.penalties60?.mean ?? 0.6, priorWeight),
    faceoffPct: shrink(ziRaw.faceoffPct, safe(player.season.faceoffs), league.metricsByRole[role]?.faceoffPct?.mean ?? 49.8, 200),
    pdo: shrink(ziRaw.pdo, safe(player.season.gamesPlayed), league.pdoRef?.mean ?? 100, 10),
    svPct: shrink(ziRaw.svPct, toi, league.metricsByRole[role]?.svPct?.mean ?? 0.905, priorWeight),
    hdSvPct: shrink(ziRaw.hdSvPct, toi, league.metricsByRole[role]?.hdSvPct?.mean ?? 0.80, priorWeight),
  };

  // 3) ingredients O/D/T/C
  const baseIng = buildIngredientZ(role, shrunk, league);
  const adjIng = applyContextAdjustments(role, baseIng, shrunk);

  // 4) final impact + z vs role + replacement delta
  const impactScore = roleWeightedImpact(role, adjIng);
  const roleMs = league.impactMeanSdByRole[role];
  const impactZWithinRole = z(impactScore, roleMs);
  const repl = replacementThreshold(roleMs);
  const replacementZDelta = roleMs.sd > 1e-8 ? (impactScore - repl) / roleMs.sd : 0;

  const impact: ImpactOutput = {
    role,
    bundles: adjIng,
    impactScore,
    impactZWithinRole,
    replacementZDelta,
    drivers: adjIng.drivers
  };

  // 5) misuse
  const misuseRaw = cosineDistance(SKILL_VEC(player), DEPLOY_VEC(player));
  const severity: MisuseOutput['severity'] =
    misuseRaw >= 0.4 ? 'severe' : misuseRaw >= 0.25 ? 'moderate' : 'minor';

  const misuseNotes: string[] = [];
  // simple rule hints (no switch):
  const hintRules: Array<[boolean, string]> = [
    [player.bio.position === 'F' && misuseRaw >= 0.25 && feat.ppShare(player) < 0.1 && feat.shootingAcc(player) > 0, 'Give PP2 time to a shooter/playmaker.'],
    [player.bio.position === 'D' && misuseRaw >= 0.25 && feat.ppShare(player) < 0.05 && (safe(player.ratings.passing) + safe(player.ratings.offensiveRead)) > 0, 'Try PP QB reps for puck-mover.'],
    [player.bio.position !== 'G' && feat.pkShare(player) > 0.3 && safe(player.ratings.defensiveRead) < safe(player.ratings.offensiveRead), 'Reduce PK load for offense-first player.']
  ];
  hintRules.forEach(([cond, note]) => { if (cond) misuseNotes.push(note); });

  const misuse: MisuseOutput = { misuseScore: misuseRaw, severity, notes: misuseNotes };

  // 6) confidence & volatility
  const minTOI = league.minTOIForConfidence ?? 300;
  const baseConf = clamp(Math.sqrt(toi / Math.max(1, minTOI)), 0, 1);
  const pdoZ = z(shrunk.pdo, league.pdoRef ?? { mean: 100, sd: 2 });
  const luckPenalty = clamp(Math.abs(pdoZ) * 0.1, 0, 0.3);
  const confidence = clamp(baseConf * (1 - luckPenalty), 0, 1);
  const volatility = 1 - confidence;

  const conf: ConfidenceOutput = { confidence, volatility };

  // 7) recommendation logic
  const weakImpact = replacementZDelta < -0.4 && confidence >= 0.6;
  const nearReplacement = Math.abs(replacementZDelta) <= 0.25;

  const recommend: Evaluation['recommendation'] =
    player.bio.position === 'G'
      ? (weakImpact ? 'replace' : (misuse.severity === 'severe' ? 'reassign' : 'monitor'))
      : (misuse.severity === 'severe' && nearReplacement ? 'reassign' : (weakImpact ? 'replace' : 'monitor'));

  // 8) reasons (top drivers + short rationale)
  const reasons: string[] = [];
  impact.drivers.forEach(d => reasons.push(`${d.name}: z=${d.z.toFixed(2)}`));
  if (weakImpact) reasons.push('Below replacement-level impact for role.');
  if (misuse.severity !== 'minor') reasons.push(`Misuse severity: ${misuse.severity}.`);
  if (confidence < 0.5) reasons.push('Low confidence (limited TOI and/or luck factor).');

  return {
    bio: player.bio,
    role,
    logits,
    impact,
    misuse,
    confidence: conf,
    recommendation: recommend,
    reasons
  };
};

/* ==============================
   Batch helper
   ============================== */

export const evaluateRoster = (players: PlayerInput[], league: LeagueContext) =>
  players.map(p => evaluatePlayer(p, league));

/* ==============================
   Notes for integration
   ============================== */
/**
 * - LeagueContext: compute means/sd per role for the MetricKeys you use.
 *   Example: within all players labeled 'scorer', gather goals60 values → mean/sd → set metricsByRole['scorer'].goals60.
 *
 * - Replacement: we approximate 25th percentile using Normal assumption. Replace with empirical percentile when you have enough samples.
 *
 * - Shrinkage: adjust `priorWeight` by role; higher for noisy metrics, lower for stable.
 *
 * - PDO/Luck: if you track on-ice PDO for each player’s EV minutes, pass it in; otherwise omit or set pdoRef to {mean:100,sd:2}.
 *
 * - Misuse: add more hints based on your lineup logic (e.g., partner archetypes, line balancing).
 *
 * - Top Drivers: currently picks absolute z’s from ingredients; swap with SHAP-like attributions later if desired.
 */
