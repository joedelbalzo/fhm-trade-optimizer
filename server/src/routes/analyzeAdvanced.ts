/**
 * Advanced Analysis Routes
 * Endpoints for the sophisticated role-aware player evaluation
 */

import { Router } from 'express';
import { analyzeTeamAdvanced, getMethodologyExplanation } from '../services/analyzeAdvanced.js';

const router = Router();

/**
 * POST /api/analyze/advanced
 * Perform advanced role-aware team analysis
 */
router.post('/analyze/advanced', async (req, res) => {
  try {
    const { 
      mode = 'win-now', 
      teamAbbrev = null, 
      playerIds = [] 
    } = (req.body || {}) as {
      mode?: 'win-now' | 'rebuild';
      teamAbbrev?: string | null;
      playerIds?: number[];
    };

    console.log(`Advanced analysis request: mode=${mode}, team=${teamAbbrev}, players=${playerIds?.length || 0}`);

    const result = await analyzeTeamAdvanced({ mode, teamAbbrev: teamAbbrev ?? undefined, playerIds });
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Advanced analysis error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/analyze/methodology
 * Get explanation of the evaluation methodology
 */
router.get('/analyze/methodology', async (req, res) => {
  try {
    const methodology = getMethodologyExplanation();
    
    res.json({
      success: true,
      data: methodology,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Methodology explanation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/analyze/compare
 * Compare multiple teams using advanced analysis
 */
router.post('/analyze/compare', async (req, res) => {
  try {
    const { 
      teams = [], 
      mode = 'win-now' 
    } = (req.body || {}) as {
      teams?: string[];
      mode?: 'win-now' | 'rebuild';
    };

    if (!teams.length || teams.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Must provide 1-5 team abbreviations for comparison',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`Team comparison request: teams=${teams.join(',')}, mode=${mode}`);

    // Analyze each team
    const teamAnalyses = await Promise.all(
      teams.map(async (teamAbbrev) => {
        try {
          return await analyzeTeamAdvanced({ mode, teamAbbrev });
        } catch (error) {
          console.warn(`Failed to analyze team ${teamAbbrev}:`, error);
          return null;
        }
      })
    );

    // Filter out failed analyses
    const successfulAnalyses = teamAnalyses.filter(analysis => analysis !== null);

    if (successfulAnalyses.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No teams could be analyzed',
        timestamp: new Date().toISOString()
      });
    }

    // Generate comparison insights
    const comparison = {
      teams: successfulAnalyses,
      summary: {
        totalPlayersAnalyzed: successfulAnalyses.reduce((sum, team) => sum + team.teamInfo.playersAnalyzed, 0),
        averageWeakPlayers: successfulAnalyses.reduce((sum, team) => sum + team.weakPlayers.length, 0) / successfulAnalyses.length,
        mostCommonWeakRoles: getMostCommonWeakRoles(successfulAnalyses),
        teamRankings: successfulAnalyses
          .map(team => ({
            abbrev: team.teamInfo.abbrev,
            name: team.teamInfo.name,
            weaknessScore: calculateWeaknessScore(team),
            averageConfidence: team.weakPlayers.reduce((sum, p) => sum + p.confidence, 0) / Math.max(1, team.weakPlayers.length)
          }))
          .sort((a, b) => a.weaknessScore - b.weaknessScore) // Lower weakness score = better
      }
    };

    res.json({
      success: true,
      data: comparison,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Team comparison error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Helper function to calculate team weakness score
 */
function calculateWeaknessScore(analysis: any): number {
  const weakPlayers = analysis.weakPlayers;
  if (!weakPlayers.length) return 0;

  // Weight by severity of weakness and confidence
  return weakPlayers.reduce((sum: number, player: any) => {
    const severityWeight = player.weaknessType === 'impact' ? 2 : 1;
    const confidenceWeight = player.confidence;
    const replacementDelta = Math.abs(player.replacementDelta);
    
    return sum + (severityWeight * confidenceWeight * replacementDelta);
  }, 0) / weakPlayers.length;
}

/**
 * Helper function to find most common weak roles across teams
 */
function getMostCommonWeakRoles(analyses: any[]): Array<{ role: string; count: number; percentage: number }> {
  const roleCounts: Record<string, number> = {};
  let totalWeakPlayers = 0;

  analyses.forEach(analysis => {
    analysis.weakPlayers.forEach((player: any) => {
      roleCounts[player.player.role] = (roleCounts[player.player.role] || 0) + 1;
      totalWeakPlayers++;
    });
  });

  return Object.entries(roleCounts)
    .map(([role, count]) => ({
      role,
      count,
      percentage: Math.round((count / totalWeakPlayers) * 100)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export default router;