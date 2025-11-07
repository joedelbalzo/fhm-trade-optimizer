// server/src/routes/teams.ts

import { Router } from 'express';
import { Op } from 'sequelize';
import { Team, Player, PlayerContract } from '../models/index.js';
import { currentSeason } from '../services/scoring.js';

const r = Router();

r.get('/teams', async (_req, res) => {
  try {
    const teams = await Team.findAll({
      where: { leagueId: { [Op.in]: [0, 1] } }, // NHL (0) and AHL (1) only - Fixed syntax
      order: [['leagueId', 'ASC'], ['abbr', 'ASC']]
    });
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

r.get('/teams/:abbr/roster', async (req, res) => {
  const { abbr } = req.params as { abbr: string };
  console.log('Looking for team with abbr:', abbr);

  const team = await Team.findOne({ where: { abbr } });
  console.log('Found team:', team ? `${team.name} (${team.abbr})` : 'null');

  if (!team) return res.status(404).json({ error: 'Team not found' });

  const players = await Player.findAll({
    where: { teamId: team.teamId },
    include: [{ model: PlayerContract, as: 'contract' }]
  });

  console.log('Found players:', players.length);

  // Transform contract data to match frontend expectations
  const CURRENT_SEASON = await currentSeason();
  const playersWithContract = players.map(player => {
    const p = player.toJSON();
    if (p.contract) {
      // Compute status string from boolean flags
      let status = '';
      if (p.contract.ufa) status = 'UFA';
      else if (p.contract.elc) status = 'ELC';
      else status = 'RFA'; // If not UFA and not ELC, assume RFA

      // Compute years left from salary data
      const salaryYears = Object.keys(p.contract.majorLeagueSalaries || {})
        .map(y => parseInt(y))
        .filter(y => y >= CURRENT_SEASON)
        .sort((a, b) => a - b);
      const yearsLeft = salaryYears.length > 0
        ? Math.max(...salaryYears) - CURRENT_SEASON + 1
        : 0;

      // Add computed fields
      p.contract.status = status;
      p.contract.yearsLeft = yearsLeft;
      // Convert averageSalary from dollars to millions
      p.contract.aav = p.contract.averageSalary / 1_000_000;
    }
    return p;
  });

  res.json({ team, players: playersWithContract });
});

export default r;
