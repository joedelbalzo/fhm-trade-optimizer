// server/src/utils/cupWinnerBenchmarks.ts
import fs from 'fs';
import path from 'path';

interface RoleBenchmark {
  avgPPG: number;
  stdDevPPG: number;
  medianPPG: number;
  p25PPG: number;
  p75PPG: number;
  minPPG: number;
  maxPPG: number;
  avgAge: number;
  avgCapHit: number;
  avgCorsiForPct: number;
  avgFenwickForPct: number;
  avgGameRatingOff: number;
  avgGameRatingDef: number;
  sampleSize: number;
}

interface Benchmarks {
  [role: string]: RoleBenchmark;
}

let cachedBenchmarks: Benchmarks | null = null;

/**
 * Load Cup winner benchmarks from JSON file
 * Caches the result for performance
 */
export function loadBenchmarks(): Benchmarks | null {
  if (cachedBenchmarks) {
    return cachedBenchmarks;
  }

  try {
    const benchmarkPath = path.resolve('./cup-winner-benchmarks.json');
    if (!fs.existsSync(benchmarkPath)) {
      console.warn('Cup winner benchmarks not found. Run: npm run analyze-cup-winners');
      return null;
    }

    const data = fs.readFileSync(benchmarkPath, 'utf-8');
    cachedBenchmarks = JSON.parse(data);
    return cachedBenchmarks;
  } catch (error) {
    console.error('Error loading cup winner benchmarks:', error);
    return null;
  }
}

/**
 * Compare a player's performance against Cup winner benchmarks
 * Returns z-score (standard deviations from mean) and percentile estimate
 */
export function compareAgainstBenchmark(
  role: string,
  playerPPG: number,
  benchmarks?: Benchmarks | null
): {
  benchmark: RoleBenchmark | null;
  zScore: number;
  percentile: number;
  performance: 'elite' | 'above-average' | 'average' | 'below-average' | 'weak' | 'unknown';
  description: string;
} {
  const bench = benchmarks || loadBenchmarks();

  if (!bench || !bench[role]) {
    return {
      benchmark: null,
      zScore: 0,
      percentile: 50,
      performance: 'unknown',
      description: `No benchmark data available for ${role}`
    };
  }

  const roleBench = bench[role];

  // Calculate z-score (standard deviations from mean)
  const zScore = roleBench.stdDevPPG > 0
    ? (playerPPG - roleBench.avgPPG) / roleBench.stdDevPPG
    : 0;

  // Estimate percentile from z-score (assuming normal distribution)
  const percentile = cumulativeNormalDistribution(zScore) * 100;

  // Classify performance
  let performance: 'elite' | 'above-average' | 'average' | 'below-average' | 'weak' | 'unknown';
  let description: string;

  if (playerPPG >= roleBench.p75PPG) {
    performance = 'elite';
    description = `Elite ${role} - performs in top 25% of Cup winners (${playerPPG.toFixed(3)} vs ${roleBench.p75PPG.toFixed(3)} PPG)`;
  } else if (playerPPG >= roleBench.medianPPG) {
    performance = 'above-average';
    description = `Above-average ${role} - exceeds Cup winner median (${playerPPG.toFixed(3)} vs ${roleBench.medianPPG.toFixed(3)} PPG)`;
  } else if (playerPPG >= roleBench.p25PPG) {
    performance = 'average';
    description = `Average ${role} - meets minimum Cup winner standard (${playerPPG.toFixed(3)} vs ${roleBench.p25PPG.toFixed(3)} PPG threshold)`;
  } else if (playerPPG >= roleBench.p25PPG - roleBench.stdDevPPG) {
    performance = 'below-average';
    description = `Below-average ${role} - falls short of Cup winner standards (${playerPPG.toFixed(3)} vs ${roleBench.p25PPG.toFixed(3)} PPG minimum)`;
  } else {
    performance = 'weak';
    description = `Weak link - significantly underperforms Cup winners at ${role} (${playerPPG.toFixed(3)} vs ${roleBench.avgPPG.toFixed(3)} PPG avg)`;
  }

  return {
    benchmark: roleBench,
    zScore,
    percentile,
    performance,
    description
  };
}

/**
 * Calculate cumulative normal distribution (for percentile from z-score)
 */
function cumulativeNormalDistribution(z: number): number {
  // Using error function approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  return z > 0 ? 1 - probability : probability;
}

/**
 * Get the expected PPG range for a role based on Cup winners
 * Returns [minimum acceptable, average, elite threshold]
 */
export function getExpectedPPGRange(role: string, benchmarks?: Benchmarks | null): [number, number, number] | null {
  const bench = benchmarks || loadBenchmarks();

  if (!bench || !bench[role]) {
    return null;
  }

  const roleBench = bench[role];
  return [roleBench.p25PPG, roleBench.avgPPG, roleBench.p75PPG];
}

/**
 * Determine if a player is a weak link based on Cup winner standards
 * Uses 25th percentile (bottom quartile) as threshold
 */
export function isWeakLinkByCupStandards(
  role: string,
  playerPPG: number,
  benchmarks?: Benchmarks | null
): boolean {
  const bench = benchmarks || loadBenchmarks();

  if (!bench || !bench[role]) {
    return false; // Can't determine without data
  }

  // Weak link if below 25th percentile of Cup winners
  return playerPPG < bench[role].p25PPG;
}

/**
 * Calculate performance score relative to Cup winner benchmarks
 * Returns a score where:
 *   > 0: Above Cup winner average
 *   0: At Cup winner average
 *   < 0: Below Cup winner average
 */
export function calculateBenchmarkScore(
  role: string,
  playerPPG: number,
  benchmarks?: Benchmarks | null
): number {
  const bench = benchmarks || loadBenchmarks();

  if (!bench || !bench[role]) {
    return 0;
  }

  const roleBench = bench[role];

  // Normalize by standard deviation for consistent scoring across roles
  return roleBench.stdDevPPG > 0
    ? (playerPPG - roleBench.avgPPG) / roleBench.stdDevPPG
    : 0;
}
