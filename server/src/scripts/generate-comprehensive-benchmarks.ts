// Generate comprehensive Cup winner benchmarks from all seasons (2006-2024)
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOWNLOAD_DIR = path.resolve(__dirname, '../../../stanley-cup-winners');

// Team abbreviation mappings (MoneyPuck format to NHL standard)
const TEAM_MAPPINGS: { [key: string]: string } = {
  'FLA': 'FLA', 'T.B': 'TBL', 'TOR': 'TOR', 'BOS': 'BOS', 'MTL': 'MTL',
  'OTT': 'OTT', 'BUF': 'BUF', 'DET': 'DET', 'CAR': 'CAR', 'NYI': 'NYI',
  'NYR': 'NYR', 'PHI': 'PHI', 'PIT': 'PIT', 'WSH': 'WAS', 'CBJ': 'CBJ',
  'N.J': 'NJD', 'VGK': 'VGK', 'VAN': 'VAN', 'SEA': 'SEA', 'CGY': 'CGY',
  'EDM': 'EDM', 'COL': 'COL', 'MIN': 'MIN', 'WPG': 'WPG', 'STL': 'STL',
  'NSH': 'NSH', 'DAL': 'DAL', 'CHI': 'CHI', 'ARI': 'ARI', 'PHX': 'ARI',
  'L.A': 'LAK', 'ANA': 'ANA', 'S.J': 'SJS',
};

// Cup winners by season (season year = year playoffs ended)
const CUP_WINNERS: { [season: number]: string } = {
  2024: 'FLA',
  2023: 'VGK',
  2022: 'COL',
  2021: 'TBL',
  2020: 'TBL',
  2019: 'STL',
  2018: 'WAS',
  2017: 'PIT',
  2016: 'PIT',
  2015: 'CHI',
  2014: 'LAK',
  2013: 'CHI',
  2012: 'LAK',
  2011: 'BOS',
  2010: 'CHI',
  2009: 'PIT',
  2008: 'DET',
  2007: 'ANA',
  2006: 'CAR',
};

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

// Download a file from URL
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

async function downloadSeasonData() {
  console.log('Downloading MoneyPuck data for all Cup-winning seasons...\n');

  // Create download directory
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }

  // MoneyPuck uses year-1 for season (2023-24 season = 2023)
  const seasonsToDownload = Object.keys(CUP_WINNERS).map(s => parseInt(s) - 1);

  for (const year of seasonsToDownload) {
    const filename = `skaters-${year}.csv`;
    const filePath = path.join(DOWNLOAD_DIR, filename);

    // Skip if already downloaded
    if (fs.existsSync(filePath)) {
      console.log(`  ✓ ${filename} already exists, skipping`);
      continue;
    }

    const url = `https://moneypuck.com/moneypuck/playerData/seasonSummary/${year}/regular/skaters.csv`;
    console.log(`  Downloading ${filename}...`);

    try {
      await downloadFile(url, filePath);
      console.log(`  ✓ ${filename} downloaded`);
    } catch (error) {
      console.error(`  ✗ Failed to download ${filename}:`, error);
    }
  }

  console.log('\n✓ All downloads complete!\n');
}

function processSeasonFile(filePath: string, season: number): { role: string; stats: any }[] {
  const cupWinner = CUP_WINNERS[season];
  if (!cupWinner) {
    return [];
  }

  const moneyPuckTeam = Object.entries(TEAM_MAPPINGS).find(
    ([mp, std]) => std === cupWinner
  )?.[0];

  if (!moneyPuckTeam) {
    console.log(`  ⚠️  Could not find MoneyPuck team mapping for ${cupWinner}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });

  const teamPlayers = records.filter((r: any) =>
    r.team === moneyPuckTeam &&
    r.situation === 'all' &&
    parseInt(r.games_played) >= 10
  );

  const results: { role: string; stats: any }[] = [];

  for (const player of teamPlayers) {
    const gamesPlayed = parseInt(player.games_played);
    const goals = parseInt(player.I_F_goals || 0);
    const assists = parseInt(player.I_F_primaryAssists || 0) + parseInt(player.I_F_secondaryAssists || 0);
    const points = goals + assists;
    const ppg = points / gamesPlayed;

    const totalSeconds = parseFloat(player.icetime);
    const toiPerGame = (totalSeconds / 60) / gamesPlayed;

    const position = player.position;
    const role = classifyRole(position, ppg, toiPerGame);

    if (role === 'Unknown' || position === 'G') continue;

    const corsi = parseFloat(player.onIce_corsiPercentage);
    const fenwick = parseFloat(player.onIce_fenwickPercentage);

    results.push({
      role,
      stats: {
        ppg,
        toiPerGame,
        corsi: isNaN(corsi) ? null : corsi,
        fenwick: isNaN(fenwick) ? null : fenwick,
        name: player.name,
        team: cupWinner,
        season,
      }
    });
  }

  return results;
}

async function generateComprehensiveBenchmarks() {
  // Step 1: Download all season data
  await downloadSeasonData();

  // Step 2: Process all files
  console.log('Processing all Cup-winning team rosters...\n');

  const roleStats: { [role: string]: RoleStats } = {};
  const initRoleStats = (): RoleStats => ({
    ppg: [],
    toi: [],
    corsiForPct: [],
    fenwickForPct: [],
  });

  let totalPlayers = 0;
  let teamsProcessed = 0;

  for (const [seasonStr, cupWinner] of Object.entries(CUP_WINNERS)) {
    const season = parseInt(seasonStr);
    const year = season - 1; // MoneyPuck year
    const filename = `skaters-${year}.csv`;
    const filePath = path.join(DOWNLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  Missing data for ${season} ${cupWinner}`);
      continue;
    }

    console.log(`  Processing ${season} ${cupWinner}...`);

    const playerData = processSeasonFile(filePath, season);

    for (const { role, stats } of playerData) {
      if (!roleStats[role]) {
        roleStats[role] = initRoleStats();
      }

      roleStats[role].ppg.push(stats.ppg);
      roleStats[role].toi.push(stats.toiPerGame);
      if (stats.corsi !== null) roleStats[role].corsiForPct.push(stats.corsi);
      if (stats.fenwick !== null) roleStats[role].fenwickForPct.push(stats.fenwick);

      totalPlayers++;
    }

    console.log(`    ✓ ${playerData.length} players added`);
    teamsProcessed++;
  }

  console.log(`\n✓ Processed ${teamsProcessed} Cup-winning teams, ${totalPlayers} total players\n`);

  // Step 3: Calculate benchmarks
  console.log('='.repeat(80));
  console.log('CALCULATING COMPREHENSIVE BENCHMARKS');
  console.log(`Data from ${teamsProcessed} Stanley Cup winners (2006-2024)`);
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

    const avgCorsi = stats.corsiForPct.length > 0
      ? stats.corsiForPct.reduce((sum, val) => sum + val, 0) / stats.corsiForPct.length
      : 0;
    const stdDevCorsi = stats.corsiForPct.length > 0 ? calculateStdDev(stats.corsiForPct) : 0;

    const avgFenwick = stats.fenwickForPct.length > 0
      ? stats.fenwickForPct.reduce((sum, val) => sum + val, 0) / stats.fenwickForPct.length
      : 0;
    const stdDevFenwick = stats.fenwickForPct.length > 0 ? calculateStdDev(stats.fenwickForPct) : 0;

    benchmarks[role] = {
      avgPPG,
      stdDevPPG,
      medianPPG,
      p25PPG,
      p75PPG,
      minPPG,
      maxPPG,
      avgTOI,
      avgCorsiForPct: avgCorsi,
      stdDevCorsiForPct: stdDevCorsi,
      avgFenwickForPct: avgFenwick,
      stdDevFenwickForPct: stdDevFenwick,
      sampleSize: stats.ppg.length,
    };
  }

  // Print benchmarks
  for (const role of roleOrder) {
    if (!benchmarks[role]) continue;
    const b = benchmarks[role];

    console.log(`\n${role.toUpperCase()}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`  Sample Size: ${b.sampleSize} players across ${teamsProcessed} Cup winners`);
    console.log(`  PPG: ${b.avgPPG.toFixed(3)} ± ${b.stdDevPPG.toFixed(3)}`);
    console.log(`       Median: ${b.medianPPG.toFixed(3)}, Range: [${b.minPPG.toFixed(3)} - ${b.maxPPG.toFixed(3)}]`);
    console.log(`       P25: ${b.p25PPG.toFixed(3)} (minimum acceptable), P75: ${b.p75PPG.toFixed(3)} (elite)`);
    console.log(`  Avg TOI: ${b.avgTOI.toFixed(1)} min/game`);
    if (b.avgCorsiForPct > 0) {
      console.log(`  Corsi For %: ${b.avgCorsiForPct.toFixed(1)}% ± ${b.stdDevCorsiForPct.toFixed(1)}%`);
    }
    if (b.avgFenwickForPct > 0) {
      console.log(`  Fenwick For %: ${b.avgFenwickForPct.toFixed(1)}% ± ${b.stdDevFenwickForPct.toFixed(1)}%`);
    }
  }

  // Save to JSON
  const outputPath = path.resolve(__dirname, '../../../cup-winner-benchmarks.json');
  fs.writeFileSync(outputPath, JSON.stringify(benchmarks, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log(`✓ BENCHMARKS SAVED TO: ${outputPath}`);
  console.log('='.repeat(80));

  console.log(`\n✓ Comprehensive benchmarks generated from ${teamsProcessed} Cup winners!`);
  console.log(`  Total sample: ${totalPlayers} players`);
  console.log(`  These are empirical standards based on actual championship teams.\n`);

  return benchmarks;
}

generateComprehensiveBenchmarks()
  .then(() => {
    console.log('✓ Benchmark generation complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Error generating benchmarks:', error);
    process.exit(1);
  });
