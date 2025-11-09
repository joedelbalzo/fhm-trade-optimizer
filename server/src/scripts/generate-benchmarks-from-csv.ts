// Generate Cup winner benchmarks from MoneyPuck skaters.csv
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Team abbreviation mappings (MoneyPuck format to NHL standard)
const TEAM_MAPPINGS: { [key: string]: string } = {
  'FLA': 'FLA', 'T.B': 'TBL', 'TOR': 'TOR', 'BOS': 'BOS', 'MTL': 'MTL',
  'OTT': 'OTT', 'BUF': 'BUF', 'DET': 'DET', 'CAR': 'CAR', 'NYI': 'NYI',
  'NYR': 'NYR', 'PHI': 'PHI', 'PIT': 'PIT', 'WSH': 'WAS', 'CBJ': 'CBJ',
  'N.J': 'NJD', 'VGK': 'VGK', 'VAN': 'VAN', 'SEA': 'SEA', 'CGY': 'CGY',
  'EDM': 'EDM', 'COL': 'COL', 'MIN': 'MIN', 'WPG': 'WPG', 'STL': 'STL',
  'NSH': 'NSH', 'DAL': 'DAL', 'CHI': 'CHI', 'ARI': 'ARI', 'L.A': 'LAK',
  'ANA': 'ANA', 'S.J': 'SJS',
};

// Cup winners by season
const CUP_WINNERS: { [season: number]: string } = {
  2024: 'FLA',
  2023: 'VGK',
  2022: 'COL',
  2021: 'TBL',
  2020: 'TBL',
};

interface PlayerStats {
  playerId: string;
  name: string;
  team: string;
  position: string;
  gamesPlayed: number;
  icetime: number; // total seconds
  goals: number;
  primaryAssists: number;
  secondaryAssists: number;
  points: number;
  corsiPercentage: number;
  fenwickPercentage: number;
  shotsOnGoal: number;
  plusMinus?: number;
}

interface RoleStats {
  ppg: number[];
  toi: number[];
  corsiForPct: number[];
  fenwickForPct: number[];
}

interface Benchmarks {
  [role: string]: {
    avgPPG: number;
    stdDevPPG: number;
    medianPPG: number;
    p25PPG: number;
    p75PPG: number;
    minPPG: number;
    maxPPG: number;
    avgTOI: number;
    avgCorsiForPct: number;
    avgFenwickForPct: number;
    sampleSize: number;
  };
}

// Classify player role based on production and TOI
function classifyRole(position: string, ppg: number, toiPerGame: number): string {
  if (position === 'G') {
    return toiPerGame > 40 ? 'Starting' : 'Backup';
  }

  if (position === 'C') {
    if (ppg >= 0.6 && toiPerGame >= 18) return '1C';
    if (ppg >= 0.45 && toiPerGame >= 16) return '2C';
    if (ppg >= 0.35 && toiPerGame >= 14) return '3C';
    return '4C';
  }

  if (['L', 'R', 'LW', 'RW'].includes(position)) {
    if (ppg >= 0.6 && toiPerGame >= 16) return 'Top-6 Wing';
    if (ppg >= 0.35 && toiPerGame >= 12) return 'Middle-6 Wing';
    return 'Bottom-6 Wing';
  }

  if (position === 'D') {
    if (ppg >= 0.5 && toiPerGame >= 22) return '1D';
    if (ppg >= 0.4 && toiPerGame >= 20) return '2D';
    if (ppg >= 0.3 && toiPerGame >= 18) return '3D';
    if (ppg >= 0.25 && toiPerGame >= 16) return '4D';
    if (ppg >= 0.2 && toiPerGame >= 14) return '5D';
    return '6D';
  }

  return 'Unknown';
}

// Statistical functions
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

async function generateBenchmarks() {
  console.log('Reading MoneyPuck skaters.csv...\n');

  const csvPath = path.resolve(__dirname, '../../../skaters.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`skaters.csv not found at ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });

  console.log(`Loaded ${records.length} player records\n`);

  // Determine season from first record
  const season = parseInt(records[0].season);
  console.log(`Season detected: ${season}`);

  const cupWinner = CUP_WINNERS[season];
  if (!cupWinner) {
    throw new Error(`No Cup winner data for season ${season}`);
  }

  console.log(`Cup Winner: ${cupWinner}\n`);

  // Find team abbreviation in MoneyPuck format
  const moneyPuckTeam = Object.entries(TEAM_MAPPINGS).find(
    ([mp, std]) => std === cupWinner
  )?.[0];

  if (!moneyPuckTeam) {
    throw new Error(`Could not find MoneyPuck team mapping for ${cupWinner}`);
  }

  console.log(`Looking for team: ${moneyPuckTeam}\n`);

  // Filter players from Cup-winning team
  const teamPlayers = records.filter((r: any) =>
    r.team === moneyPuckTeam &&
    r.situation === 'all' && // All situations combined
    parseInt(r.games_played) >= 10 // Minimum 10 games
  );

  console.log(`Found ${teamPlayers.length} players with 10+ games\n`);

  // Group by role
  const roleStats: { [role: string]: RoleStats } = {};
  const initRoleStats = (): RoleStats => ({
    ppg: [],
    toi: [],
    corsiForPct: [],
    fenwickForPct: [],
  });

  for (const player of teamPlayers) {
    const gamesPlayed = parseInt(player.games_played);
    const goals = parseInt(player.I_F_goals || 0);
    const assists = parseInt(player.I_F_primaryAssists || 0) + parseInt(player.I_F_secondaryAssists || 0);
    const points = goals + assists;
    const ppg = points / gamesPlayed;

    // Convert icetime (in seconds) to TOI per game (minutes)
    const totalSeconds = parseFloat(player.icetime);
    const toiPerGame = (totalSeconds / 60) / gamesPlayed;

    const position = player.position;
    const role = classifyRole(position, ppg, toiPerGame);

    if (role === 'Unknown' || position === 'G') continue; // Skip goalies and unknown for now

    if (!roleStats[role]) {
      roleStats[role] = initRoleStats();
    }

    roleStats[role].ppg.push(ppg);
    roleStats[role].toi.push(toiPerGame);

    const corsi = parseFloat(player.onIce_corsiPercentage);
    const fenwick = parseFloat(player.onIce_fenwickPercentage);

    if (!isNaN(corsi)) roleStats[role].corsiForPct.push(corsi);
    if (!isNaN(fenwick)) roleStats[role].fenwickForPct.push(fenwick);

    console.log(`  ${player.name.padEnd(25)} ${role.padEnd(15)} ${ppg.toFixed(3)} PPG, ${toiPerGame.toFixed(1)} TOI`);
  }

  // Calculate benchmarks
  console.log('\n' + '='.repeat(80));
  console.log('CALCULATING BENCHMARKS');
  console.log('='.repeat(80) + '\n');

  const benchmarks: Benchmarks = {};
  const roleOrder = ['1C', '2C', '3C', '4C', 'Top-6 Wing', 'Middle-6 Wing', 'Bottom-6 Wing', '1D', '2D', '3D', '4D', '5D', '6D'];

  for (const [role, stats] of Object.entries(roleStats)) {
    if (stats.ppg.length === 0) continue;

    const avgPPG = stats.ppg.reduce((sum, val) => sum + val, 0) / stats.ppg.length;
    const stdDevPPG = calculateStdDev(stats.ppg);
    const medianPPG = calculateMedian(stats.ppg);
    const p25PPG = calculatePercentile(stats.ppg, 25);
    const p75PPG = calculatePercentile(stats.ppg, 75);
    const minPPG = Math.min(...stats.ppg);
    const maxPPG = Math.max(...stats.ppg);
    const avgTOI = stats.toi.reduce((sum, val) => sum + val, 0) / stats.toi.length;

    benchmarks[role] = {
      avgPPG,
      stdDevPPG,
      medianPPG,
      p25PPG,
      p75PPG,
      minPPG,
      maxPPG,
      avgTOI,
      avgCorsiForPct: stats.corsiForPct.length > 0
        ? stats.corsiForPct.reduce((sum, val) => sum + val, 0) / stats.corsiForPct.length
        : 0,
      avgFenwickForPct: stats.fenwickForPct.length > 0
        ? stats.fenwickForPct.reduce((sum, val) => sum + val, 0) / stats.fenwickForPct.length
        : 0,
      sampleSize: stats.ppg.length,
    };
  }

  // Print benchmarks
  for (const role of roleOrder) {
    if (!benchmarks[role]) continue;
    const b = benchmarks[role];

    console.log(`\n${role.toUpperCase()}`);
    console.log(`${'─'.repeat(40)}`);
    console.log(`  Sample Size: ${b.sampleSize} players`);
    console.log(`  PPG: ${b.avgPPG.toFixed(3)} ± ${b.stdDevPPG.toFixed(3)}`);
    console.log(`       Median: ${b.medianPPG.toFixed(3)}, Range: [${b.minPPG.toFixed(3)} - ${b.maxPPG.toFixed(3)}]`);
    console.log(`       P25: ${b.p25PPG.toFixed(3)}, P75: ${b.p75PPG.toFixed(3)}`);
    console.log(`  Avg TOI: ${b.avgTOI.toFixed(1)} min/game`);
    if (b.avgCorsiForPct > 0) {
      console.log(`  Corsi For %: ${b.avgCorsiForPct.toFixed(1)}%`);
    }
    if (b.avgFenwickForPct > 0) {
      console.log(`  Fenwick For %: ${b.avgFenwickForPct.toFixed(1)}%`);
    }
  }

  // Save to JSON
  const outputPath = path.resolve(__dirname, '../../../cup-winner-benchmarks.json');
  fs.writeFileSync(outputPath, JSON.stringify(benchmarks, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log(`BENCHMARKS SAVED TO: ${outputPath}`);
  console.log('='.repeat(80));

  console.log('\nNOTE: These benchmarks are based on ONE Cup-winning team only.');
  console.log('For more robust benchmarks, we should fetch data for all Cup winners (2006-2024).');

  return benchmarks;
}

generateBenchmarks()
  .then(() => {
    console.log('\n✓ Benchmark generation complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Error generating benchmarks:', error);
    process.exit(1);
  });
