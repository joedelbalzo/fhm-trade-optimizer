// Comprehensive weakness detection using Cup winner benchmarks
import { Player, PlayerSeasonStat } from '../models/index.js';
import { loadBenchmarks } from '../utils/cupWinnerBenchmarks.js';
import { getPositionMetrics } from './hockeyAnalysis.js';

interface WeaknessScore {
  player: Player;
  role: string;
  benchmarkRole: string;
  metrics: {
    ppg: number;
    corsiForPct: number;
    fenwickForPct: number;
    timeOnIce: number;
  };
  benchmarks: {
    avgPPG: number;
    p25PPG: number;
    avgCorsiForPct: number;
    avgFenwickForPct: number;
  };
  zScores: {
    ppgZScore: number;
    corsiZScore: number;
    fenwickZScore: number;
    compositeZScore: number;
  };
  positionWeight: number;
  totalWeaknessScore: number; // Lower = worse (more of a weak link)
  severityRating: 'Critical' | 'High' | 'Moderate' | 'Minor' | 'None';
  explanation: string;
}

// Map role to positional importance weight
function getPositionWeight(benchmarkRole: string): number {
  // Elite positions have higher weight - weakness here hurts more
  const weights: { [key: string]: number } = {
    '1C': 5.0,
    '1D': 5.0,
    'Top-6 Wing': 4.5,
    '2C': 4.0,
    '2D': 4.0,
    'Middle-6 Wing': 3.0,
    '3C': 2.5,
    '3D': 2.5,
    '4C': 1.5,
    '4D': 2.0,
    'Bottom-6 Wing': 1.5,
    '5D': 1.5,
    '6D': 1.0,
  };
  return weights[benchmarkRole] || 1.0;
}

// Map current role to benchmark role
export function mapRoleToBenchmark(position: string, timeOnIce: number, ppg: number, salary: number): string {
  // Defensemen
  if (position === 'D' || position === 'LD' || position === 'RD') {
    // Salary-based first for expensive players
    if (salary > 7.0) return '1D';
    if (salary > 5.0) return '2D';
    if (salary > 3.0) return '3D';

    // Performance + TOI based
    if (ppg >= 0.5 && timeOnIce >= 22) return '1D';
    if (ppg >= 0.4 && timeOnIce >= 20) return '2D';
    if (timeOnIce >= 18) return '3D';
    if (timeOnIce >= 16) return '4D';
    if (timeOnIce >= 14) return '5D';
    return '6D';
  }

  // Centers
  if (position === 'C') {
    // Salary-based first
    if (salary > 8.0) return '1C';
    if (salary > 6.0) return '2C';
    if (salary > 4.0) return '3C';

    // Performance + TOI based
    if (ppg >= 0.6 && timeOnIce >= 18) return '1C';
    if (ppg >= 0.45 && timeOnIce >= 16) return '2C';
    if (ppg >= 0.35 && timeOnIce >= 14) return '3C';
    return '4C';
  }

  // Wings (LW/RW)
  if (position === 'LW' || position === 'RW') {
    // Salary-based first
    if (salary > 7.0) return 'Top-6 Wing';
    if (salary > 4.0) return 'Middle-6 Wing';

    // Performance + TOI based
    if (ppg >= 0.6 && timeOnIce >= 16) return 'Top-6 Wing';
    if (ppg >= 0.35 && timeOnIce >= 12) return 'Middle-6 Wing';
    return 'Bottom-6 Wing';
  }

  return 'Unknown';
}

// Classify severity based on composite z-score (statistically meaningful thresholds)
function classifySeverity(compositeZScore: number): 'Critical' | 'High' | 'Moderate' | 'Minor' | 'None' {
  // Statistical thresholds based on standard deviations from Cup winner benchmarks
  // Critical: More than 2 standard deviations below Cup winners
  // High: 1-2 standard deviations below
  // Moderate: 0.5-1 standard deviation below
  // Minor: Slightly below (0-0.5 std dev)
  // None: Meets or exceeds Cup winner standards

  if (compositeZScore < -2.0) return 'Critical';
  if (compositeZScore < -1.0) return 'High';
  if (compositeZScore < -0.5) return 'Moderate';
  if (compositeZScore < 0) return 'Minor';
  return 'None';
}

/**
 * Comprehensive weakness detection for entire roster
 * Returns players sorted by weakness severity (worst first)
 */
export async function detectComprehensiveWeaknesses(
  teamId: number,
  minGamesPlayed: number = 10
): Promise<WeaknessScore[]> {
  const benchmarks = loadBenchmarks();

  if (!benchmarks) {
    throw new Error('Cup winner benchmarks not loaded. Run: npm run generate-comprehensive-benchmarks');
  }

  // Get all players on roster
  const players = await Player.findAll({
    where: { teamId },
    include: [{
      model: PlayerSeasonStat,
      as: 'seasonStats',
      required: true,
    }]
  });

  const weaknessScores: WeaknessScore[] = [];

  for (const player of players) {
    // Skip goalies for now
    if (player.position === 'G') continue;

    const metrics = await getPositionMetrics(player);
    if (!metrics || metrics.gamesPlayed < minGamesPlayed) continue;

    const { pointsPerGame, timeOnIce, corsiForPercentage, fenwickForPercentage } = metrics;
    const salary = parseFloat(player.capHit || '0.925');

    // Map to benchmark role
    const benchmarkRole = mapRoleToBenchmark(player.position, timeOnIce, pointsPerGame, salary);
    if (benchmarkRole === 'Unknown' || !benchmarks[benchmarkRole]) continue;

    const benchmark = benchmarks[benchmarkRole];

    // Calculate z-scores (standard deviations from Cup winner mean)
    const ppgZScore = benchmark.stdDevPPG > 0
      ? (pointsPerGame - benchmark.avgPPG) / benchmark.stdDevPPG
      : 0;

    // Corsi and Fenwick: benchmarks are decimals (0.5 = 50%), player metrics are percentages (51.9 = 51.9%)
    // Convert benchmarks to percentage scale for comparison
    const benchmarkCorsiPct = benchmark.avgCorsiForPct * 100; // 0.5 -> 50
    const benchmarkCorsiStdDev = benchmark.stdDevCorsiForPct * 100; // Also convert std dev
    const benchmarkFenwickPct = benchmark.avgFenwickForPct * 100;
    const benchmarkFenwickStdDev = benchmark.stdDevFenwickForPct * 100;

    // Calculate z-scores using actual standard deviations from Cup winner data
    const corsiZScore = benchmarkCorsiPct > 0 && corsiForPercentage > 0 && benchmarkCorsiStdDev > 0
      ? (corsiForPercentage - benchmarkCorsiPct) / benchmarkCorsiStdDev
      : 0;

    const fenwickZScore = benchmarkFenwickPct > 0 && fenwickForPercentage > 0 && benchmarkFenwickStdDev > 0
      ? (fenwickForPercentage - benchmarkFenwickPct) / benchmarkFenwickStdDev
      : 0;

    // Composite z-score (position-specific weights)
    // NOTE: Removed defensive metrics (takeaway/giveaway ratio) - was producing extreme values
    // TODO: Add back with proper benchmarks from Cup winner data
    let compositeZScore: number;

    if (player.position === 'D' || player.position === 'LD' || player.position === 'RD') {
      // DEFENSEMEN: 30% PPG, 35% Corsi, 35% Fenwick
      // Less emphasis on points, more on play control
      compositeZScore = (ppgZScore * 0.30) + (corsiZScore * 0.35) + (fenwickZScore * 0.35);
    } else {
      // FORWARDS: 40% PPG, 35% Corsi, 25% Fenwick
      compositeZScore = (ppgZScore * 0.40) + (corsiZScore * 0.35) + (fenwickZScore * 0.25);
    }

    // Apply positional weight (for ranking priority, not severity classification)
    const positionWeight = getPositionWeight(benchmarkRole);
    const totalWeaknessScore = compositeZScore * positionWeight;

    // Classify severity based on composite z-score (statistical thresholds)
    const severityRating = classifySeverity(compositeZScore);

    // Generate explanation
    let explanation = '';
    if (severityRating === 'Critical' || severityRating === 'High') {
      const ppgGap = benchmark.avgPPG - pointsPerGame;
      const ppgGapPercent = ((ppgGap / benchmark.avgPPG) * 100).toFixed(0);

      explanation = `${player.firstName} ${player.lastName} (${benchmarkRole}) is significantly underperforming Cup winner standards. `;
      explanation += `PPG: ${pointsPerGame.toFixed(3)} vs ${benchmark.avgPPG.toFixed(3)} avg (${ppgGapPercent}% below, ${ppgZScore.toFixed(2)} std devs). `;

      if (corsiForPercentage > 0) {
        explanation += `Corsi: ${corsiForPercentage.toFixed(1)}% vs ${benchmark.avgCorsiForPct.toFixed(1)}% avg. `;
      }

      explanation += `As a ${benchmarkRole}, this gap represents a major weakness in a critical position.`;
    } else if (severityRating === 'Moderate') {
      explanation = `${player.firstName} ${player.lastName} (${benchmarkRole}) is below Cup winner standards but not critically. ${ppgZScore.toFixed(2)} std devs below average PPG.`;
    } else if (severityRating === 'Minor') {
      explanation = `${player.firstName} ${player.lastName} (${benchmarkRole}) is slightly below Cup winner standards. Minor concern.`;
    } else {
      explanation = `${player.firstName} ${player.lastName} (${benchmarkRole}) meets or exceeds Cup winner standards.`;
    }

    weaknessScores.push({
      player,
      role: `${player.position} - ${timeOnIce.toFixed(1)} TOI`,
      benchmarkRole,
      metrics: {
        ppg: pointsPerGame,
        corsiForPct: corsiForPercentage,
        fenwickForPct: fenwickForPercentage,
        timeOnIce,
      },
      benchmarks: {
        avgPPG: benchmark.avgPPG,
        p25PPG: benchmark.p25PPG,
        avgCorsiForPct: benchmark.avgCorsiForPct,
        avgFenwickForPct: benchmark.avgFenwickForPct,
      },
      zScores: {
        ppgZScore,
        corsiZScore,
        fenwickZScore,
        compositeZScore,
      },
      positionWeight,
      totalWeaknessScore,
      severityRating,
      explanation,
    });
  }

  // Sort by total weakness score (most negative = biggest weakness)
  weaknessScores.sort((a, b) => a.totalWeaknessScore - b.totalWeaknessScore);

  return weaknessScores;
}

/**
 * Get only the actual weak links (Critical + High severity)
 */
export async function getWeakLinks(teamId: number, minGamesPlayed: number = 10): Promise<WeaknessScore[]> {
  const allScores = await detectComprehensiveWeaknesses(teamId, minGamesPlayed);
  return allScores.filter(s => s.severityRating === 'Critical' || s.severityRating === 'High');
}

/**
 * Get summary statistics for the roster
 */
export async function getRosterBenchmarkSummary(teamId: number): Promise<{
  totalPlayers: number;
  criticalWeaknesses: number;
  highWeaknesses: number;
  moderateWeaknesses: number;
  meetsStandards: number;
  averageZScore: number;
  worstPlayer: WeaknessScore | null;
}> {
  const scores = await detectComprehensiveWeaknesses(teamId);

  const critical = scores.filter(s => s.severityRating === 'Critical').length;
  const high = scores.filter(s => s.severityRating === 'High').length;
  const moderate = scores.filter(s => s.severityRating === 'Moderate').length;
  const meets = scores.filter(s => s.severityRating === 'None').length;

  const avgZ = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.zScores.compositeZScore, 0) / scores.length
    : 0;

  return {
    totalPlayers: scores.length,
    criticalWeaknesses: critical,
    highWeaknesses: high,
    moderateWeaknesses: moderate,
    meetsStandards: meets,
    averageZScore: avgZ,
    worstPlayer: scores.length > 0 ? scores[0] : null,
  };
}
