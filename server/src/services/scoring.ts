// server/src/services/scoring.ts


import { PlayerSeasonStat } from '../models/index.js';
import type { Player } from '../models/Player.js';
import { sequelize } from '../db.js';

let _latestSeason: number | null = null;

export const currentSeason = async (): Promise<number> => {
  if (_latestSeason === null) {
    const result = await sequelize.query(
      'SELECT MAX(season) as latest_season FROM player_season_stats',
      { type: sequelize.QueryTypes.SELECT }
    ) as Array<{ latest_season: number }>;

    _latestSeason = result[0]?.latest_season || 2021;
  }

  return _latestSeason;
};

/**
 * Calculate a player's age based on the current game season (not real-world year)
 * Uses the latest season from the database to ensure accuracy
 *
 * @param dateOfBirth - Player's date of birth
 * @param seasonOverride - Optional season to use instead of querying database
 * @returns Age in years, or null if dateOfBirth is not provided
 */
export const calculatePlayerAge = async (dateOfBirth: Date | null | undefined, seasonOverride?: number): Promise<number | null> => {
  if (!dateOfBirth) {
    return null;
  }

  const season = seasonOverride ?? await currentSeason();
  const birthYear = new Date(dateOfBirth).getFullYear();

  return season - birthYear;
};

/**
 * Synchronous version of calculatePlayerAge that requires season to be provided
 * Use this when you already have the current season cached
 *
 * @param dateOfBirth - Player's date of birth
 * @param season - The current game season
 * @returns Age in years, or null if dateOfBirth is not provided
 */
export const calculatePlayerAgeSync = (dateOfBirth: Date | null | undefined, season: number): number | null => {
  if (!dateOfBirth) {
    return null;
  }

  const birthYear = new Date(dateOfBirth).getFullYear();
  return season - birthYear;
};

export async function playerValueScore(player: Player): Promise<number> {
  // Only analyze active, non-retired players
  if (player.retired) return -100;
  
  // Get ALL available seasons for this player, ordered by most recent first
  const stats = await PlayerSeasonStat.findAll({ 
    where: { playerId: player.playerId },
    order: [['season', 'DESC']],
    limit: 5 // Look at last 5 seasons max
  });
  
  if (!stats.length) return -100;
  
  // Calculate weighted average with more weight on recent seasons
  let totalScore = 0;
  let totalWeight = 0;
  
  stats.forEach((stat, index) => {
    const weight = Math.pow(0.8, index); // Recent seasons weighted more heavily
    const gamesPlayed = Math.max(stat.gamesPlayed ?? 0, 1);
    const points = (stat.goals ?? 0) + (stat.assists ?? 0);
    const pointsPerGame = points / gamesPlayed;
    const plusMinus = stat.plusMinus ?? 0;
    
    // Simple but effective scoring based on actual performance
    const seasonScore = (pointsPerGame * 50) + (plusMinus * 0.2);
    
    totalScore += seasonScore * weight;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? totalScore / totalWeight : -100;
}
