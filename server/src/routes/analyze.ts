// server/src/routes/analyze.ts

import { Router } from 'express';
import { analyzeTeamWithHockeyIntelligence } from '../services/hockeyAnalysis.js';
import { performAdvancedTeamAnalysis } from '../services/advancedTeamAnalysis.js';
import { analyzeTeamSpecialTeams } from '../services/specialTeamsAnalysis.js';
import { detectComprehensiveWeaknesses, getRosterBenchmarkSummary } from '../services/comprehensiveWeaknessDetection.js';
import { Team } from '../models/index.js';

const r = Router();

// Hockey-intelligent analysis using Cup winner benchmarks
r.post('/analyze', async (req, res) => {
  try {
    const { teamAbbrev, mode } = (req.body || {}) as {
      teamAbbrev: string;
      mode?: 'win-now' | 'rebuild';
    };

    if (!teamAbbrev) {
      return res.status(400).json({ error: 'teamAbbrev is required' });
    }

    const team = await Team.findOne({ where: { abbr: teamAbbrev } });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Use the full hockey intelligence analysis with Cup winner benchmarks
    const data = await analyzeTeamWithHockeyIntelligence(teamAbbrev, mode || 'win-now');

    // Add benchmark summary for UI display
    const benchmarkSummary = await getRosterBenchmarkSummary(team.teamId);
    const benchmarkScores = await detectComprehensiveWeaknesses(team.teamId, 10);

    const response = {
      ...data,
      cupWinnerBenchmarks: {
        summary: benchmarkSummary,
        allPlayers: benchmarkScores
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Hockey analysis error:', error);
    res.status(500).json({ error: 'Failed to perform hockey analysis' });
  }
});

// Alias for backward compatibility
r.post('/analyze/hockey', async (req, res) => {
  try {
    const { teamAbbrev, mode } = (req.body || {}) as {
      teamAbbrev: string;
      mode?: 'win-now' | 'rebuild';
    };
    
    if (!teamAbbrev) {
      return res.status(400).json({ error: 'teamAbbrev is required' });
    }
    
    const data = await analyzeTeamWithHockeyIntelligence(teamAbbrev, mode || 'win-now');
    res.json(data);
  } catch (error) {
    console.error('Hockey analysis error:', error);
    res.status(500).json({ error: 'Failed to perform hockey analysis' });
  }
});

// Advanced team management analysis - cap efficiency, trade values, strategic planning
r.post('/analyze/advanced', async (req, res) => {
  try {
    const { teamAbbrev } = (req.body || {}) as {
      teamAbbrev: string;
    };
    
    if (!teamAbbrev) {
      return res.status(400).json({ error: 'teamAbbrev is required' });
    }
    
    const analysis = await performAdvancedTeamAnalysis(teamAbbrev);
    res.json(analysis);
  } catch (error) {
    console.error('Advanced analysis error:', error);
    res.status(500).json({ error: 'Failed to perform advanced analysis' });
  }
});

// Special teams analysis - power play, penalty kill, face-offs
r.post('/analyze/special-teams', async (req, res) => {
  try {
    const { teamAbbrev } = (req.body || {}) as {
      teamAbbrev: string;
    };
    
    if (!teamAbbrev) {
      return res.status(400).json({ error: 'teamAbbrev is required' });
    }
    
    const analysis = await analyzeTeamSpecialTeams(teamAbbrev);
    res.json(analysis);
  } catch (error) {
    console.error('Special teams analysis error:', error);
    res.status(500).json({ error: 'Failed to perform special teams analysis' });
  }
});

export default r;
