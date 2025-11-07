/**
 * Advanced Team Analysis Service
 * Replaces the simple analysis with sophisticated role-aware evaluation
 */

import { Op } from 'sequelize';
import { Team, Player } from '../models/index.js';
import { findWeakPlayersAdvanced, findReplacementCandidates } from './advancedEvaluation.js';
import { Evaluation, Role } from '../algo_v1.js';

export interface WeakPlayerAnalysis {
  player: {
    id: number;
    name: string;
    teamAbbrev: string | null;
    position: string;
    role: Role;
    age: number | null;
  };
  weaknessType: 'impact' | 'misuse';
  reason: string;
  impactScore: number;
  replacementDelta: number;
  confidence: number;
  keyIssues: string[];
  rolePercentile: number; // percentile within role (0-100)
}

export interface ReplacementSuggestion {
  forPlayerId: number;
  suggestionType: 'replace' | 'reassign';
  candidates?: Array<{
    id: number;
    name: string;
    teamAbbrev: string | null;
    position: string;
    role: Role;
    age: number | null;
    impactScore: number;
    availability: 'trade' | 'free_agent' | 'prospect' | 'unknown';
    rationale: string;
  }>;
  reassignmentNote?: string;
  confidence: number;
}

export interface AdvancedAnalysisResult {
  teamInfo: {
    abbrev: string;
    name: string;
    playersAnalyzed: number;
  };
  weakPlayers: WeakPlayerAnalysis[];
  replacementSuggestions: ReplacementSuggestion[];
  teamInsights: {
    strongestRoles: Role[];
    weakestRoles: Role[];
    averageAge: number;
    roleDistribution: Record<Role, number>;
  };
  methodology: {
    algorithm: 'role-aware-impact-evaluation';
    benchmarkSize: number;
    confidenceThreshold: number;
    replacementThreshold: string;
  };
}

/**
 * Perform advanced team analysis using role-aware evaluation
 */
export async function analyzeTeamAdvanced({
  mode,
  teamAbbrev,
  playerIds
}: {
  mode: 'win-now' | 'rebuild';
  teamAbbrev?: string;
  playerIds?: number[];
}): Promise<AdvancedAnalysisResult> {
  
  if (!teamAbbrev && (!playerIds || playerIds.length === 0)) {
    throw new Error('Must provide either teamAbbrev or playerIds');
  }

  let team: Team | null = null;
  let analysisPlayers: Player[] = [];

  if (teamAbbrev) {
    // Analyze full team
    team = await Team.findOne({ where: { abbr: teamAbbrev } });
    if (!team) {
      throw new Error(`Team not found: ${teamAbbrev}`);
    }
    
    // Find weak players using the advanced algorithm
    const { weakPlayers, leagueContext } = await findWeakPlayersAdvanced(teamAbbrev, mode);
    
    // Get all team players for insights
    analysisPlayers = await Player.findAll({ where: { teamId: team.teamId } });
    
    // Build weak player analysis
    const weakPlayerAnalysis: WeakPlayerAnalysis[] = await Promise.all(
      weakPlayers.map(async (wp) => {
        const playerEvaluation = wp.player;
        const age = playerEvaluation.bio.birthYear ? new Date().getFullYear() - playerEvaluation.bio.birthYear : null;
        
        // Calculate role percentile (simplified - would be computed from league data)
        const rolePercentile = Math.max(0, Math.min(100, 
          50 + (playerEvaluation.impact.impactZWithinRole * 15) // rough approximation
        ));

        return {
          player: {
            id: parseInt(playerEvaluation.bio.firstName + playerEvaluation.bio.lastName) || 0, // Temporary ID mapping
            name: `${playerEvaluation.bio.firstName} ${playerEvaluation.bio.lastName}`,
            teamAbbrev: playerEvaluation.bio.teamAbbrev || null,
            position: playerEvaluation.bio.position,
            role: playerEvaluation.role,
            age
          },
          weaknessType: wp.weaknessType,
          reason: wp.recommendation,
          impactScore: playerEvaluation.impact.impactScore,
          replacementDelta: playerEvaluation.impact.replacementZDelta,
          confidence: playerEvaluation.confidence.confidence,
          keyIssues: playerEvaluation.reasons.slice(0, 3),
          rolePercentile
        };
      })
    );

    // Build replacement suggestions
    const replacementSuggestions: ReplacementSuggestion[] = await Promise.all(
      weakPlayers.map(async (wp) => {
        const playerEvaluation = wp.player;
        
        if (wp.weaknessType === 'misuse') {
          // Reassignment suggestion
          return {
            forPlayerId: parseInt(playerEvaluation.bio.firstName + playerEvaluation.bio.lastName) || 0,
            suggestionType: 'reassign' as const,
            reassignmentNote: playerEvaluation.misuse.notes.join('; ') || 'Adjust role deployment based on skill profile',
            confidence: playerEvaluation.confidence.confidence
          };
        } else {
          // Find replacement candidates
          // Note: This is simplified - would need proper player ID mapping
          return {
            forPlayerId: parseInt(playerEvaluation.bio.firstName + playerEvaluation.bio.lastName) || 0,
            suggestionType: 'replace' as const,
            candidates: [
              {
                id: 0,
                name: 'External candidate search needed',
                teamAbbrev: null,
                position: playerEvaluation.bio.position,
                role: playerEvaluation.role,
                age: null,
                impactScore: 0,
                availability: 'unknown' as const,
                rationale: `Need ${playerEvaluation.role} upgrade for ${playerEvaluation.bio.position} position`
              }
            ],
            confidence: playerEvaluation.confidence.confidence
          };
        }
      })
    );

    // Calculate team insights
    const roleDistribution: Record<Role, number> = {
      scorer: 0, playmaker: 0, twoWayF: 0, defensiveC: 0, grinder: 0,
      offensiveD: 0, shutdownD: 0, goalie: 0
    };
    
    weakPlayers.forEach(wp => {
      roleDistribution[wp.player.role]++;
    });

    const averageAge = weakPlayers
      .map(wp => wp.player.bio.birthYear ? new Date().getFullYear() - wp.player.bio.birthYear : 25)
      .reduce((sum, age) => sum + age, 0) / Math.max(1, weakPlayers.length);

    const teamInsights = {
      strongestRoles: [] as Role[], // Would be computed from full roster analysis
      weakestRoles: Object.entries(roleDistribution)
        .filter(([role, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([role]) => role as Role),
      averageAge,
      roleDistribution
    };

    return {
      teamInfo: {
        abbrev: team.abbr,
        name: team.name,
        playersAnalyzed: weakPlayers.length
      },
      weakPlayers: weakPlayerAnalysis,
      replacementSuggestions,
      teamInsights,
      methodology: {
        algorithm: 'role-aware-impact-evaluation',
        benchmarkSize: 1000, // Approximate
        confidenceThreshold: 0.6,
        replacementThreshold: '25th percentile within role'
      }
    };

  } else {
    // Individual player analysis - simplified for now
    return {
      teamInfo: {
        abbrev: 'MIXED',
        name: 'Individual Players',
        playersAnalyzed: playerIds?.length || 0
      },
      weakPlayers: [],
      replacementSuggestions: [],
      teamInsights: {
        strongestRoles: [],
        weakestRoles: [],
        averageAge: 0,
        roleDistribution: {
          scorer: 0, playmaker: 0, twoWayF: 0, defensiveC: 0, grinder: 0,
          offensiveD: 0, shutdownD: 0, goalie: 0
        }
      },
      methodology: {
        algorithm: 'role-aware-impact-evaluation',
        benchmarkSize: 1000,
        confidenceThreshold: 0.6,
        replacementThreshold: '25th percentile within role'
      }
    };
  }
}

/**
 * Get detailed explanation of the evaluation methodology
 */
export function getMethodologyExplanation(): {
  title: string;
  description: string;
  components: Array<{
    name: string;
    description: string;
    weight: string;
  }>;
  roleDefinitions: Record<Role, string>;
} {
  return {
    title: 'Role-Aware Impact Evaluation',
    description: 'Advanced algorithm that evaluates players relative to their specific role (scorer, defensive center, shutdown defenseman, etc.) rather than position-agnostic metrics. Accounts for deployment context, usage patterns, and role-appropriate expectations.',
    
    components: [
      {
        name: 'Impact Score',
        description: 'Role-weighted combination of offense, defense, transition, and context metrics',
        weight: '65-100%'
      },
      {
        name: 'Misuse Detection', 
        description: 'Identifies players whose deployment mismatches their skill profile',
        weight: 'Qualitative'
      },
      {
        name: 'Confidence Adjustment',
        description: 'Accounts for sample size (ice time) and luck factors (PDO extremes)',
        weight: 'Multiplier'
      },
      {
        name: 'Context Normalization',
        description: 'Adjusts for quality of competition, teammates, and zone starts',
        weight: '±15%'
      }
    ],

    roleDefinitions: {
      scorer: 'Goal-scoring focused forwards (high shooting metrics, power play time)',
      playmaker: 'Assist-focused forwards (passing, hockey IQ, power play deployment)', 
      twoWayF: 'Balanced forwards (defensive responsibility + offensive contribution)',
      defensiveC: 'Defensive-minded centers (faceoffs, penalty kill, defensive metrics)',
      grinder: 'Physical, energy forwards (hits, penalty kill, 4th line deployment)',
      offensiveD: 'Offense-generating defensemen (power play, transition, passing)',
      shutdownD: 'Defense-first defensemen (shot blocking, penalty kill, tough assignments)',
      goalie: 'Goaltenders (save percentage, high-danger saves, consistency)'
    }
  };
}