// server/src/scripts/calculateSalaries.ts
// Comprehensive salary calculation system based on 2021 NHL TOI and performance

import { Op } from 'sequelize';
import { sequelize } from '../db.js';
import { Player, PlayerSeasonStat } from '../models/index.js';

// Salary ranges by position and role (in millions)
const SALARY_RANGES = {
  // Centers
  '1C': { min: 5.9, max: 12.5 },
  '2C': { min: 4.1, max: 5.85 },
  '3C': { min: 1.8, max: 4.0 },
  '4C': { min: 0.925, max: 1.8 },
  
  // Left Wings
  '1LW': { min: 4.7, max: 9.538462 },
  '2LW': { min: 2.3, max: 4.625 },
  '3LW': { min: 0.925, max: 2.275 },
  '4LW': { min: 0.874125, max: 0.925 },
  
  // Right Wings
  '1RW': { min: 4.85, max: 10.5 },
  '2RW': { min: 1.85, max: 4.766667 },
  '3RW': { min: 0.925, max: 1.85 },
  '4RW': { min: 0.8, max: 0.925 },
  
  // Defensemen
  '1D': { min: 5.5, max: 9.0 },
  '2D': { min: 4.6504, max: 5.5 },
  '3D': { min: 3.875, max: 4.625 },
  '4D': { min: 2.5, max: 3.857143 },
  '5D': { min: 1.3, max: 2.5 },
  '6D': { min: 0.925, max: 1.3 },
  
  // Goalies
  'Starting': { min: 7.0, max: 10.0 },
  'Backup': { min: 2.0, max: 7.0 },
  
  // Fallback ranges for any remaining invalid positions (should not be needed after fix)
  '4W': { min: 0.8, max: 0.925 },  // Generic 4th line wing (invalid but fallback)
  '3W': { min: 0.925, max: 1.85 }, // Generic 3rd line wing (invalid but fallback)
  '2W': { min: 1.85, max: 4.0 }    // Generic 2nd line wing (invalid but fallback)
};

// TOI thresholds for role classification
const TOI_THRESHOLDS = {
  forwards: {
    tier1: 18, // 1C/1LW/1RW
    tier2: 15, // 2C/2LW/2RW  
    tier3: 12, // 3C/3LW/3RW
    // tier4: under 12 = 4C/4LW/4RW
  },
  defensemen: {
    tier1: 22, // 1D
    tier2: 20, // 2D
    tier3: 18, // 3D
    tier4: 16, // 4D
    tier5: 14, // 5D
    // tier6: under 14 = 6D
  },
  goalies: {
    starter: 50 // games played
  }
};

interface PlayerWithStats {
  playerId: number;
  position: string;
  timeOnIce?: number;
  pointsPerGame?: number;
  gamesPlayed?: number;
  has2021Data: boolean;
  hasNHLData: boolean;
}

// Get role based on position and TOI
function getRole(position: string, timeOnIce: number, gamesPlayed: number = 0): string {
  // Handle goalies first - they use games played not time on ice
  if (position === 'G') {
    return gamesPlayed >= TOI_THRESHOLDS.goalies.starter ? 'Starting' : 'Backup';
  }
  
  // Convert total season seconds to average minutes per game
  const avgToiPerGame = gamesPlayed > 0 ? (timeOnIce / 60) / gamesPlayed : 0;
  
  if (['D', 'LD', 'RD'].includes(position)) {
    if (avgToiPerGame >= TOI_THRESHOLDS.defensemen.tier1) return '1D';
    if (avgToiPerGame >= TOI_THRESHOLDS.defensemen.tier2) return '2D';
    if (avgToiPerGame >= TOI_THRESHOLDS.defensemen.tier3) return '3D';
    if (avgToiPerGame >= TOI_THRESHOLDS.defensemen.tier4) return '4D';
    if (avgToiPerGame >= TOI_THRESHOLDS.defensemen.tier5) return '5D';
    return '6D';
  }
  
  // Forwards - get tier based on ice time
  const tier = avgToiPerGame >= TOI_THRESHOLDS.forwards.tier1 ? '1' :
               avgToiPerGame >= TOI_THRESHOLDS.forwards.tier2 ? '2' :
               avgToiPerGame >= TOI_THRESHOLDS.forwards.tier3 ? '3' : '4';
  
  // Use exact position from database
  if (position === 'C') return `${tier}C`;
  if (position === 'LW') return `${tier}LW`;
  if (position === 'RW') return `${tier}RW`;
  
  // Handle legacy/alternative position codes
  if (position === 'L') return `${tier}LW`;
  if (position === 'R') return `${tier}RW`;
  
  // Handle generic "W" position (should be split to LW/RW but default to LW)
  if (position === 'W') {
    console.log(`Generic W position found, defaulting to LW`);
    return `${tier}LW`;
  }
  
  // Handle any other forward positions by defaulting to center
  console.log(`Unknown forward position: ${position}, treating as center`);
  return `${tier}C`;
}

// Drop tier for missing data
function dropTier(role: string, tiers: number): string {
  if (role === 'Starting' || role === 'Backup') return role; // Don't drop goalie tiers
  
  // Extract position (LW, RW, C, D) and tier
  let position: string;
  let currentTier: number;
  
  if (role.endsWith('LW') || role.endsWith('RW')) {
    position = role.slice(-2); // LW or RW
    currentTier = parseInt(role.slice(0, -2)) || 1;
  } else {
    position = role.slice(-1); // C or D
    currentTier = parseInt(role.slice(0, -1)) || 1;
  }
  
  let newTier = currentTier + tiers;
  
  if (position === 'D') {
    newTier = Math.min(newTier, 6); // Max 6D
  } else {
    newTier = Math.min(newTier, 4); // Max 4C/4LW/4RW
  }
  
  return `${newTier}${position}`;
}

// Calculate salary within role based on performance rank
function calculateSalary(role: string, performanceRank: number, totalInRole: number): number {
  const range = SALARY_RANGES[role];
  if (!range) {
    console.warn(`No salary range found for role: ${role}`);
    return 0.925; // League minimum
  }
  
  if (totalInRole === 1) {
    return (range.min + range.max) / 2; // Average if only one player
  }
  
  // Scale from min to max based on performance rank (0 = best, totalInRole-1 = worst)
  const percentile = (totalInRole - 1 - performanceRank) / (totalInRole - 1);
  const salary = range.min + (range.max - range.min) * percentile;
  
  return Math.round(salary * 1000000) / 1000000; // Round to nearest dollar
}

// Main salary calculation function
export async function calculateAllPlayerSalaries(): Promise<void> {
  console.log('🏒 Starting comprehensive salary calculation for all players...');
  console.log('📊 This will process 100k+ players with performance-based salary assignment');
  
  try {
    // Get all players with their stats
    const playersWithStats = await sequelize.query(`
      SELECT 
        p."playerId",
        p."position",
        -- 2021 stats (preferred)
        s2021."timeOnIce" as toi_2021,
        CASE 
          WHEN s2021."gamesPlayed" > 0 THEN (s2021."goals" + s2021."assists")::float / s2021."gamesPlayed"
          ELSE 0 
        END as ppg_2021,
        s2021."gamesPlayed" as gp_2021,
        -- Latest stats (fallback)
        s_latest."timeOnIce" as toi_latest,
        CASE 
          WHEN s_latest."gamesPlayed" > 0 THEN (s_latest."goals" + s_latest."assists")::float / s_latest."gamesPlayed"
          ELSE 0 
        END as ppg_latest,
        s_latest."gamesPlayed" as gp_latest,
        s_latest."season" as latest_season
      FROM players p
      LEFT JOIN (
        SELECT DISTINCT ON ("playerId") 
          "playerId", "timeOnIce", "goals", "assists", "gamesPlayed"
        FROM player_season_stats 
        WHERE season = 2021
      ) s2021 ON p."playerId" = s2021."playerId"
      LEFT JOIN (
        SELECT DISTINCT ON ("playerId") 
          "playerId", "timeOnIce", "goals", "assists", "gamesPlayed", "season"
        FROM player_season_stats 
        ORDER BY "playerId", season DESC
      ) s_latest ON p."playerId" = s_latest."playerId"
      WHERE p.retired = false AND p.position IS NOT NULL
    `, { type: sequelize.QueryTypes.SELECT }) as any[];
    
    console.log(`Processing ${playersWithStats.length} players...`);
    
    // Process players and determine their roles
    const playersByRole: { [role: string]: PlayerWithStats[] } = {};
    
    for (const player of playersWithStats) {
      // Determine which stats to use and data availability
      const has2021Data = !!(player.toi_2021 && player.gp_2021 > 0);
      const hasNHLData = !!(player.toi_latest && player.gp_latest > 0);
      
      let timeOnIce = 0;
      let pointsPerGame = 0;
      let gamesPlayed = 0;
      
      if (has2021Data) {
        timeOnIce = player.toi_2021 || 0;
        pointsPerGame = player.ppg_2021 || 0;
        gamesPlayed = player.gp_2021 || 0;
      } else if (hasNHLData) {
        timeOnIce = player.toi_latest || 0;
        pointsPerGame = player.ppg_latest || 0;
        gamesPlayed = player.gp_latest || 0;
      }
      
      // Get base role from performance
      let role = getRole(player.position, timeOnIce, gamesPlayed);
      
      // Apply tier dropping for missing data
      if (!has2021Data && hasNHLData) {
        role = dropTier(role, 1); // Drop 1 tier
      } else if (!hasNHLData) {
        role = dropTier(role, 2); // Drop 2 tiers (AHL player)
      }
      
      // Store player with processed data
      if (!playersByRole[role]) {
        playersByRole[role] = [];
      }
      
      playersByRole[role].push({
        playerId: player.playerId,
        position: player.position,
        timeOnIce,
        pointsPerGame,
        gamesPlayed,
        has2021Data,
        hasNHLData
      });
    }
    
    console.log('Role distribution:');
    Object.entries(playersByRole).forEach(([role, players]) => {
      console.log(`  ${role}: ${players.length} players`);
    });
    
    // Calculate salaries for each role
    const salaryUpdates: { playerId: number; salary: number }[] = [];
    
    for (const [role, players] of Object.entries(playersByRole)) {
      if (players.length === 0) continue;
      
      // Sort by performance metric  
      if (role.includes('G')) {
        // Sort goalies by games played (more games = better/more trusted)
        players.sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0)); // DESCENDING - better players first
      } else {
        // Sort skaters by points per game
        players.sort((a, b) => (b.pointsPerGame || 0) - (a.pointsPerGame || 0)); // DESCENDING - better players first
      }
      
      // Calculate salary for each player in this role
      players.forEach((player, index) => {
        const salary = calculateSalary(role, index, players.length);
        salaryUpdates.push({
          playerId: player.playerId,
          salary
        });
      });
      
      console.log(`${role}: ${players.length} players, salary range $${calculateSalary(role, 0, players.length).toFixed(2)}M - $${calculateSalary(role, players.length - 1, players.length).toFixed(2)}M`);
    }
    
    console.log(`\nUpdating salaries for ${salaryUpdates.length} players...`);
    
    // Update salaries in batches
    const batchSize = 1000;
    for (let i = 0; i < salaryUpdates.length; i += batchSize) {
      const batch = salaryUpdates.slice(i, i + batchSize);
      
      // Create update cases for batch
      const cases = batch.map(update => 
        `WHEN "playerId" = ${update.playerId} THEN ${update.salary}`
      ).join(' ');
      
      const playerIds = batch.map(update => update.playerId).join(',');
      
      await sequelize.query(`
        UPDATE players 
        SET "capHit" = CASE ${cases} END
        WHERE "playerId" IN (${playerIds})
      `);
      
      console.log(`  Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(salaryUpdates.length / batchSize)}`);
    }
    
    console.log('✅ Salary calculation complete!');
    
    // Print summary statistics
    const stats = await sequelize.query(`
      SELECT 
        COUNT(*) as total_players,
        ROUND(AVG("capHit")::numeric, 2) as avg_salary,
        ROUND(MIN("capHit")::numeric, 2) as min_salary,
        ROUND(MAX("capHit")::numeric, 2) as max_salary
      FROM players 
      WHERE "capHit" IS NOT NULL AND retired = false
    `, { type: sequelize.QueryTypes.SELECT }) as any[];
    
    console.log('\nSalary Statistics:');
    console.log(`  Total players: ${stats[0].total_players}`);
    console.log(`  Average salary: $${stats[0].avg_salary}M`);
    console.log(`  Min salary: $${stats[0].min_salary}M`);
    console.log(`  Max salary: $${stats[0].max_salary}M`);
    
  } catch (error) {
    console.error('Error calculating salaries:', error);
    throw error;
  }
}

// Force immediate execution for debugging
console.log('🚀 Script starting now...');
calculateAllPlayerSalaries()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });