// server/src/routes/players.ts

import { Router } from 'express';
import { Op } from 'sequelize';
import { Player, PlayerRating, PlayerSeasonStat, Team } from '../models/index.js';
import { currentSeason, calculatePlayerAgeSync } from '../services/scoring.js';

const r = Router();

/**
 * GET /players
 * Search and filter players with advanced criteria
 */
r.get('/players', async (req, res) => {
  try {
    const {
      search = '',
      position = '',
      teamAbbr = '',
      minAge = '',
      maxAge = '',
      minOverall = '',
      maxOverall = '',
      league = '',
      sortBy = 'name',
      order = 'ASC',
      limit = '50',
      offset = '0'
    } = req.query as Record<string, string>;

    // Build where conditions
    const whereConditions: any = {};
    
    // Name search
    if (search) {
      whereConditions[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Position filter
    if (position) {
      whereConditions.position = position;
    }

    // Age filters
    if (minAge || maxAge) {
      const season = await currentSeason();
      const ageConditions: any = {};

      if (maxAge) {
        // Players born after season - maxAge
        ageConditions[Op.gte] = season - parseInt(maxAge);
      }
      if (minAge) {
        // Players born before season - minAge
        ageConditions[Op.lte] = season - parseInt(minAge);
      }

      whereConditions.birthYear = ageConditions;
    }

    // Team filter
    let teamFilter: any = {};
    if (teamAbbr) {
      const team = await Team.findOne({ where: { abbr: teamAbbr } });
      if (team) {
        whereConditions.teamId = team.teamId;
      }
    }

    // League filter (through team)
    if (league && !teamAbbr) {
      const leagueId = league === 'NHL' ? 0 : league === 'AHL' ? 1 : null;
      if (leagueId !== null) {
        teamFilter = { leagueId };
      }
    }

    // Rating-based filters
    const ratingWhere: any = {};
    if (minOverall || maxOverall) {
      if (minOverall) ratingWhere.skating = { [Op.gte]: parseInt(minOverall) };
      if (maxOverall) ratingWhere.skating = { ...ratingWhere.skating, [Op.lte]: parseInt(maxOverall) };
    }

    // Sort mapping
    const sortMapping: Record<string, any> = {
      name: ['lastName', order],
      age: ['birthYear', order === 'ASC' ? 'DESC' : 'ASC'], // Reverse for age
      position: ['position', order],
      team: [{ model: Team, as: 'team' }, 'abbr', order]
    };

    const orderBy = sortMapping[sortBy] || ['lastName', 'ASC'];

    // Execute query
    const { count, rows: players } = await Player.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: PlayerRating,
          as: 'ratings',
          where: Object.keys(ratingWhere).length > 0 ? ratingWhere : undefined,
          required: Object.keys(ratingWhere).length > 0
        },
        {
          model: Team,
          as: 'team',
          where: Object.keys(teamFilter).length > 0 ? teamFilter : undefined,
          required: Object.keys(teamFilter).length > 0 || !!teamAbbr
        }
      ],
      order: [orderBy],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Add computed age field to each player
    const season = await currentSeason();
    const playersWithAge = players.map(player => {
      const playerJson = player.toJSON();
      return {
        ...playerJson,
        age: calculatePlayerAgeSync(player.dateOfBirth, season)
      };
    });

    res.json({
      players: playersWithAge,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Player search error:', error);
    res.status(500).json({ error: 'Failed to search players' });
  }
});

/**
 * GET /players/positions
 * Get list of available positions
 */
r.get('/players/positions', async (req, res) => {
  try {
    const positions = await Player.findAll({
      attributes: ['position'],
      group: ['position'],
      where: {
        position: { [Op.ne]: null }
      },
      order: [['position', 'ASC']]
    });

    const positionList = positions.map(p => p.position).filter(Boolean);

    res.json(positionList);

  } catch (error) {
    console.error('Positions error:', error);
    res.status(500).json({ error: 'Failed to get positions' });
  }
});

/**
 * GET /players/:playerId
 * Get detailed player information
 */
r.get('/players/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    const player = await Player.findOne({
      where: { playerId },
      include: [
        {
          model: PlayerRating,
          as: 'ratings'
        },
        {
          model: Team,
          as: 'team'
        },
        {
          model: PlayerSeasonStat,
          as: 'seasonStats',
          limit: 10,
          order: [['season', 'DESC']]
        }
      ]
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Add computed age field
    const season = await currentSeason();
    const playerWithAge = {
      ...player.toJSON(),
      age: calculatePlayerAgeSync(player.dateOfBirth, season)
    };

    res.json(playerWithAge);

  } catch (error) {
    console.error('Player detail error:', error);
    res.status(500).json({ error: 'Failed to get player details' });
  }
});

/**
 * GET /players/similar/:playerId
 * Find similar players based on ratings and position
 */
r.get('/players/similar/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { limit = '10', excludeTeam = 'false' } = req.query as Record<string, string>;

    // Get target player
    const targetPlayer = await Player.findOne({
      where: { playerId },
      include: [
        { model: PlayerRating, as: 'ratings' },
        { model: Team, as: 'team' }
      ]
    });

    if (!targetPlayer || !targetPlayer.ratings) {
      return res.status(404).json({ error: 'Player not found or no ratings available' });
    }

    // Build similarity query
    const whereConditions: any = {
      playerId: { [Op.ne]: playerId },
      position: targetPlayer.position
    };

    // Exclude same team if requested
    if (excludeTeam === 'true' && targetPlayer.teamId) {
      whereConditions.teamId = { [Op.ne]: targetPlayer.teamId };
    }

    // Find players with similar ratings
    const ratings = targetPlayer.ratings;
    const keySkills = ['skating', 'shooting', 'playmaking', 'defending', 'physicality', 'conditioning'];
    
    const similarPlayers = await Player.findAll({
      where: whereConditions,
      include: [
        { 
          model: PlayerRating, 
          as: 'ratings',
          required: true
        },
        { model: Team, as: 'team' }
      ],
      limit: parseInt(limit) * 3 // Get more to filter by similarity
    });

    // Calculate similarity scores and add ages
    const season = await currentSeason();
    const playersWithSimilarity = similarPlayers
      .map(player => {
        if (!player.ratings) return null;

        let totalDiff = 0;
        let skillsCompared = 0;

        keySkills.forEach(skill => {
          const targetValue = (ratings as any)[skill];
          const playerValue = (player.ratings as any)[skill];

          if (targetValue && playerValue) {
            totalDiff += Math.abs(targetValue - playerValue);
            skillsCompared++;
          }
        });

        const similarity = skillsCompared > 0 ? 1 - (totalDiff / (skillsCompared * 20)) : 0; // Scale by max rating difference

        return {
          ...player.toJSON(),
          age: calculatePlayerAgeSync(player.dateOfBirth, season),
          similarity: Math.max(0, similarity)
        };
      })
      .filter(player => player !== null)
      .sort((a, b) => b!.similarity - a!.similarity)
      .slice(0, parseInt(limit));

    // Add age to target player
    const targetPlayerWithAge = {
      ...targetPlayer.toJSON(),
      age: calculatePlayerAgeSync(targetPlayer.dateOfBirth, season)
    };

    res.json({
      targetPlayer: targetPlayerWithAge,
      similarPlayers: playersWithSimilarity
    });

  } catch (error) {
    console.error('Similar players error:', error);
    res.status(500).json({ error: 'Failed to find similar players' });
  }
});

export default r;