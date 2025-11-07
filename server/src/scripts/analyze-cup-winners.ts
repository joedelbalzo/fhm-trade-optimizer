// server/src/scripts/analyze-cup-winners.ts

import { sequelize } from '../db.js';
import { Player, PlayerSeasonStat, Team } from '../models/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Stanley Cup Winners (Salary Cap Era: 2006-2024)
const CUP_WINNERS = [
  { season: 2024, teamAbbrev: 'FLA', teamName: 'Florida Panthers' },
  { season: 2023, teamAbbrev: 'VGK', teamName: 'Vegas Golden Knights' },
  { season: 2022, teamAbbrev: 'COL', teamName: 'Colorado Avalanche' },
  { season: 2021, teamAbbrev: 'TBL', teamName: 'Tampa Bay Lightning' },
  { season: 2020, teamAbbrev: 'TBL', teamName: 'Tampa Bay Lightning' },
  { season: 2019, teamAbbrev: 'STL', teamName: 'St. Louis Blues' },
  { season: 2018, teamAbbrev: 'WAS', teamName: 'Washington Capitals' }, // Fixed: WSH → WAS
  { season: 2017, teamAbbrev: 'PIT', teamName: 'Pittsburgh Penguins' },
  { season: 2016, teamAbbrev: 'PIT', teamName: 'Pittsburgh Penguins' },
  { season: 2015, teamAbbrev: 'CHI', teamName: 'Chicago Blackhawks' },
  { season: 2014, teamAbbrev: 'LAK', teamName: 'Los Angeles Kings' },
  { season: 2013, teamAbbrev: 'CHI', teamName: 'Chicago Blackhawks' },
  { season: 2012, teamAbbrev: 'LAK', teamName: 'Los Angeles Kings' },
  { season: 2011, teamAbbrev: 'BOS', teamName: 'Boston Bruins' },
  { season: 2010, teamAbbrev: 'CHI', teamName: 'Chicago Blackhawks' },
  { season: 2009, teamAbbrev: 'PIT', teamName: 'Pittsburgh Penguins' },
  { season: 2008, teamAbbrev: 'DET', teamName: 'Detroit Red Wings' },
  { season: 2007, teamAbbrev: 'ANA', teamName: 'Anaheim Ducks' },
  { season: 2006, teamAbbrev: 'CAR', teamName: 'Carolina Hurricanes' },
];

interface RoleStats {
  ppg: number[];
  plusMinus: number[];
  toi: number[];
  age: number[];
  capHit: number[];
  corsiForPct: number[];
  fenwickForPct: number[];
  gameRatingOff: number[];
  gameRatingDef: number[];
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
    avgAge: number;
    avgCapHit: number;
    avgCorsiForPct: number;
    avgFenwickForPct: number;
    avgGameRatingOff: number;
    avgGameRatingDef: number;
    sampleSize: number;
  };
}

// Classify player role based on production and TOI
function classifyRole(position: string, ppg: number, toi: number): string {
  if (position === 'G') {
    return toi > 40 ? 'Starting' : 'Backup';
  }

  if (position === 'C') {
    if (ppg >= 0.6 && toi >= 18) return '1C';
    if (ppg >= 0.45 && toi >= 16) return '2C';
    if (ppg >= 0.35 && toi >= 14) return '3C';
    return '4C';
  }

  if (['LW', 'RW'].includes(position)) {
    if (ppg >= 0.6 && toi >= 16) return 'Top-6 Wing';
    if (ppg >= 0.35 && toi >= 12) return 'Middle-6 Wing';
    return 'Bottom-6 Wing';
  }

  if (['D', 'LD', 'RD'].includes(position)) {
    if (ppg >= 0.5 && toi >= 22) return '1D';
    if (ppg >= 0.4 && toi >= 20) return '2D';
    if (ppg >= 0.3 && toi >= 18) return '3D';
    if (ppg >= 0.25 && toi >= 16) return '4D';
    if (ppg >= 0.2 && toi >= 14) return '5D';
    return '6D';
  }

  return 'Unknown';
}

// Calculate standard deviation
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

// Calculate median
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Calculate percentile
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

async function analyzeCupWinners() {
  console.log('Analyzing Stanley Cup Winners (2006-2024)...\n');

  // Check if season stats data exists
  const statCount = await PlayerSeasonStat.count();
  if (statCount === 0) {
    console.error('\n' + '!'.repeat(80));
    console.error('ERROR: No season stats data found in database!');
    console.error('!'.repeat(80));
    console.error('\nThe player_season_stats table is empty. You need to import data first:');
    console.error('  Run: npm run import-fhm12');
    console.error('\nThis will populate the database with season-by-season statistics');
    console.error('which are required for Cup winner analysis.');
    console.error('!'.repeat(80) + '\n');
    throw new Error('Cannot analyze Cup winners without season stats data');
  }

  console.log(`Found ${statCount} season stat records in database\n`);

  const roleStats: { [role: string]: RoleStats } = {};
  const teamStats: { season: number; teamName: string; totalPlayers: number; avgAge: number; avgPPG: number; totalCapHit: number }[] = [];
  const skippedTeams: string[] = [];

  // Initialize role tracking
  const initRoleStats = (): RoleStats => ({
    ppg: [],
    plusMinus: [],
    toi: [],
    age: [],
    capHit: [],
    corsiForPct: [],
    fenwickForPct: [],
    gameRatingOff: [],
    gameRatingDef: [],
  });

  for (const winner of CUP_WINNERS) {
    console.log(`\nAnalyzing ${winner.season} ${winner.teamName} (${winner.teamAbbrev})...`);

    // Find the team
    const team = await Team.findOne({ where: { abbr: winner.teamAbbrev } });
    if (!team) {
      console.log(`  ⚠️  Team ${winner.teamAbbrev} not found in database, skipping...`);
      skippedTeams.push(`${winner.season} ${winner.teamName} (${winner.teamAbbrev})`);
      continue;
    }

    console.log(`  Found: ${team.name} (${team.abbr})`);

    // Get all players who played for this team in this season
    const players = await Player.findAll({
      include: [{
        model: PlayerSeasonStat,
        as: 'seasonStats',
        where: {
          teamId: team.teamId,
          season: winner.season,
        },
        required: true,
      }],
    });

    console.log(`  Found ${players.length} players on roster`);

    let processed = 0;
    let teamTotalAge = 0;
    let teamTotalPPG = 0;
    let teamTotalCapHit = 0;
    let teamPlayerCount = 0;

    for (const player of players) {
      const stats = player.seasonStats?.[0];
      if (!stats || !stats.gamesPlayed || stats.gamesPlayed < 10) continue; // Minimum 10 games

      const ppg = stats.gamesPlayed > 0
        ? (stats.goals + stats.assists) / stats.gamesPlayed
        : 0;

      const toi = stats.timeOnIce ? stats.timeOnIce / 60 : 0; // Convert to minutes

      const role = classifyRole(player.position, ppg, toi);
      if (role === 'Unknown') continue;

      // Initialize role stats if needed
      if (!roleStats[role]) {
        roleStats[role] = initRoleStats();
      }

      // Calculate age
      const age = player.dateOfBirth
        ? winner.season - new Date(player.dateOfBirth).getFullYear()
        : 0;

      // Add to aggregates
      roleStats[role].ppg.push(ppg);
      roleStats[role].plusMinus.push(stats.plusMinus || 0);
      roleStats[role].toi.push(toi);
      roleStats[role].age.push(age);
      roleStats[role].capHit.push(parseFloat(player.capHit) || 0.925);

      if (stats.corsiForPercentage) roleStats[role].corsiForPct.push(stats.corsiForPercentage);
      if (stats.fenwickForPercentage) roleStats[role].fenwickForPct.push(stats.fenwickForPercentage);
      if (stats.gameRatingOff) roleStats[role].gameRatingOff.push(stats.gameRatingOff);
      if (stats.gameRatingDef) roleStats[role].gameRatingDef.push(stats.gameRatingDef);

      // Accumulate team stats
      teamTotalAge += age;
      teamTotalPPG += ppg;
      teamTotalCapHit += parseFloat(player.capHit) || 0.925;
      teamPlayerCount++;

      processed++;
    }

    // Store team-level stats
    if (teamPlayerCount > 0) {
      teamStats.push({
        season: winner.season,
        teamName: winner.teamName,
        totalPlayers: teamPlayerCount,
        avgAge: teamTotalAge / teamPlayerCount,
        avgPPG: teamTotalPPG / teamPlayerCount,
        totalCapHit: teamTotalCapHit
      });
    }

    console.log(`  Processed ${processed} players with sufficient games played`);
  }

  // Report skipped teams
  if (skippedTeams.length > 0) {
    console.log('\n' + '!'.repeat(80));
    console.log('WARNING: Some Cup winners were not found in database:');
    skippedTeams.forEach(team => console.log(`  • ${team}`));
    console.log('Benchmarks will be based on ' + (CUP_WINNERS.length - skippedTeams.length) + ' of ' + CUP_WINNERS.length + ' Cup winners');
    console.log('!'.repeat(80) + '\n');
  }

  // Calculate benchmarks
  console.log('\n\n' + '='.repeat(80));
  console.log('CALCULATING BENCHMARKS ACROSS ALL CUP WINNERS');
  console.log(`Analyzed ${CUP_WINNERS.length - skippedTeams.length}/${CUP_WINNERS.length} teams`);
  console.log('='.repeat(80) + '\n');

  const benchmarks: Benchmarks = {};
  const roleOrder = ['1C', '2C', '3C', '4C', 'Top-6 Wing', 'Middle-6 Wing', 'Bottom-6 Wing', '1D', '2D', '3D', '4D', '5D', '6D', 'Starting', 'Backup'];

  for (const [role, stats] of Object.entries(roleStats)) {
    if (stats.ppg.length === 0) continue;

    const avgPPG = stats.ppg.reduce((sum, val) => sum + val, 0) / stats.ppg.length;
    const stdDevPPG = calculateStdDev(stats.ppg);
    const medianPPG = calculateMedian(stats.ppg);
    const p25PPG = calculatePercentile(stats.ppg, 25);
    const p75PPG = calculatePercentile(stats.ppg, 75);
    const minPPG = Math.min(...stats.ppg);
    const maxPPG = Math.max(...stats.ppg);

    benchmarks[role] = {
      avgPPG,
      stdDevPPG,
      medianPPG,
      p25PPG,
      p75PPG,
      minPPG,
      maxPPG,
      avgAge: stats.age.reduce((sum, val) => sum + val, 0) / stats.age.length,
      avgCapHit: stats.capHit.reduce((sum, val) => sum + val, 0) / stats.capHit.length,
      avgCorsiForPct: stats.corsiForPct.length > 0
        ? stats.corsiForPct.reduce((sum, val) => sum + val, 0) / stats.corsiForPct.length
        : 0,
      avgFenwickForPct: stats.fenwickForPct.length > 0
        ? stats.fenwickForPct.reduce((sum, val) => sum + val, 0) / stats.fenwickForPct.length
        : 0,
      avgGameRatingOff: stats.gameRatingOff.length > 0
        ? stats.gameRatingOff.reduce((sum, val) => sum + val, 0) / stats.gameRatingOff.length
        : 0,
      avgGameRatingDef: stats.gameRatingDef.length > 0
        ? stats.gameRatingDef.reduce((sum, val) => sum + val, 0) / stats.gameRatingDef.length
        : 0,
      sampleSize: stats.ppg.length,
    };
  }

  // Print benchmarks in order
  for (const role of roleOrder) {
    if (!benchmarks[role]) continue;
    const b = benchmarks[role];

    console.log(`\n${role.toUpperCase()}`);
    console.log(`${'─'.repeat(role.length + 10)}`);
    console.log(`  Sample Size: ${b.sampleSize} players`);
    console.log(`  PPG: ${b.avgPPG.toFixed(3)} ± ${b.stdDevPPG.toFixed(3)}`);
    console.log(`       Median: ${b.medianPPG.toFixed(3)}, Range: [${b.minPPG.toFixed(3)} - ${b.maxPPG.toFixed(3)}]`);
    console.log(`       P25: ${b.p25PPG.toFixed(3)}, P75: ${b.p75PPG.toFixed(3)}`);
    console.log(`  Age: ${b.avgAge.toFixed(1)} years`);
    console.log(`  Cap Hit: $${b.avgCapHit.toFixed(2)}M`);

    if (b.avgCorsiForPct > 0) {
      console.log(`  Corsi For %: ${b.avgCorsiForPct.toFixed(1)}%`);
    }
    if (b.avgFenwickForPct > 0) {
      console.log(`  Fenwick For %: ${b.avgFenwickForPct.toFixed(1)}%`);
    }
    if (b.avgGameRatingOff > 0) {
      console.log(`  Game Rating (Off): ${b.avgGameRatingOff.toFixed(1)}`);
    }
    if (b.avgGameRatingDef > 0) {
      console.log(`  Game Rating (Def): ${b.avgGameRatingDef.toFixed(1)}`);
    }
  }

  // Save to JSON (project root, not server directory)
  const outputPath = path.resolve(__dirname, '../../../cup-winner-benchmarks.json');
  fs.writeFileSync(outputPath, JSON.stringify(benchmarks, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log(`BENCHMARKS SAVED TO: ${outputPath}`);
  console.log('='.repeat(80));

  // Print summary insights
  console.log('\nKEY INSIGHTS FROM CUP WINNERS (2006-2024):');
  console.log('─'.repeat(80));

  // Top line production expectations
  if (benchmarks['1C']) {
    const c1 = benchmarks['1C'];
    console.log(`\n1st Line Center: ${c1.avgPPG.toFixed(3)} PPG average`);
    console.log(`  • Top performers (75th percentile): ${c1.p75PPG.toFixed(3)} PPG`);
    console.log(`  • Minimum acceptable (25th percentile): ${c1.p25PPG.toFixed(3)} PPG`);
    console.log(`  • Avg age: ${c1.avgAge.toFixed(1)} years, Cap hit: $${c1.avgCapHit.toFixed(2)}M`);
  }

  if (benchmarks['1D']) {
    const d1 = benchmarks['1D'];
    console.log(`\n1st Pair Defenseman: ${d1.avgPPG.toFixed(3)} PPG average`);
    console.log(`  • Top performers (75th percentile): ${d1.p75PPG.toFixed(3)} PPG`);
    console.log(`  • Minimum acceptable (25th percentile): ${d1.p25PPG.toFixed(3)} PPG`);
    console.log(`  • Avg age: ${d1.avgAge.toFixed(1)} years, Cap hit: $${d1.avgCapHit.toFixed(2)}M`);
  }

  // Depth scoring expectations
  if (benchmarks['3C']) {
    const c3 = benchmarks['3C'];
    console.log(`\n3rd Line Center: ${c3.avgPPG.toFixed(3)} PPG average`);
    console.log(`  • Depth scoring is critical - range: [${c3.minPPG.toFixed(3)} - ${c3.maxPPG.toFixed(3)}]`);
  }

  if (benchmarks['Bottom-6 Wing']) {
    const w4 = benchmarks['Bottom-6 Wing'];
    console.log(`\nBottom-6 Wings: ${w4.avgPPG.toFixed(3)} PPG average`);
    console.log(`  • Even depth players contribute - median: ${w4.medianPPG.toFixed(3)} PPG`);
  }

  // Cap efficiency insights
  console.log('\nCAP EFFICIENCY PATTERNS:');
  console.log(`  • Star centers (1C) typically cost $${benchmarks['1C']?.avgCapHit.toFixed(2)}M`);
  console.log(`  • Secondary scoring (2C) averages $${benchmarks['2C']?.avgCapHit.toFixed(2)}M`);
  console.log(`  • Depth centers (3C/4C) cost $${benchmarks['3C']?.avgCapHit.toFixed(2)}M / $${benchmarks['4C']?.avgCapHit.toFixed(2)}M`);
  console.log(`  • Top defensemen (1D) command $${benchmarks['1D']?.avgCapHit.toFixed(2)}M`);

  // Team-level analysis
  if (teamStats.length > 0) {
    const avgTeamAge = teamStats.reduce((sum, t) => sum + t.avgAge, 0) / teamStats.length;
    const avgTeamPPG = teamStats.reduce((sum, t) => sum + t.avgPPG, 0) / teamStats.length;
    const avgTotalCapHit = teamStats.reduce((sum, t) => sum + t.totalCapHit, 0) / teamStats.length;

    console.log('\nTEAM-LEVEL PATTERNS:');
    console.log(`  • Average roster age: ${avgTeamAge.toFixed(1)} years`);
    console.log(`  • Average per-player production: ${avgTeamPPG.toFixed(3)} PPG`);
    console.log(`  • Average total cap allocated: $${avgTotalCapHit.toFixed(1)}M`);

    // Find youngest and oldest Cup winners
    const youngest = teamStats.reduce((min, t) => t.avgAge < min.avgAge ? t : min);
    const oldest = teamStats.reduce((max, t) => t.avgAge > max.avgAge ? t : max);

    console.log(`\n  • Youngest Cup winner: ${youngest.season} ${youngest.teamName} (${youngest.avgAge.toFixed(1)} years avg)`);
    console.log(`  • Oldest Cup winner: ${oldest.season} ${oldest.teamName} (${oldest.avgAge.toFixed(1)} years avg)`);

    // Era comparison (modern vs older)
    const modernEra = teamStats.filter(t => t.season >= 2015);
    const olderEra = teamStats.filter(t => t.season < 2015);

    if (modernEra.length > 0 && olderEra.length > 0) {
      const modernAvgAge = modernEra.reduce((sum, t) => sum + t.avgAge, 0) / modernEra.length;
      const olderAvgAge = olderEra.reduce((sum, t) => sum + t.avgAge, 0) / olderEra.length;

      console.log(`\nERA COMPARISON:`);
      console.log(`  • 2015-2024 Cup winners: ${modernAvgAge.toFixed(1)} years avg age`);
      console.log(`  • 2006-2014 Cup winners: ${olderAvgAge.toFixed(1)} years avg age`);
      console.log(`  • Trend: ${modernAvgAge > olderAvgAge ? 'Teams are getting older' : 'Teams are getting younger'}`);
    }
  }

  console.log('\n' + '='.repeat(80));

  return benchmarks;
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Database connected\n');

    const benchmarks = await analyzeCupWinners();

    console.log('\n===========================================');
    console.log('Cup Winner Analysis Complete!');
    console.log('===========================================\n');

  } catch (error) {
    console.error('Analysis failed:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

main();
