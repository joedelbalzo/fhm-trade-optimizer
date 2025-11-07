// Special Teams Analysis - Critical for NHL roster construction
import { Op } from 'sequelize';
import { Team, Player, PlayerSeasonStat } from '../models/index.js';
import { currentSeason } from './scoring.js';

interface SpecialTeamsPlayer {
  playerId: number;
  name: string;
  position: string;
  capHit: number;
  // Power Play metrics
  ppGoals?: number;
  ppAssists?: number;
  ppPoints?: number;
  ppTimeOnIce?: number;
  // Penalty Kill metrics
  shGoals?: number;
  shAssists?: number;
  shTimeOnIce?: number;
  // Face-off metrics
  faceoffWinPct?: number;
  faceoffsTaken?: number;
  // Special role indicators
  isPowerPlaySpecialist: boolean;
  isPenaltyKillSpecialist: boolean;
  isFaceoffSpecialist: boolean;
  overallSpecialTeamsValue: number;
}

interface SpecialTeamsAnalysis {
  powerPlay: {
    currentRating: number;
    specialists: SpecialTeamsPlayer[];
    needs: string[];
    recommendations: string[];
  };
  penaltyKill: {
    currentRating: number;
    specialists: SpecialTeamsPlayer[];
    needs: string[];
    recommendations: string[];
  };
  faceoffs: {
    currentRating: number;
    specialists: SpecialTeamsPlayer[];
    needs: string[];
    recommendations: string[];
  };
  overallAssessment: {
    strengths: string[];
    weaknesses: string[];
    priorities: string[];
    tradingAdvice: string[];
  };
}

async function analyzeSpecialTeamsPlayer(player: Player): Promise<SpecialTeamsPlayer | null> {
  const season = await currentSeason();
  const stats = await PlayerSeasonStat.findOne({
    where: { playerId: player.playerId, season }
  });

  if (!stats || !stats.gamesPlayed || stats.gamesPlayed < 10) return null;

  const games = stats.gamesPlayed;
  const capHit = parseFloat(player.capHit?.toString() || '0.925');

  // Calculate per-game averages
  const ppGoals = (stats.ppGoals || 0) / games;
  const ppAssists = (stats.ppAssists || 0) / games;
  const ppPoints = ppGoals + ppAssists;
  const ppTimeOnIce = (stats.ppTimeOnIce || 0) / games / 60; // Convert to minutes per game

  const shGoals = (stats.shGoals || 0) / games;
  const shAssists = (stats.shAssists || 0) / games;
  const shTimeOnIce = (stats.shTimeOnIce || 0) / games / 60;

  const faceoffWinPct = stats.faceoffWinPct || 0;
  const faceoffsTaken = (stats.faceoffsTaken || 0) / games;

  // Determine specializations
  const isPowerPlaySpecialist = ppTimeOnIce > 2.0 || ppPoints > 0.3 || 
    (player.position === 'D' && ppPoints > 0.2);

  const isPenaltyKillSpecialist = shTimeOnIce > 1.5 || 
    (player.position === 'D' && shTimeOnIce > 2.0) ||
    (['C', 'LW', 'RW'].includes(player.position) && shTimeOnIce > 1.0);

  const isFaceoffSpecialist = faceoffWinPct > 52 && faceoffsTaken > 8 && 
    player.position === 'C';

  // Calculate overall special teams value (0-100 scale)
  let specialTeamsValue = 0;
  
  if (isPowerPlaySpecialist) {
    specialTeamsValue += Math.min(40, ppPoints * 80 + ppTimeOnIce * 5);
  }
  
  if (isPenaltyKillSpecialist) {
    specialTeamsValue += Math.min(35, shTimeOnIce * 8 + (shGoals * 20));
  }
  
  if (isFaceoffSpecialist) {
    specialTeamsValue += Math.min(25, (faceoffWinPct - 50) * 2 + faceoffsTaken * 0.5);
  }

  return {
    playerId: player.playerId,
    name: `${player.firstName} ${player.lastName}`,
    position: player.position,
    capHit,
    ppGoals,
    ppAssists,
    ppPoints,
    ppTimeOnIce,
    shGoals,
    shAssists,
    shTimeOnIce,
    faceoffWinPct,
    faceoffsTaken,
    isPowerPlaySpecialist,
    isPenaltyKillSpecialist,
    isFaceoffSpecialist,
    overallSpecialTeamsValue: specialTeamsValue
  };
}

export async function analyzeTeamSpecialTeams(teamAbbrev: string): Promise<SpecialTeamsAnalysis> {
  const team = await Team.findOne({ where: { abbr: teamAbbrev } });
  if (!team) throw new Error('Team not found');

  const players = await Player.findAll({
    where: { 
      teamId: team.teamId,
      retired: false
    },
    include: [{ model: Team, as: 'team' }]
  });

  // Analyze each player's special teams contribution
  const specialTeamsPlayers: SpecialTeamsPlayer[] = [];
  for (const player of players) {
    const analysis = await analyzeSpecialTeamsPlayer(player);
    if (analysis) {
      specialTeamsPlayers.push(analysis);
    }
  }

  // Categorize specialists
  const powerPlaySpecialists = specialTeamsPlayers
    .filter(p => p.isPowerPlaySpecialist)
    .sort((a, b) => (b.ppPoints || 0) - (a.ppPoints || 0));

  const penaltyKillSpecialists = specialTeamsPlayers
    .filter(p => p.isPenaltyKillSpecialist)
    .sort((a, b) => (b.shTimeOnIce || 0) - (a.shTimeOnIce || 0));

  const faceoffSpecialists = specialTeamsPlayers
    .filter(p => p.isFaceoffSpecialist)
    .sort((a, b) => (b.faceoffWinPct || 0) - (a.faceoffWinPct || 0));

  // Analyze team strengths and weaknesses
  const analysis: SpecialTeamsAnalysis = {
    powerPlay: {
      currentRating: Math.min(100, powerPlaySpecialists.reduce((sum, p) => sum + (p.ppPoints || 0), 0) * 20),
      specialists: powerPlaySpecialists,
      needs: [],
      recommendations: []
    },
    penaltyKill: {
      currentRating: Math.min(100, penaltyKillSpecialists.length * 15 + 
        penaltyKillSpecialists.reduce((sum, p) => sum + (p.shTimeOnIce || 0), 0) * 2),
      specialists: penaltyKillSpecialists,
      needs: [],
      recommendations: []
    },
    faceoffs: {
      currentRating: faceoffSpecialists.length > 0 ? 
        faceoffSpecialists.reduce((sum, p) => sum + (p.faceoffWinPct || 0), 0) / faceoffSpecialists.length : 0,
      specialists: faceoffSpecialists,
      needs: [],
      recommendations: []
    },
    overallAssessment: {
      strengths: [],
      weaknesses: [],
      priorities: [],
      tradingAdvice: []
    }
  };

  // Generate specific recommendations

  // Power Play Analysis
  if (powerPlaySpecialists.length < 6) {
    analysis.powerPlay.needs.push('Need more power play contributors');
    analysis.powerPlay.recommendations.push('Target players with PP experience and offensive upside');
  }

  const ppDefensemen = powerPlaySpecialists.filter(p => p.position === 'D');
  if (ppDefensemen.length < 2) {
    analysis.powerPlay.needs.push('Need power play quarterback defenseman');
    analysis.powerPlay.recommendations.push('Target offensive defenseman who can run PP1 or PP2');
  }

  const ppForwards = powerPlaySpecialists.filter(p => ['C', 'LW', 'RW', 'F'].includes(p.position));
  if (ppForwards.length < 4) {
    analysis.powerPlay.needs.push('Need more power play forwards');
    analysis.powerPlay.recommendations.push('Look for net-front presence and one-timer specialists');
  }

  // Penalty Kill Analysis  
  if (penaltyKillSpecialists.length < 6) {
    analysis.penaltyKill.needs.push('Need more penalty kill specialists');
    analysis.penaltyKill.recommendations.push('Target defensive forwards and shutdown defensemen');
  }

  const pkForwards = penaltyKillSpecialists.filter(p => ['C', 'LW', 'RW', 'F'].includes(p.position));
  if (pkForwards.length < 4) {
    analysis.penaltyKill.needs.push('Need more penalty killing forwards');
    analysis.penaltyKill.recommendations.push('Focus on defensively responsible forwards with speed');
  }

  // Face-off Analysis
  if (faceoffSpecialists.length < 2) {
    analysis.faceoffs.needs.push('Need reliable face-off centers');
    analysis.faceoffs.recommendations.push('Target centers with 53%+ face-off win percentage');
  }

  const topFaceoffPct = faceoffSpecialists.length > 0 ? faceoffSpecialists[0].faceoffWinPct || 0 : 0;
  if (topFaceoffPct < 55) {
    analysis.faceoffs.needs.push('Need elite face-off specialist for key situations');
    analysis.faceoffs.recommendations.push('Consider trading for proven face-off winner for defensive zone draws');
  }

  // Overall Assessment
  if (analysis.powerPlay.currentRating > 75) {
    analysis.overallAssessment.strengths.push(`Strong power play unit (${analysis.powerPlay.currentRating.toFixed(0)}/100)`);
  } else if (analysis.powerPlay.currentRating < 50) {
    analysis.overallAssessment.weaknesses.push(`Struggling power play needs help (${analysis.powerPlay.currentRating.toFixed(0)}/100)`);
    analysis.overallAssessment.priorities.push('Power play upgrade');
    analysis.overallAssessment.tradingAdvice.push('Target proven power play producers even at premium cost');
  }

  if (analysis.penaltyKill.currentRating > 75) {
    analysis.overallAssessment.strengths.push(`Reliable penalty kill (${analysis.penaltyKill.currentRating.toFixed(0)}/100)`);
  } else if (analysis.penaltyKill.currentRating < 50) {
    analysis.overallAssessment.weaknesses.push(`Poor penalty kill needs attention (${analysis.penaltyKill.currentRating.toFixed(0)}/100)`);
    analysis.overallAssessment.priorities.push('Penalty kill improvement');
    analysis.overallAssessment.tradingAdvice.push('Focus on defensive specialists over pure scorers');
  }

  if (analysis.faceoffs.currentRating > 55) {
    analysis.overallAssessment.strengths.push(`Good face-off coverage (${analysis.faceoffs.currentRating.toFixed(1)}% win rate)`);
  } else if (analysis.faceoffs.currentRating < 50) {
    analysis.overallAssessment.weaknesses.push(`Poor face-off performance (${analysis.faceoffs.currentRating.toFixed(1)}% win rate)`);
    analysis.overallAssessment.priorities.push('Face-off specialist needed');
    analysis.overallAssessment.tradingAdvice.push('Centers with 55%+ face-off rate should be prioritized');
  }

  // High-value players for trading
  const eliteSpecialTeamsPlayers = specialTeamsPlayers.filter(p => p.overallSpecialTeamsValue > 60);
  if (eliteSpecialTeamsPlayers.length > 0) {
    analysis.overallAssessment.strengths.push(`Elite special teams players: ${eliteSpecialTeamsPlayers.map(p => p.name).join(', ')}`);
    analysis.overallAssessment.tradingAdvice.push('Elite special teams players have high trade value - could be key pieces in major deals');
  }

  return analysis;
}