// Test comprehensive weakness detection with formatted output
import { detectComprehensiveWeaknesses, getRosterBenchmarkSummary } from '../services/comprehensiveWeaknessDetection.js';
import { Team } from '../models/index.js';
import { sequelize } from '../db.js';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEAM_ABBREV = process.argv[2] || 'WAS';

const STANLEY_CUP_DIR = path.resolve(__dirname, '../../../stanley-cup-winners');

// Cup winners mapping
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
};

const TEAM_MAPPINGS: { [key: string]: string } = {
  'FLA': 'FLA', 'T.B': 'TBL', 'VGK': 'VGK', 'COL': 'COL', 'STL': 'STL',
  'WSH': 'WAS', 'PIT': 'PIT', 'CHI': 'CHI', 'L.A': 'LAK', 'BOS': 'BOS',
  'DET': 'DET',
};

// Classify role based on TOI and PPG
function classifyRole(position: string, ppg: number, toiPerGame: number): string {
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

// Get Cup winner examples for a specific role
function getCupWinnerExamples(targetRole: string, limit: number = 5): any[] {
  const examples: any[] = [];

  // Reverse iterate through Cup winners (most recent first)
  const seasons = Object.keys(CUP_WINNERS).map(s => parseInt(s)).sort((a, b) => b - a);

  for (const season of seasons) {
    if (examples.length >= limit) break;

    const year = season - 1; // MoneyPuck year
    const filename = `skaters-${year}.csv`;
    const filePath = path.join(STANLEY_CUP_DIR, filename);

    if (!fs.existsSync(filePath)) continue;

    const cupWinner = CUP_WINNERS[season];
    const moneyPuckTeam = Object.entries(TEAM_MAPPINGS).find(([mp, std]) => std === cupWinner)?.[0];
    if (!moneyPuckTeam) continue;

    try {
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

        if (role === targetRole) {
          const corsi = parseFloat(player.onIce_corsiPercentage);
          const fenwick = parseFloat(player.onIce_fenwickPercentage);

          examples.push({
            name: player.name,
            season,
            team: cupWinner,
            role,
            ppg,
            corsi: isNaN(corsi) ? null : corsi,
            fenwick: isNaN(fenwick) ? null : fenwick,
            toiPerGame,
            gamesPlayed,
          });

          if (examples.length >= limit) break;
        }
      }
    } catch (error) {
      // Skip if file can't be read
      continue;
    }
  }

  return examples;
}

async function testComprehensiveWeaknesses() {
  try {
    await sequelize.authenticate();
    console.log('Database connected\n');

    // Find team
    const team = await Team.findOne({ where: { abbr: TEAM_ABBREV } });
    if (!team) {
      console.error(`Team ${TEAM_ABBREV} not found`);
      process.exit(1);
    }

    console.log('='.repeat(80));
    console.log(`COMPREHENSIVE WEAKNESS ANALYSIS: ${team.name} (${team.abbr})`);
    console.log('='.repeat(80));
    console.log();
    console.log('METHODOLOGY (Statistical Analysis - Empirical Benchmarks):');
    console.log('  Forwards:   40% PPG, 35% Corsi, 25% Fenwick');
    console.log('  Defensemen: 30% PPG, 35% Corsi, 35% Fenwick');
    console.log('  All z-scores use actual standard deviations from Cup winner data');
    console.log('  "Control the play, and the points will come"');
    console.log();

    // Get summary
    const summary = await getRosterBenchmarkSummary(team.teamId);

    console.log('ROSTER SUMMARY');
    console.log('─'.repeat(80));
    console.log(`Total Players Analyzed: ${summary.totalPlayers}`);
    console.log(`Average Z-Score: ${summary.averageZScore.toFixed(3)} (negative = below Cup winners)`);
    console.log();
    console.log('Weakness Breakdown:');
    console.log(`  🔴 Critical:  ${summary.criticalWeaknesses} players`);
    console.log(`  🟠 High:      ${summary.highWeaknesses} players`);
    console.log(`  🟡 Moderate:  ${summary.moderateWeaknesses} players`);
    console.log(`  🟢 Adequate:  ${summary.meetsStandards} players`);
    console.log();

    if (summary.worstPlayer) {
      console.log(`Biggest Weakness: ${summary.worstPlayer.player.firstName} ${summary.worstPlayer.player.lastName} (${summary.worstPlayer.benchmarkRole})`);
      console.log(`  Total Weakness Score: ${summary.worstPlayer.totalWeaknessScore.toFixed(2)}`);
      console.log();
    }

    // Get all weakness scores
    const weaknessScores = await detectComprehensiveWeaknesses(team.teamId);

    // Display Critical weaknesses
    const critical = weaknessScores.filter(s => s.severityRating === 'Critical');
    if (critical.length > 0) {
      console.log('='.repeat(80));
      console.log(`🔴 CRITICAL WEAKNESSES (${critical.length})`);
      console.log('='.repeat(80));
      console.log();

      for (const player of critical) {
        printPlayerWeakness(player);
      }
    }

    // Display High weaknesses
    const high = weaknessScores.filter(s => s.severityRating === 'High');
    if (high.length > 0) {
      console.log('='.repeat(80));
      console.log(`🟠 HIGH PRIORITY WEAKNESSES (${high.length})`);
      console.log('='.repeat(80));
      console.log();

      for (const player of high) {
        printPlayerWeakness(player);
      }
    }

    // Display Moderate weaknesses
    const moderate = weaknessScores.filter(s => s.severityRating === 'Moderate');
    if (moderate.length > 0) {
      console.log('='.repeat(80));
      console.log(`🟡 MODERATE CONCERNS (${moderate.length})`);
      console.log('='.repeat(80));
      console.log();

      for (const player of moderate) {
        printPlayerWeakness(player);
      }
    }

    // Display top performers
    const performers = weaknessScores
      .filter(s => s.zScores.compositeZScore > 0)
      .sort((a, b) => b.zScores.compositeZScore - a.zScores.compositeZScore)
      .slice(0, 5);

    if (performers.length > 0) {
      console.log('='.repeat(80));
      console.log(`⭐ TOP PERFORMERS (Above Cup Winner Standards)`);
      console.log('='.repeat(80));
      console.log();

      for (const player of performers) {
        printPlayerPerformance(player);
      }
    }

    // Summary table of all players
    console.log();
    console.log('='.repeat(80));
    console.log('FULL ROSTER RANKINGS (Sorted by Weakness Score)');
    console.log('='.repeat(80));
    console.log();
    console.log('Rank | Player                    | Role      | PPG   | Corsi | Z-Score | Severity');
    console.log('─'.repeat(95));

    weaknessScores.forEach((player, index) => {
      const name = `${player.player.firstName} ${player.player.lastName}`.padEnd(25).substring(0, 25);
      const role = player.benchmarkRole.padEnd(9).substring(0, 9);
      const ppg = player.metrics.ppg.toFixed(3);
      const corsi = player.metrics.corsiForPct > 0 ? player.metrics.corsiForPct.toFixed(1) + '%' : 'N/A';
      const zScore = player.zScores.compositeZScore.toFixed(2);
      const severity = getSeveritySymbol(player.severityRating);

      console.log(`${(index + 1).toString().padStart(4)} | ${name} | ${role} | ${ppg} | ${corsi.padStart(5)} | ${zScore.padStart(7)} | ${severity}`);
    });

    console.log();
    console.log('='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

function printPlayerWeakness(player: any) {
  console.log(`${player.player.firstName} ${player.player.lastName}`);
  console.log(`  Position: ${player.player.position} | Role: ${player.benchmarkRole} | Cap Hit: $${player.player.capHit}M`);
  console.log(`  TOI: ${player.metrics.timeOnIce.toFixed(1)} min/game`);
  console.log();

  console.log(`  Performance vs Cup Winners:`);
  console.log(`    PPG:     ${player.metrics.ppg.toFixed(3)} vs ${player.benchmarks.avgPPG.toFixed(3)} avg (min: ${player.benchmarks.p25PPG.toFixed(3)}) [Z: ${player.zScores.ppgZScore.toFixed(2)}]`);

  if (player.metrics.corsiForPct > 0) {
    // Benchmarks are stored as decimals (0.5 = 50%), so multiply by 100 for display
    const benchmarkCorsiPct = player.benchmarks.avgCorsiForPct * 100;
    console.log(`    Corsi:   ${player.metrics.corsiForPct.toFixed(1)}% vs ${benchmarkCorsiPct.toFixed(1)}% avg [Z: ${player.zScores.corsiZScore.toFixed(2)}]`);
  }

  if (player.metrics.fenwickForPct > 0) {
    const benchmarkFenwickPct = player.benchmarks.avgFenwickForPct * 100;
    console.log(`    Fenwick: ${player.metrics.fenwickForPct.toFixed(1)}% vs ${benchmarkFenwickPct.toFixed(1)}% avg [Z: ${player.zScores.fenwickZScore.toFixed(2)}]`);
  }

  console.log();
  console.log(`  Composite Z-Score: ${player.zScores.compositeZScore.toFixed(3)}`);
  console.log(`  Position Weight: ${player.positionWeight.toFixed(1)}x`);
  console.log(`  Total Weakness Score: ${player.totalWeaknessScore.toFixed(2)}`);
  console.log();
  console.log(`  Analysis: ${player.explanation}`);
  console.log();

  // Get Cup winner comparisons
  console.log(`  Cup Winner Comparisons (${player.benchmarkRole}):`);
  const examples = getCupWinnerExamples(player.benchmarkRole, 5);

  if (examples.length > 0) {
    examples.forEach((ex: any) => {
      const corsiStr = ex.corsi ? ` | Corsi: ${ex.corsi.toFixed(1)}%` : '';
      console.log(`    ${ex.name.padEnd(25)} (${ex.season} ${ex.team}) - ${ex.ppg.toFixed(3)} PPG${corsiStr}`);
    });
  } else {
    console.log(`    No examples found`);
  }

  console.log();
  console.log('─'.repeat(80));
  console.log();
}

function printPlayerPerformance(player: any) {
  console.log(`${player.player.firstName} ${player.player.lastName} (${player.benchmarkRole})`);
  console.log(`  PPG: ${player.metrics.ppg.toFixed(3)} | Z-Score: +${player.zScores.compositeZScore.toFixed(2)} (${player.zScores.compositeZScore.toFixed(2)} std devs ABOVE Cup winners)`);

  if (player.metrics.corsiForPct > 0) {
    const benchmarkCorsiPct = player.benchmarks.avgCorsiForPct * 100;
    console.log(`  Corsi: ${player.metrics.corsiForPct.toFixed(1)}% vs ${benchmarkCorsiPct.toFixed(1)}% avg`);
  }

  // Show how they compare to Cup winners in same role
  const examples = getCupWinnerExamples(player.benchmarkRole, 3);
  if (examples.length > 0) {
    console.log(`  Comparable to:`);
    examples.slice(0, 2).forEach((ex: any) => {
      console.log(`    ${ex.name} (${ex.season} ${ex.team}) - ${ex.ppg.toFixed(3)} PPG`);
    });
  }

  console.log();
}

function getSeveritySymbol(severity: string): string {
  switch (severity) {
    case 'Critical': return '🔴 Critical';
    case 'High': return '🟠 High';
    case 'Moderate': return '🟡 Moderate';
    case 'Minor': return '🔵 Minor';
    case 'None': return '🟢 Good';
    default: return severity;
  }
}

testComprehensiveWeaknesses();
