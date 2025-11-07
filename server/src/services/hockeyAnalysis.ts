// server/src/services/hockeyAnalysis.ts
// COMPLETE REWRITE with actual hockey intelligence

import { Op } from 'sequelize';
import { Team, Player, PlayerSeasonStat, PlayerRating } from '../models/index.js';
import { currentSeason, calculatePlayerAgeSync } from './scoring.js';

// Contract efficiency calculation for trade prioritization
function calculateContractEfficiency(player: Player, metrics: any): number {
  if (!metrics) return 0;
  
  const capHit = parseFloat(player.capHit?.toString() || '0.925');
  const performance = metrics.pointsPerGame * 100 + Math.max(0, metrics.plusMinus * 2);
  
  // Performance per million spent - higher is better value
  return performance / Math.max(capHit, 0.1);
}

// Calculate what a player should be paid based on performance
function calculateExpectedSalary(position: string, metrics: any): number {
  const { pointsPerGame, timeOnIce, hits, shotBlocks, plusMinus, takeaways } = metrics;
  
  if (position === 'D') {
    const offensiveValue = Math.max(0, pointsPerGame * 6000000);
    const defensiveValue = Math.max(0, (shotBlocks * 50000) + (hits * 30000) + (takeaways * 80000));
    const iceTimeValue = Math.max(0, (timeOnIce - 15) * 200000);
    const plusMinusAdjustment = Math.max(-1000000, Math.min(1000000, plusMinus * 50000));
    
    return Math.max(0.925, Math.min(11.0, (offensiveValue + defensiveValue + iceTimeValue + plusMinusAdjustment) / 1000000));
  } else {
    const offensiveValue = Math.max(0, pointsPerGame * 8000000);
    const defensiveValue = Math.max(0, (hits * 25000) + (takeaways * 60000));
    const iceTimeValue = Math.max(0, (timeOnIce - 12) * 150000);
    const plusMinusAdjustment = Math.max(-500000, Math.min(500000, plusMinus * 30000));
    
    return Math.max(0.925, Math.min(13.0, (offensiveValue + defensiveValue + iceTimeValue + plusMinusAdjustment) / 1000000));
  }
}

interface HockeyWeakness {
  type: 'goalie_poor' | 'defense_offensive' | 'defense_defensive' | 'forward_offensive' | 'forward_defensive' | 'forward_physical' | 'overall_ineffective';
  severity: number; // 1-5
  description: string;
  context: string; // Hockey-specific context
  detailedAnalysis: string; // GM-level detailed reasoning
  impactOnTeam: string; // How this weakness affects the team
  urgency: 'immediate' | 'high' | 'medium' | 'low'; // Trade deadline urgency
}

interface PlayerAnalysis {
  player: Player;
  position: string;
  role: string; // e.g., "Starting Goalie", "Shutdown Defenseman", "Power Forward"
  performanceMetrics: any;
  weakness?: HockeyWeakness;
  isWeakLink: boolean;
  replacementStrategy: 'replace' | 'reassign' | 'develop' | 'adequate';
  reasoning: string;
}


// Generate detailed GM-level weakness analysis
function generateDetailedWeaknessAnalysis(player: Player, metrics: any, weakness: HockeyWeakness): HockeyWeakness {
  const { timeOnIce, pointsPerGame, plusMinus, gamesPlayed } = metrics || {};
  const playerName = `${player.firstName} ${player.lastName}`;
  
  if (weakness.type === 'forward_offensive') {
    const expectedPPG = timeOnIce > 19 ? 0.5 : timeOnIce > 15 ? 0.35 : 0.25;
    const deficit = expectedPPG - (pointsPerGame || 0);
    const extrapolatedSeasonPts = (pointsPerGame || 0) * 82;
    const expectedSeasonPts = expectedPPG * 82;
    
    weakness.detailedAnalysis = `${playerName} is significantly underperforming in a top-6 role with ${(pointsPerGame || 0).toFixed(2)} PPG (${extrapolatedSeasonPts.toFixed(0)} pace over 82 games). For a player averaging ${timeOnIce?.toFixed(1)} minutes per game, we need at least ${expectedPPG.toFixed(2)} PPG (${expectedSeasonPts.toFixed(0)} points over 82 games). This represents a ${(deficit * 82).toFixed(0)}-point gap that's costing the team offensive production in key situations.`;
    
    weakness.impactOnTeam = `With ${timeOnIce?.toFixed(1)} minutes per game, this player is consuming premium ice time that could generate ${(deficit * (gamesPlayed || 70)).toFixed(0)} more points with a proper top-6 forward. This affects power play opportunities, offensive zone starts, and overall team scoring depth.`;
    
    weakness.urgency = weakness.severity >= 5 ? 'immediate' : weakness.severity >= 4 ? 'high' : 'medium';
  }
  
  return weakness;
}

// Classify a player's role based on metrics (simplified version for replacement logic)
function classifyPlayerRole(player: Player, metrics: any): string {
  if (!metrics) return 'Unknown Role';
  
  const { timeOnIce, pointsPerGame, hits, takeaways, shotBlocks } = metrics;
  const salary = parseFloat(player.capHit?.toString() || '0');
  
  // Determine player type FIRST based on stats
  let playerType = 'Depth Forward';
  if (pointsPerGame > 0.7) playerType = 'Scorer';
  else if (pointsPerGame > 0.5) playerType = 'Playmaker';  
  else if (hits > 2.0 && pointsPerGame < 0.4) playerType = 'Energy Player';
  else if (takeaways > 1.0) playerType = 'Two-Way Forward';
  else if (shotBlocks > 1.0 && hits > 1.5) playerType = 'Defensive Forward';

  // Classify line role based on performance metrics initially
  let lineRole = 'Fourth Line';
  
  if ((playerType === 'Scorer' || playerType === 'Playmaker') && timeOnIce > 18) {
    lineRole = 'Top-6';
  } 
  else if (playerType === 'Two-Way Forward' && timeOnIce > 16) {
    lineRole = 'Middle-6';
  }
  else if (playerType === 'Energy Player' || playerType === 'Defensive Forward') {
    lineRole = 'Bottom-6';
  }
  else if (timeOnIce > 19) lineRole = 'Top-6';
  else if (timeOnIce > 15) lineRole = 'Middle-6';
  else if (timeOnIce > 8) lineRole = 'Bottom-6';

  // OVERRIDE with salary expectations - high-paid players can't be fourth liners
  if (salary > 7.0) {
    lineRole = 'Top-6';
  } else if (salary > 4.5) {
    lineRole = 'Middle-6';
  } else if (salary > 2.5) {
    lineRole = 'Bottom-6';
  }

  return `${lineRole} ${playerType}`;
}

// Check if a replacement role is appropriate for the target role
function isRoleAppropriate(targetRole: string, candidateRole: string): boolean {
  // Extract role components
  const targetLine = targetRole.includes('Top-6') ? 'Top-6' : 
                    targetRole.includes('Middle-6') ? 'Middle-6' : 
                    targetRole.includes('Bottom-6') ? 'Bottom-6' : 'Fourth Line';
                    
  const candidateLine = candidateRole.includes('Top-6') ? 'Top-6' : 
                       candidateRole.includes('Middle-6') ? 'Middle-6' : 
                       candidateRole.includes('Bottom-6') ? 'Bottom-6' : 'Fourth Line';
  
  const targetType = targetRole.includes('Energy') ? 'Energy' :
                    targetRole.includes('Scorer') ? 'Scorer' :
                    targetRole.includes('Playmaker') ? 'Playmaker' :
                    targetRole.includes('Power Forward') ? 'Power Forward' :
                    targetRole.includes('Defensive') ? 'Defensive' :
                    targetRole.includes('Two-Way') ? 'Two-Way' : 'Depth';
                    
  const candidateType = candidateRole.includes('Energy') ? 'Energy' :
                       candidateRole.includes('Scorer') ? 'Scorer' :
                       candidateRole.includes('Playmaker') ? 'Playmaker' :
                       candidateRole.includes('Power Forward') ? 'Power Forward' :
                       candidateRole.includes('Defensive') ? 'Defensive' :
                       candidateRole.includes('Two-Way') ? 'Two-Way' : 'Depth';

  // For top-6 roles, only accept top-6 or similar offensive players
  if (targetLine === 'Top-6') {
    return candidateLine === 'Top-6' || candidateType === 'Scorer' || candidateType === 'Playmaker';
  }
  
  // For energy/defensive roles, only accept similar role players
  if (targetType === 'Energy' || targetType === 'Defensive') {
    return candidateType === 'Energy' || candidateType === 'Defensive' || candidateType === 'Power Forward';
  }
  
  // For middle-6, accept middle-6 or similar
  if (targetLine === 'Middle-6') {
    return candidateLine === 'Middle-6' || candidateLine === 'Top-6' || candidateType === 'Two-Way';
  }
  
  // For bottom-6, accept same line or better
  if (targetLine === 'Bottom-6') {
    return candidateLine === 'Bottom-6' || candidateLine === 'Middle-6' || candidateType === 'Energy' || candidateType === 'Defensive';
  }
  
  return true; // Default to allowing the trade
}

// Generate comprehensive replacement analysis with advanced hockey metrics
async function generateReplacementAnalysis(currentPlayer: Player, replacement: Player, weakness: HockeyWeakness): Promise<string> {
  const currentMetrics = await getPositionMetrics(currentPlayer);
  const replacementMetrics = await getPositionMetrics(replacement);

  if (!currentMetrics || !replacementMetrics) {
    return `${replacement.firstName} ${replacement.lastName} would provide an upgrade at the ${replacement.position} position.`;
  }

  // Calculate comprehensive performance metrics
  const currentPPG = currentMetrics.pointsPerGame || 0;
  const replacementPPG = replacementMetrics.pointsPerGame || 0;
  const ppgImprovement = replacementPPG - currentPPG;
  const seasonImpact = ppgImprovement * 82;

  const currentPlusMinus = currentMetrics.plusMinus || 0;
  const replacementPlusMinus = replacementMetrics.plusMinus || 0;
  const plusMinusImprovement = replacementPlusMinus - currentPlusMinus;

  const season = await currentSeason();
  const currentAge = calculatePlayerAgeSync(currentPlayer.dateOfBirth, season) ?? 30;
  const replacementAge = calculatePlayerAgeSync(replacement.dateOfBirth, season) ?? 30;
  
  // Safe conversion to numbers for salary calculations
  const currentSalary = parseFloat(currentPlayer.capHit) || 0.925;
  const replacementSalary = parseFloat(replacement.capHit) || 0.925;
  const salaryDiff = replacementSalary - currentSalary;
  const salaryEfficiency = seasonImpact > 0 && Math.abs(salaryDiff) > 0 ? 
    (seasonImpact / Math.abs(salaryDiff)) : 0;
  
  // Generate detailed positional analysis
  let analysis = `**TRADE TARGET ANALYSIS**\n\n`;
  analysis += `**${currentPlayer.firstName} ${currentPlayer.lastName}** (Age ${currentAge}) → **${replacement.firstName} ${replacement.lastName}** (Age ${replacementAge})\n\n`;
  
  // Offensive impact analysis
  if (Math.abs(ppgImprovement) > 0.1) {
    analysis += `**OFFENSIVE IMPACT**\n`;
    analysis += `Current Production: ${currentPPG.toFixed(2)} PPG (${(currentPPG * 82).toFixed(0)}-point pace)\n`;
    analysis += `Replacement Production: ${replacementPPG.toFixed(2)} PPG (${(replacementPPG * 82).toFixed(0)}-point pace)\n`;
    analysis += `Net Impact: ${ppgImprovement > 0 ? '+' : ''}${ppgImprovement.toFixed(2)} PPG (${seasonImpact > 0 ? '+' : ''}${seasonImpact.toFixed(0)} points over 82 games)\n\n`;
  }
  
  // Defensive/Two-way analysis using advanced metrics
  const currentCorsi = currentMetrics.corsiForPercentage || 0;
  const replacementCorsi = replacementMetrics.corsiForPercentage || 0;
  const currentFenwick = currentMetrics.fenwickForPercentage || 0;
  const replacementFenwick = replacementMetrics.fenwickForPercentage || 0;

  if (currentCorsi > 0 && replacementCorsi > 0 && Math.abs(replacementCorsi - currentCorsi) > 1.0) {
    analysis += `**DEFENSIVE IMPACT**\n`;
    analysis += `Current Corsi For %: ${currentCorsi.toFixed(1)}%\n`;
    analysis += `Replacement Corsi For %: ${replacementCorsi.toFixed(1)}%\n`;
    analysis += `Current Fenwick For %: ${currentFenwick.toFixed(1)}%\n`;
    analysis += `Replacement Fenwick For %: ${replacementFenwick.toFixed(1)}%\n`;
    const corsiDiff = replacementCorsi - currentCorsi;
    analysis += `Net Impact: ${corsiDiff > 0 ? '+' : ''}${corsiDiff.toFixed(1)}% Corsi (${corsiDiff > 0 ? 'Better' : 'Worse'} puck possession)\n\n`;
  }
  
  // Position-specific analysis
  if (replacement.position === 'G') {
    const currentSavePct = currentMetrics.savePct || 0;
    const replacementSavePct = replacementMetrics.savePct || 0;
    if (Math.abs(replacementSavePct - currentSavePct) > 0.01) {
      analysis += `**GOALTENDING IMPACT**\n`;
      analysis += `Current Save%: ${(currentSavePct * 100).toFixed(1)}%\n`;
      analysis += `Replacement Save%: ${(replacementSavePct * 100).toFixed(1)}%\n`;
      analysis += `Net Impact: ${((replacementSavePct - currentSavePct) * 100).toFixed(1)}% improvement\n\n`;
    }
  } else if (['D', 'LD', 'RD'].includes(replacement.position)) {
    const currentShotBlocks = currentMetrics.shotBlocks || 0;
    const replacementShotBlocks = replacementMetrics.shotBlocks || 0;
    const currentHits = currentMetrics.hits || 0;
    const replacementHits = replacementMetrics.hits || 0;
    
    analysis += `**DEFENSIVE METRICS**\n`;
    analysis += `Shot Blocks/Game: ${currentShotBlocks.toFixed(1)} → ${replacementShotBlocks.toFixed(1)} (${(replacementShotBlocks - currentShotBlocks).toFixed(1)})\n`;
    analysis += `Hits/Game: ${currentHits.toFixed(1)} → ${replacementHits.toFixed(1)} (${(replacementHits - currentHits).toFixed(1)})\n`;
    analysis += `Takeaways/Game: ${(currentMetrics.takeaways || 0).toFixed(1)} → ${(replacementMetrics.takeaways || 0).toFixed(1)} (${((replacementMetrics.takeaways || 0) - (currentMetrics.takeaways || 0)).toFixed(1)})\n\n`;
  } else {
    // Forward-specific metrics
    const currentGoals = currentMetrics.goals || 0;
    const replacementGoals = replacementMetrics.goals || 0;
    const currentAssists = currentMetrics.assists || 0;
    const replacementAssists = replacementMetrics.assists || 0;
    
    if (weakness.type === 'forward_offensive') {
      analysis += `**FORWARD PRODUCTION BREAKDOWN**\n`;
      analysis += `Goals: ${currentGoals} → ${replacementGoals} (${replacementGoals - currentGoals})\n`;
      analysis += `Assists: ${currentAssists} → ${replacementAssists} (${replacementAssists - currentAssists})\n`;
      
      const currentHits = currentMetrics.hits || 0;
      const replacementHits = replacementMetrics.hits || 0;
      if (Math.abs(replacementHits - currentHits) > 0.5) {
        analysis += `Physical Play: ${currentHits.toFixed(1)} → ${replacementHits.toFixed(1)} hits/game (${(replacementHits - currentHits).toFixed(1)})\n`;
      }
      analysis += `\n`;
    }
  }
  
  // Contract and value analysis
  analysis += `**CONTRACT ANALYSIS**\n`;
  analysis += `Current Salary: $${currentSalary.toFixed(2)}M\n`;
  analysis += `Replacement Salary: $${replacementSalary.toFixed(2)}M\n`;
  
  if (salaryDiff > 0) {
    analysis += `Salary Increase: $${salaryDiff.toFixed(2)}M per year\n`;
    if (salaryEfficiency > 0) {
      analysis += `Value: ${salaryEfficiency.toFixed(1)} additional points per million invested\n`;
    }
  } else if (salaryDiff < 0) {
    analysis += `Salary Savings: $${Math.abs(salaryDiff).toFixed(2)}M per year\n`;
    analysis += `Value: Upgrade performance while reducing costs\n`;
  } else {
    analysis += `Salary Impact: Equivalent cap hit\n`;
  }
  analysis += `\n`;
  
  // Age and development analysis
  analysis += `**AGE & DEVELOPMENT**\n`;
  analysis += `Current Player: ${currentAge} years old\n`;
  analysis += `Replacement: ${replacementAge} years old\n`;
  
  if (replacementAge < currentAge - 2) {
    analysis += `Advantage: Younger player with more upside and longer prime\n`;
  } else if (replacementAge > currentAge + 2) {
    analysis += `Consideration: Older player but brings veteran experience\n`;
  } else {
    analysis += `Age Factor: Similar age profile and career stage\n`;
  }
  analysis += `\n`;
  
  // Strategic fit analysis
  analysis += `**STRATEGIC FIT**\n`;
  if (weakness.severity >= 4) {
    analysis += `Urgency: HIGH - Addresses critical team weakness\n`;
  } else if (weakness.severity >= 3) {
    analysis += `Urgency: MEDIUM - Provides meaningful upgrade\n`;
  } else {
    analysis += `Urgency: LOW - Depth improvement\n`;
  }
  
  if (seasonImpact > 10) {
    analysis += `Impact: SIGNIFICANT - ${seasonImpact.toFixed(0)}+ point improvement over full season\n`;
  } else if (seasonImpact > 5) {
    analysis += `Impact: MODERATE - ${seasonImpact.toFixed(0)}+ point improvement\n`;
  } else if (seasonImpact > 0) {
    analysis += `Impact: MINOR - ${seasonImpact.toFixed(0)}+ point improvement\n`;
  } else if (seasonImpact < -5) {
    analysis += `Risk: Production may decline by ${Math.abs(seasonImpact).toFixed(0)} points\n`;
  }
  
  // Trade feasibility
  const currentTier = getPlayerTierNumeric(currentPPG * 100 + Math.max(0, currentPlusMinus), currentAge);
  const replacementTier = getPlayerTierNumeric(replacementPPG * 100 + Math.max(0, replacementPlusMinus), replacementAge);
  
  analysis += `Trade Feasibility: `;
  if (replacementTier === currentTier) {
    analysis += `REALISTIC - Similar value players\n`;
  } else if (replacementTier === currentTier - 1) {
    analysis += `POSSIBLE - Slight upgrade, may need additional assets\n`;
  } else if (replacementTier < currentTier - 1) {
    analysis += `CHALLENGING - Significant upgrade, requires substantial assets\n`;
  } else {
    analysis += `EASY - Downgrade or salary dump scenario\n`;
  }
  
  // CONTRACT EFFICIENCY ANALYSIS - This is what the user specifically wants!
  analysis += `\n**SALARY & CONTRACT EFFICIENCY**\n`;
  analysis += `Current Cap Hit: $${currentSalary.toFixed(2)}M\n`;
  analysis += `Replacement Cap Hit: $${replacementSalary.toFixed(2)}M\n`;
  analysis += `Salary Difference: ${salaryDiff > 0 ? '+' : ''}$${salaryDiff.toFixed(2)}M\n`;
  
  // Calculate expected salaries based on performance
  const currentExpected = calculateExpectedSalary(currentPlayer.position, currentMetrics);
  const replacementExpected = calculateExpectedSalary(replacement.position, replacementMetrics);
  
  analysis += `\n**VALUE ANALYSIS**\n`;
  analysis += `Current Player Value: $${currentSalary.toFixed(2)}M actual vs $${currentExpected.toFixed(2)}M expected (`;
  if (currentSalary > currentExpected * 1.2) {
    analysis += `OVERPAID by $${(currentSalary - currentExpected).toFixed(2)}M)\n`;
  } else if (currentSalary < currentExpected * 0.8) {
    analysis += `BARGAIN - saving $${(currentExpected - currentSalary).toFixed(2)}M)\n`;
  } else {
    analysis += `FAIR VALUE)\n`;
  }
  
  analysis += `Replacement Value: $${replacementSalary.toFixed(2)}M actual vs $${replacementExpected.toFixed(2)}M expected (`;
  if (replacementSalary > replacementExpected * 1.2) {
    analysis += `OVERPAID by $${(replacementSalary - replacementExpected).toFixed(2)}M)\n`;
  } else if (replacementSalary < replacementExpected * 0.8) {
    analysis += `BARGAIN - saving $${(replacementExpected - replacementSalary).toFixed(2)}M)\n`;
  } else {
    analysis += `FAIR VALUE)\n`;
  }
  
  // Calculate contract efficiency scores
  const currentEfficiency = calculateContractEfficiency(currentPlayer, currentMetrics);
  const replacementEfficiency = calculateContractEfficiency(replacement, replacementMetrics);
  const efficiencyGain = replacementEfficiency - currentEfficiency;
  
  analysis += `\n**EFFICIENCY METRICS**\n`;
  analysis += `Current Efficiency: ${currentEfficiency.toFixed(1)} points per $1M\n`;
  analysis += `Replacement Efficiency: ${replacementEfficiency.toFixed(1)} points per $1M\n`;
  analysis += `Net Efficiency Gain: ${efficiencyGain > 0 ? '+' : ''}${efficiencyGain.toFixed(1)} points per $1M`;
  
  if (efficiencyGain > 0.5) {
    analysis += ` (EXCELLENT efficiency upgrade)\n`;
  } else if (efficiencyGain > 0.2) {
    analysis += ` (Good efficiency improvement)\n`;
  } else if (efficiencyGain > -0.2) {
    analysis += ` (Similar efficiency)\n`;
  } else {
    analysis += ` (Efficiency downgrade)\n`;
  }
  
  // Strategic recommendation
  analysis += `\n**TRADE RECOMMENDATION**\n`;
  if (Math.abs(salaryDiff) < 0.5 && ppgImprovement > 0.1) {
    analysis += `PRIORITY TRADE - Better player at same salary! This is exactly the type of move that improves your team without cap impact.\n`;
  } else if (ppgImprovement >= -0.05 && salaryDiff < -1.5) {
    analysis += `CAP EFFICIENCY PLAY - Similar performance at significant salary savings ($${Math.abs(salaryDiff).toFixed(2)}M saved for other needs).\n`;
  } else if (efficiencyGain > 0.4) {
    analysis += `VALUE PLAY - Major contract efficiency upgrade worth pursuing.\n`;
  } else if (ppgImprovement > 0.2 && salaryDiff < 2.0) {
    analysis += `PERFORMANCE UPGRADE - Clear improvement worth the additional cost.\n`;
  } else {
    analysis += `PROCEED CAUTIOUSLY - Limited efficiency or performance gain for the cost.\n`;
  }
  
  return analysis;
}

// Determine player tier numerically for realistic trade matching
function getPlayerTierNumeric(score: number, age: number): number {
  // Adjust score based on age - younger players get bonus
  let adjustedScore = score;
  if (age <= 25) adjustedScore *= 1.2; // Young player bonus
  else if (age >= 32) adjustedScore *= 0.8; // Aging player penalty

  if (adjustedScore >= 80) return 1; // Elite/Star players
  if (adjustedScore >= 60) return 2; // Top-6/Top-4 players
  if (adjustedScore >= 40) return 3; // Middle-6/Middle pair
  if (adjustedScore >= 20) return 4; // Bottom-6/Third pair
  return 5; // Depth/AHL players
}

// Get position-specific performance metrics
export async function getPositionMetrics(player: Player): Promise<any> {
  if (!player || !player.playerId) {
    console.error('getPositionMetrics called with invalid player:', { 
      player: player ? `${player.firstName} ${player.lastName}` : 'null',
      playerId: player?.playerId,
      hasPlayer: !!player 
    });
    return null;
  }
  
  const season = await currentSeason();
  const recentStats = await PlayerSeasonStat.findAll({ 
    where: { playerId: player.playerId },
    order: [['season', 'DESC']],
    limit: 3
  });

  if (!recentStats.length) return null;

  // Calculate recent performance
  const totalGames = recentStats.reduce((sum, stat) => sum + (stat.gamesPlayed || 0), 0);
  if (totalGames === 0) return null;

  const avgStats = {
    gamesPlayed: totalGames / recentStats.length,
    goals: recentStats.reduce((sum, stat) => sum + (stat.goals || 0), 0),
    assists: recentStats.reduce((sum, stat) => sum + (stat.assists || 0), 0),
    points: 0,
    plusMinus: recentStats.reduce((sum, stat) => sum + (stat.plusMinus || 0), 0),
    timeOnIce: recentStats.reduce((sum, stat) => sum + (((stat.timeOnIce || 0) / 60) / Math.max(stat.gamesPlayed || 1, 1)), 0) / recentStats.length,
    hits: recentStats.reduce((sum, stat) => sum + ((stat.hits || 0) / Math.max(stat.gamesPlayed || 1, 1)), 0) / recentStats.length,
    shotBlocks: recentStats.reduce((sum, stat) => sum + ((stat.shotBlocks || 0) / Math.max(stat.gamesPlayed || 1, 1)), 0) / recentStats.length,
    takeaways: recentStats.reduce((sum, stat) => sum + ((stat.takeaways || 0) / Math.max(stat.gamesPlayed || 1, 1)), 0) / recentStats.length,
    giveaways: recentStats.reduce((sum, stat) => sum + ((stat.giveaways || 0) / Math.max(stat.giveaways || 1, 1)), 0) / recentStats.length,
    wins: recentStats.reduce((sum, stat) => sum + (stat.wins || 0), 0), // Goalie stat
    losses: recentStats.reduce((sum, stat) => sum + (stat.losses || 0), 0), // Goalie stat
    saves: recentStats.reduce((sum, stat) => sum + (stat.saves || 0), 0), // Goalie stat
    goalsAgainst: recentStats.reduce((sum, stat) => sum + (stat.goalsAgainst || 0), 0), // Goalie stat
    // Advanced metrics
    corsiForPercentage: recentStats.reduce((sum, stat) => sum + (stat.corsiForPercentage || 0), 0) / recentStats.length,
    corsiForPercentageRelative: recentStats.reduce((sum, stat) => sum + (stat.corsiForPercentageRelative || 0), 0) / recentStats.length,
    fenwickForPercentage: recentStats.reduce((sum, stat) => sum + (stat.fenwickForPercentage || 0), 0) / recentStats.length,
    fenwickForPercentageRelative: recentStats.reduce((sum, stat) => sum + (stat.fenwickForPercentageRelative || 0), 0) / recentStats.length,
    gameRatingOff: recentStats.reduce((sum, stat) => sum + (stat.gameRatingOff || 0), 0) / recentStats.length,
    gameRatingDef: recentStats.reduce((sum, stat) => sum + (stat.gameRatingDef || 0), 0) / recentStats.length,
  };

  avgStats.points = avgStats.goals + avgStats.assists;

  return {
    ...avgStats,
    pointsPerGame: totalGames > 0 ? avgStats.points / totalGames : 0,
    savePct: avgStats.saves > 0 ? avgStats.saves / (avgStats.saves + avgStats.goalsAgainst) : 0,
    winPct: (avgStats.wins + avgStats.losses) > 0 ? avgStats.wins / (avgStats.wins + avgStats.losses) : 0
  };
}

// Analyze goalie performance
function analyzeGoalie(player: Player, metrics: any): PlayerAnalysis {
  const { savePct, winPct, gamesPlayed, goalsAgainst } = metrics || {};
  const gamesPerSeason = gamesPlayed || 0;

  // Determine role based on games played
  let role = 'Third-String Goalie';
  if (gamesPerSeason > 45) role = 'Starting Goalie';
  else if (gamesPerSeason > 25) role = 'Backup Goalie';
  else if (gamesPerSeason > 10) role = 'Tandem/Backup Goalie';

  // If no data, assume they're depth/developing - NOT a weakness
  if (!metrics || gamesPerSeason < 10) {
    return {
      player,
      position: 'Goalie',
      role,
      performanceMetrics: metrics,
      isWeakLink: false, // Lack of data is NOT a weakness
      replacementStrategy: 'adequate',
      reasoning: 'Depth goalie or developing - insufficient sample size to evaluate'
    };
  }

  // Only flag goalies as weak if they have significant data AND are performing poorly
  let weakness: HockeyWeakness | undefined;
  let isWeakLink = false;
  let replacementStrategy: 'replace' | 'reassign' | 'develop' | 'adequate' = 'adequate';
  let reasoning = `Adequate ${role.toLowerCase()} performance`;

  if (role === 'Starting Goalie' && gamesPerSeason > 40) {
    if (savePct < 0.900 && winPct < 0.40) {
      weakness = {
        type: 'goalie_poor',
        severity: 5,
        description: `Poor starting goalie performance: ${(savePct * 100).toFixed(1)}% save%, ${(winPct * 100).toFixed(1)}% win%`,
        context: 'Starting goalies need .905+ save% to be competitive'
      };
      isWeakLink = true;
      replacementStrategy = 'replace';
      reasoning = 'Starting goalie significantly below NHL standards';
    }
  } else if (role === 'Backup Goalie' && gamesPerSeason > 20) {
    if (savePct < 0.890) {
      weakness = {
        type: 'goalie_poor',
        severity: 4,
        description: `Unreliable backup: ${(savePct * 100).toFixed(1)}% save%`,
        context: 'Backup goalies must provide stability when called upon'
      };
      isWeakLink = true;
      replacementStrategy = 'replace';
      reasoning = 'Backup goalie not providing reliable depth';
    }
  }

  return {
    player,
    position: 'Goalie',
    role,
    performanceMetrics: metrics,
    weakness,
    isWeakLink,
    replacementStrategy,
    reasoning
  };
}

// Advanced defenseman performance evaluation using multiple hockey metrics
function analyzeDefenseman(player: Player, metrics: any): PlayerAnalysis {
  if (!metrics) {
    return {
      player,
      position: 'Defenseman',
      role: 'Unknown Role',
      performanceMetrics: null,
      isWeakLink: true,
      replacementStrategy: 'develop',
      reasoning: 'Insufficient data to evaluate defensive performance'
    };
  }

  const { timeOnIce, pointsPerGame, plusMinus, shotBlocks, hits, takeaways, giveaways } = metrics;

  // Calculate advanced defensive metrics
  const shotsBlocked = shotBlocks || 0;
  const physicality = hits || 0;
  const puckRecoveries = takeaways || 0;
  const turnovers = giveaways || 0;
  const turnoverRatio = puckRecoveries > 0 ? turnovers / puckRecoveries : turnovers;
  
  // Defensive responsibility score (shot blocks + hits + takeaways - giveaways)
  const defensiveImpact = shotsBlocked * 2 + physicality * 1.5 + puckRecoveries * 3 - turnovers;
  const defensiveImpactPerGame = defensiveImpact > 0 ? defensiveImpact / Math.max(metrics.gamesPlayed || 1, 1) : 0;
  
  // Determine role based on ice time, deployment, AND salary expectations
  let role = 'Third-Pair Defenseman';
  const salary = parseFloat(player.capHit) || 0.925;
  
  // High-salary defensemen must be treated as top-pair regardless of current performance
  if (salary > 7.0) {
    role = 'Top-Pair Defenseman';
  } else if (salary > 5.0) {
    role = 'Second-Pair Defenseman';
  } else if (salary > 3.0) {
    role = 'Third-Pair Defenseman';
  } else {
    // For lower-salary players, use ice time-based classification
    if (timeOnIce > 23) role = 'Top-Pair Defenseman';
    else if (timeOnIce > 19) role = 'Second-Pair Defenseman';
    else role = 'Third-Pair Defenseman';
  }

  // Advanced classification system based on actual play style
  let defenseType = 'Two-Way';
  
  // Offensive defenseman: High points, lower defensive metrics
  if (pointsPerGame > 0.4 && defensiveImpactPerGame < 3.0) {
    defenseType = 'Offensive';
  }
  // Shutdown defenseman: High defensive metrics, power play usage
  else if (defensiveImpactPerGame > 4.5 && shotsBlocked > 1.0) {
    defenseType = 'Shutdown';
  }
  // Stay-at-home: Moderate defensive metrics, penalty kill focus
  else if (physicality > 2.0 && shotsBlocked > 1.2 && pointsPerGame < 0.3) {
    defenseType = 'Stay-at-Home';
  }

  const fullRole = `${defenseType} ${role}`;

  // Advanced evaluation based on role expectations
  let weakness: HockeyWeakness | undefined;
  let isWeakLink = false;
  let replacementStrategy: 'replace' | 'reassign' | 'develop' | 'adequate' = 'adequate';
  let reasoning = `Adequate ${defenseType.toLowerCase()} defenseman for ${role.toLowerCase()} role`;

  if (role === 'Top-Pair Defenseman') {
    // Top-pair defensemen must excel in their specialty AND not be terrible defensively
    if (defenseType === 'Offensive') {
      if (pointsPerGame < 0.35 || (plusMinus < -15 && turnoverRatio > 2.0)) {
        weakness = {
          type: 'defense_offensive',
          severity: 5,
          description: `Offensive defenseman not producing: ${pointsPerGame.toFixed(2)} PPG, ${plusMinus} +/-, ${turnoverRatio.toFixed(1)} turnover ratio`,
          context: `Top-pair offensive defensemen must generate offense while managing the puck responsibly`,
          detailedAnalysis: `${player.firstName} ${player.lastName} is deployed as a top-pair offensive catalyst but is failing to deliver. With ${timeOnIce.toFixed(1)} minutes per game (top-pair usage), we need at least 0.35 PPG and responsible puck management. Current production of ${pointsPerGame.toFixed(2)} PPG with ${turnovers} giveaways vs ${puckRecoveries} takeaways shows poor decision-making under pressure.`,
          impactOnTeam: `This defenseman consumes premium power play time and offensive zone starts but isn't generating the offense to justify the deployment. The ${plusMinus} plus-minus suggests the team is getting outscored when he's on the ice, negating any offensive contribution.`,
          urgency: 'immediate'
        };
        isWeakLink = true;
        replacementStrategy = 'replace';
        reasoning = 'Need legitimate offensive defenseman who can generate points and manage the puck';
      }
    } else if (defenseType === 'Shutdown') {
      if (plusMinus < -20 || (defensiveImpactPerGame < 4.0 && physicality < 2.5)) {
        weakness = {
          type: 'defense_defensive',
          severity: 5,
          description: `Shutdown defenseman failing in top-pair role: ${plusMinus} +/-, ${defensiveImpactPerGame.toFixed(1)} defensive impact/game, ${physicality.toFixed(1)} hits/game`,
          context: 'Top-pair shutdown defensemen must excel at suppressing opponent offense and physical play',
          detailedAnalysis: `${player.firstName} ${player.lastName} is deployed as a shutdown defenseman against top opposition but is being dominated. With ${timeOnIce.toFixed(1)} minutes including penalty kill and defensive zone starts, we need strong shot suppression (${shotsBlocked.toFixed(1)} blocks/game) and physical presence (${physicality.toFixed(1)} hits/game). The ${plusMinus} plus-minus indicates the team is hemorrhaging goals when he's defending.`,
          impactOnTeam: `Top-pair shutdown defensemen face the opponent's best players and must win those battles. Current performance suggests the opposition is generating high-quality chances and the team is losing the war in their own zone when he's on the ice.`,
          urgency: 'immediate'
        };
        isWeakLink = true;
        replacementStrategy = 'replace';
        reasoning = 'Cannot handle elite opposition - need true shutdown defenseman';
      }
    }
  } else if (role === 'Second-Pair Defenseman') {
    // Second-pair guys need to be solid in their role without major weaknesses
    if (plusMinus < -12 && defensiveImpactPerGame < 2.5 && turnoverRatio > 1.8) {
      weakness = {
        type: 'defense_defensive',
        severity: 4,
        description: `Second-pair liability: ${plusMinus} +/-, ${defensiveImpactPerGame.toFixed(1)} defensive impact/game, ${turnoverRatio.toFixed(1)} turnover ratio`,
        context: 'Second-pair defensemen must be defensively reliable and not turn the puck over',
        detailedAnalysis: `${player.firstName} ${player.lastName} is struggling with second-pair responsibilities. Playing ${timeOnIce.toFixed(1)} minutes per game, he's showing poor puck management (${turnovers} giveaways vs ${puckRecoveries} takeaways) and minimal defensive impact (${shotsBlocked.toFixed(1)} blocks, ${physicality.toFixed(1)} hits per game). The ${plusMinus} plus-minus suggests he's a defensive liability.`,
        impactOnTeam: `Second-pair defensemen face quality opposition and must be trusted in key situations. Poor puck management leads to odd-man rushes and scoring chances against, while lack of defensive impact means he's not doing the dirty work needed to win battles.`,
        urgency: 'high'
      };
      isWeakLink = true;
      replacementStrategy = 'reassign';
      reasoning = 'Reduce minutes and pair with stronger defensive partner, or replace';
    }
  } else { // Third-pair
    // Third-pair should not be exposed too heavily and should contribute in their limited role
    if (timeOnIce > 17 && (plusMinus < -8 || defensiveImpactPerGame < 1.5)) {
      weakness = {
        type: 'defense_defensive',
        severity: 3,
        description: `Third-pair overexposure: ${timeOnIce.toFixed(1)} TOI, ${plusMinus} +/-, ${defensiveImpactPerGame.toFixed(1)} defensive impact/game`,
        context: 'Third-pair defensemen getting 17+ minutes must contribute defensively',
        detailedAnalysis: `${player.firstName} ${player.lastName} is being overused for his skill level. At ${timeOnIce.toFixed(1)} minutes per game (more than typical third-pair usage), he's showing he cannot handle the increased responsibility. His defensive metrics (${shotsBlocked.toFixed(1)} blocks, ${physicality.toFixed(1)} hits, ${puckRecoveries} takeaways per game) are insufficient for this ice time.`,
        impactOnTeam: `Third-pair defensemen shouldn't play this much unless they can contribute. Current deployment suggests coaching staff lacks better options, but performance shows he's hurting the team when overexposed to tougher competition.`,
        urgency: 'medium'
      };
      isWeakLink = true;
      replacementStrategy = 'reassign';
      reasoning = 'Reduce ice time to appropriate third-pair role or upgrade depth';
    }
  }

  return {
    player,
    position: 'Defenseman',
    role: fullRole,
    performanceMetrics: {
      ...metrics,
      defensiveImpactPerGame: defensiveImpactPerGame.toFixed(2),
      turnoverRatio: turnoverRatio.toFixed(2),
      advancedMetrics: {
        shotBlocks: shotsBlocked,
        physicality: physicality,
        puckRecoveries: puckRecoveries,
        turnovers: turnovers
      }
    },
    weakness,
    isWeakLink,
    replacementStrategy,
    reasoning
  };
}

// Advanced forward performance evaluation with position and role-specific analysis
function analyzeForward(player: Player, metrics: any): PlayerAnalysis {
  if (!metrics) {
    return {
      player,
      position: player.position,
      role: 'Unknown Role',
      performanceMetrics: null,
      isWeakLink: true,
      replacementStrategy: 'develop',
      reasoning: 'Insufficient data to evaluate forward performance'
    };
  }

  const { timeOnIce, pointsPerGame, plusMinus, hits, takeaways, shotBlocks, gamesPlayed, goals, assists } = metrics;
  
  // Calculate advanced forward metrics
  const offensiveImpact = (goals || 0) + (assists || 0);
  const defensiveWork = (takeaways || 0) + (shotBlocks || 0);
  const physicality = hits || 0;
  const goalPercentage = offensiveImpact > 0 ? (goals || 0) / offensiveImpact : 0;
  const playStyle = goalPercentage > 0.6 ? 'shooter' : 'playmaker';

  // Position-specific role analysis
  let positionExpectation = '';
  if (player.position === 'C') {
    positionExpectation = 'Centers must win faceoffs, drive play, and provide two-way reliability';
  } else if (player.position === 'LW' || player.position === 'RW') {
    positionExpectation = 'Wingers must create offense, drive the net, and support the cycle';
  }

  // Determine player archetype based on comprehensive analysis
  let playerType = 'Depth Forward';
  if (pointsPerGame > 0.7 && goalPercentage > 0.5) {
    playerType = 'Elite Scorer';
  } else if (pointsPerGame > 0.7 && goalPercentage < 0.4) {
    playerType = 'Playmaker';
  } else if (pointsPerGame > 0.5 && timeOnIce > 17) {
    playerType = goalPercentage > 0.5 ? 'Top-6 Scorer' : 'Top-6 Playmaker';
  } else if (pointsPerGame > 0.4 && defensiveWork > 1.5) {
    playerType = 'Two-Way Forward';
  } else if (physicality > 2.5 && pointsPerGame < 0.4) {
    playerType = 'Power Forward';
  } else if (defensiveWork > 2.0 && takeaways > 1.0) {
    playerType = 'Defensive Specialist';
  } else if (physicality > 2.0 && timeOnIce < 15) {
    playerType = 'Energy Player';
  } else if (pointsPerGame > 0.3) {
    playerType = 'Support Scorer';
  }

  // Classify line assignment based on usage, performance, AND salary expectations
  let lineRole = 'Fourth Line';
  const salary = parseFloat(player.capHit) || 0.925;
  
  // High-salary players must be treated as top-line regardless of current performance
  if (salary > 8.0) {
    lineRole = 'Top Line';
  } else if (salary > 6.0) {
    lineRole = 'Second Line';
  } else if (salary > 4.0) {
    lineRole = 'Third Line';
  } else {
    // For lower-salary players, use performance-based classification
    if (timeOnIce > 19 && pointsPerGame > 0.45) lineRole = 'Top Line';
    else if (timeOnIce > 17 && pointsPerGame > 0.35) lineRole = 'Second Line';  
    else if (timeOnIce > 15 && (pointsPerGame > 0.25 || physicality > 2.0)) lineRole = 'Third Line';
    else if (timeOnIce > 12) lineRole = 'Bottom-6';
    else if (timeOnIce > 8) lineRole = 'Fourth Line';
  }

  const fullRole = `${lineRole} ${playerType}`;

  // Advanced role-based performance evaluation
  let weakness: HockeyWeakness | undefined;
  let isWeakLink = false;
  let replacementStrategy: 'replace' | 'reassign' | 'develop' | 'adequate' = 'adequate';
  let reasoning = `Adequate ${playerType.toLowerCase()} performance for ${lineRole.toLowerCase()} deployment`;

  if (lineRole === 'Top Line' || lineRole === 'Second Line') {
    // Elite forwards must produce at elite levels
    const expectedPPG = lineRole === 'Top Line' ? 0.6 : 0.45;
    if (pointsPerGame < expectedPPG) {
      const productionGap = (expectedPPG - pointsPerGame) * 82;
      weakness = {
        type: 'forward_offensive',
        severity: lineRole === 'Top Line' ? 5 : 4,
        description: `${lineRole} forward underproducing: ${pointsPerGame.toFixed(2)} PPG vs ${expectedPPG.toFixed(2)} expected (${productionGap.toFixed(0)}-point pace gap)`,
        context: `${lineRole} forwards with ${timeOnIce.toFixed(1)} minutes must drive offense consistently. ${positionExpectation}`,
        detailedAnalysis: `${player.firstName} ${player.lastName} is deployed as a ${lineRole.toLowerCase()} ${playerType.toLowerCase()} but failing to justify premium ice time. With ${timeOnIce.toFixed(1)} minutes per game (${lineRole.toLowerCase()} usage), current production of ${pointsPerGame.toFixed(2)} PPG (${(pointsPerGame * 82).toFixed(0)} point pace) falls ${productionGap.toFixed(0)} points short of expectations. As a ${playStyle}, ${goalPercentage > 0.5 ? 'goal-scoring' : 'playmaking'} should be the primary strength, but ${goals || 0} goals and ${assists || 0} assists over ${gamesPlayed || 0} games shows inconsistent production. The ${plusMinus} plus-minus indicates the team is not benefiting when this player is on the ice.`,
        impactOnTeam: `${lineRole} forwards consume the most offensive zone starts, power play time, and favorable matchups. Current production means the team is not maximizing these key offensive opportunities. The ${productionGap.toFixed(0)}-point gap over 82 games represents significant lost offensive value that affects team scoring depth and playoff positioning.`,
        urgency: lineRole === 'Top Line' ? 'immediate' : 'high'
      };
      isWeakLink = true;
      replacementStrategy = 'replace';
      reasoning = `Need legitimate ${lineRole.toLowerCase()} producer - ${productionGap.toFixed(0)}-point upgrade available`;
    } else if (plusMinus < -15 && playerType.includes('Two-Way')) {
      weakness = {
        type: 'forward_defensive',
        severity: 4,
        description: `${lineRole} two-way forward failing defensively: ${plusMinus} +/- with premium ice time`,
        context: 'Two-way forwards must not be defensive liabilities despite offensive production',
        detailedAnalysis: `${player.firstName} ${player.lastName} produces offensively (${pointsPerGame.toFixed(2)} PPG) but is a significant defensive liability (${plusMinus} +/-). Two-way forwards getting ${timeOnIce.toFixed(1)} minutes must provide responsible defense. Only ${defensiveWork} takeaways/blocks per game and ${plusMinus} plus-minus suggests poor defensive positioning and decision-making.`,
        impactOnTeam: `Two-way forwards are trusted in key defensive situations and penalty kill. Current defensive performance means coaching staff cannot deploy this player in crucial moments, limiting lineup flexibility and hurting team defense.`,
        urgency: 'high'
      };
      isWeakLink = true;
      replacementStrategy = 'reassign';
      reasoning = 'Reduce defensive responsibilities or find defensively responsible alternative';
    }
  } else if (lineRole === 'Third Line' || lineRole === 'Bottom-6') {
    // Middle-6 forwards must contribute in their specialized role
    if (playerType === 'Power Forward' && (physicality < 2.0 || pointsPerGame < 0.25)) {
      weakness = {
        type: 'forward_physical',
        severity: 3,
        description: `Power forward not providing physicality or offense: ${physicality.toFixed(1)} hits/game, ${pointsPerGame.toFixed(2)} PPG`,
        context: 'Power forwards must excel in physical play while contributing offensively',
        detailedAnalysis: `${player.firstName} ${player.lastName} is deployed as a power forward but failing in both areas. With ${timeOnIce.toFixed(1)} minutes per game, only ${physicality.toFixed(1)} hits and ${pointsPerGame.toFixed(2)} PPG shows neither the physical presence nor offensive contribution needed. Power forwards must be impact players who change the game's momentum through body checks, net-front presence, and timely scoring.`,
        impactOnTeam: `Power forwards are meant to intimidate opponents, create space for teammates, and score in traffic. Current performance provides none of these elements, making the team easier to play against and less effective on the forecheck.`,
        urgency: 'medium'
      };
      isWeakLink = true;
      replacementStrategy = 'replace';
      reasoning = 'Need legitimate power forward who can impact the game physically and offensively';
    } else if (playerType === 'Defensive Specialist' && (takeaways < 1.0 || plusMinus < -10)) {
      weakness = {
        type: 'forward_defensive',
        severity: 3,
        description: `Defensive specialist not providing defense: ${takeaways} takeaways/game, ${plusMinus} +/-`,
        context: 'Defensive specialists must excel at puck recovery and responsible play',
        detailedAnalysis: `${player.firstName} ${player.lastName} is deployed as a defensive specialist but not fulfilling the role. With only ${takeaways} takeaways per game and ${plusMinus} plus-minus, this player is not providing the defensive value needed for penalty kill and defensive zone face-offs. Defensive specialists sacrifice offense for defensive impact.`,
        impactOnTeam: `Defensive specialists are crucial for penalty kill, defensive zone draws, and late-game defensive situations. Poor defensive metrics mean coaching staff cannot trust this player in key moments, reducing tactical options.`,
        urgency: 'medium'
      };
      isWeakLink = true;
      replacementStrategy = 'replace';
      reasoning = 'Need defensively responsible player for specialized situations';
    } else if (playerType === 'Support Scorer' && pointsPerGame < 0.2) {
      weakness = {
        type: 'overall_ineffective',
        severity: 4,
        description: `Support scorer not contributing: ${pointsPerGame.toFixed(2)} PPG, ${plusMinus} +/-, minimal impact in all areas`,
        context: 'Support scorers must provide secondary offense or other valuable contributions',
        detailedAnalysis: `${player.firstName} ${player.lastName} is categorized as a support scorer but provides little value. With ${pointsPerGame.toFixed(2)} PPG, ${physicality.toFixed(1)} hits/game, and ${defensiveWork} defensive actions per game, this player is not impacting the game in any meaningful way despite ${timeOnIce.toFixed(1)} minutes per game.`,
        impactOnTeam: `Support scorers must provide depth scoring, energy, or specialized skills. Current performance across all metrics suggests this player is not helping the team win hockey games and is consuming ice time that could be better utilized.`,
        urgency: 'high'
      };
      isWeakLink = true;
      replacementStrategy = 'replace';
      reasoning = 'Need player who can contribute meaningful value in middle-6 role';
    }
  } else if (lineRole === 'Fourth Line') {
    // Fourth liners need to fulfill their specific niche role without being liabilities
    if (playerType === 'Energy Player' && (physicality < 1.5 || (plusMinus < -8 && timeOnIce > 10))) {
      weakness = {
        type: 'overall_ineffective',
        severity: 2,
        description: `Energy player not providing energy or being overexposed: ${physicality.toFixed(1)} hits/game, ${timeOnIce.toFixed(1)} TOI`,
        context: 'Fourth-line energy players must impact the game through forechecking, hits, and momentum shifts',
        detailedAnalysis: `${player.firstName} ${player.lastName} is deployed as an energy player but not fulfilling the role. With only ${physicality.toFixed(1)} hits per game and ${takeaways} takeaways, this player is not providing the physical energy or defensive disruption needed. Fourth-line energy players must change the game's momentum through relentless forechecking and body contact.`,
        impactOnTeam: `Energy players are meant to tire out the opposition, create turnovers through pressure, and provide spark when the team needs momentum. Current performance provides none of these elements, making this a wasted roster spot.`,
        urgency: 'low'
      };
      isWeakLink = true;
      replacementStrategy = 'replace';
      reasoning = 'Need genuine energy player who can fulfill fourth-line role';
    }
  }

  return {
    player,
    position: player.position,
    role: fullRole,
    performanceMetrics: {
      ...metrics,
      offensiveImpact,
      defensiveWork,
      physicality,
      goalPercentage: goalPercentage.toFixed(3),
      playStyle,
      advancedMetrics: {
        goals: goals || 0,
        assists: assists || 0,
        takeaways: takeaways || 0,
        shotBlocks: shotBlocks || 0,
        hits: hits || 0
      }
    },
    weakness,
    isWeakLink,
    replacementStrategy,
    reasoning
  };
}

// Main analysis function
export async function analyzePlayerWithHockeyIntelligence(player: Player): Promise<PlayerAnalysis> {
  if (!player) {
    throw new Error('analyzePlayerWithHockeyIntelligence called with null/undefined player');
  }
  
  const metrics = await getPositionMetrics(player);

  if (player.position === 'G') {
    return analyzeGoalie(player, metrics);
  } else if (['D', 'LD', 'RD'].includes(player.position)) {
    return analyzeDefenseman(player, metrics);
  } else {
    return analyzeForward(player, metrics);
  }
}

// Find hockey-intelligent replacements
export async function findHockeyReplacements(analysis: PlayerAnalysis, mode: 'win-now' | 'rebuild' = 'win-now'): Promise<Player[]> {
  if (!analysis.isWeakLink || analysis.replacementStrategy !== 'replace') {
    return [];
  }

  const season = await currentSeason();
  const { player, weakness } = analysis;
  
  // Validate player has position data (handle Sequelize object structure)
  const position = player.position || player.dataValues?.position;
  if (!position) {
    console.error('Cannot find replacements for player without position:', position, player.firstName, player.lastName);
    return [];
  }
  
  // Define search criteria based on weakness type and position
  let positionSearch: string[] = [];
  let minPerformanceThreshold = 0;

  if (position === 'G') {
    positionSearch = ['G'];
    // Look for goalies with better save% or more experience
  } else if (['D', 'LD', 'RD'].includes(position)) {
    positionSearch = ['D', 'LD', 'RD'];
    if (weakness?.type === 'defense_offensive') {
      // Need offensive defenseman
    } else {
      // Need defensive defenseman
    }
  } else {
    // Forward - be more specific about position needs
    if (position === 'C') {
      positionSearch = ['C']; // Centers are specialized
    } else if (weakness?.type === 'forward_offensive') {
      positionSearch = [position]; // Same wing position for offensive players
    } else {
      positionSearch = [position];
    }
  }
  
  // Final validation of position search
  if (positionSearch.length === 0) {
    console.error('No valid positions to search for player:', player);
    return [];
  }

  // Calculate realistic salary range for replacements based on mode
  const currentSalary = parseFloat(player.capHit) || 0.925;
  let salaryBuffer, maxReplacementSalary, minReplacementSalary;
  
  if (mode === 'rebuild') {
    // Rebuild mode: prioritize salary savings and younger players
    salaryBuffer = Math.max(currentSalary * 0.5, 2.0); // Larger range for salary flexibility
    maxReplacementSalary = currentSalary; // Don't increase salary in rebuild
    minReplacementSalary = Math.max(currentSalary - salaryBuffer, 0.8); // More willing to take lower salary players
  } else {
    // Win-now mode: more willing to spend for immediate upgrades
    salaryBuffer = Math.max(currentSalary * 0.3, 1.0); // 30% buffer or $1M minimum
    maxReplacementSalary = currentSalary + salaryBuffer;
    minReplacementSalary = Math.max(currentSalary - salaryBuffer, 0.8);
  }

  // Find potential replacements with realistic salary constraints
  const candidates = await Player.findAll({
    where: {
      teamId: { [Op.ne]: player.teamId },
      position: { [Op.in]: positionSearch },
      retired: false,
      capHit: {
        [Op.between]: [minReplacementSalary, maxReplacementSalary]
      }
    },
    // Explicitly include all Player attributes to ensure dateOfBirth is loaded
    attributes: [
      'id', 'playerId', 'teamId', 'franchiseId', 'firstName', 'lastName',
      'nickName', 'height', 'weight', 'dateOfBirth', 'birthCity', 'birthState',
      'nationalityOne', 'nationalityTwo', 'nationalityThree', 'retired',
      'position', 'rfaUfa', 'yearsLeft', 'capHit'
    ],
    include: [{
      model: Team,
      as: 'team',
      where: {
        leagueId: [0] // Only NHL players for realistic trades
      }
    }],
    limit: 100
  });

  // Score candidates based on hockey metrics AND role appropriateness
  const targetMetrics = await getPositionMetrics(analysis.player);
  const targetRole = analysis.role;
  const targetScore = targetMetrics ? 
    (targetMetrics.pointsPerGame * 100 + Math.max(0, targetMetrics.plusMinus)) : 0;
  
  const scoredCandidates: Array<[Player, number]> = [];
  for (const candidate of candidates) {
    const candidateMetrics = await getPositionMetrics(candidate);
    if (!candidateMetrics) continue;

    // FILTER OUT ELITE PROSPECTS IN WIN-NOW MODE
    // In win-now: don't want unproven young players
    // In rebuild: elite prospects are EXACTLY what you want!
    const candidateAge = calculatePlayerAgeSync(candidate.dateOfBirth, season) ?? 30;
    const candidateSalary = parseFloat(candidate.capHit) || 0.925;

    if (mode === 'win-now' && candidateAge < 24 && candidateSalary < 1.5) {
      // Check if they're performing at elite level
      const isEliteProspect = candidate.position === 'G'
        ? (candidateMetrics.savePct > 0.915)
        : (candidateMetrics.pointsPerGame > 0.7);

      if (isEliteProspect) {
        console.log(`[Win-now] Filtering out elite prospect: ${candidate.firstName} ${candidate.lastName} (age ${candidateAge}, $${candidateSalary}M, ${candidateMetrics.pointsPerGame?.toFixed(2)} PPG) - too young/unproven for playoff push`);
        continue;
      }
    }

    // Classify the candidate's role using simplified logic to avoid recursion
    const candidateRole = classifyPlayerRole(candidate, candidateMetrics);
    
    // Only consider candidates who play a similar or better role
    const isAppropriateRole = isRoleAppropriate(targetRole, candidateRole);
    if (!isAppropriateRole) continue;

    let score = 0;
    
    if (candidate.position === 'G') {
      score = candidateMetrics.savePct * 1000 + candidateMetrics.winPct * 100;
    } else if (['D', 'LD', 'RD'].includes(candidate.position)) {
      if (weakness?.type === 'defense_offensive') {
        score = candidateMetrics.pointsPerGame * 100 + Math.max(0, candidateMetrics.plusMinus);
      } else {
        score = Math.max(0, candidateMetrics.plusMinus) * 2 + candidateMetrics.shotBlocks * 10;
      }
    } else {
      // Forward scoring based on role expectations
      if (candidateRole.includes('Top-6')) {
        score = candidateMetrics.pointsPerGame * 100 + Math.max(0, candidateMetrics.plusMinus);
      } else if (candidateRole.includes('Energy') || candidateRole.includes('Defensive')) {
        score = candidateMetrics.hits * 5 + Math.max(0, candidateMetrics.plusMinus) * 3 + candidateMetrics.takeaways * 10;
      } else {
        score = candidateMetrics.pointsPerGame * 100 + Math.max(0, candidateMetrics.plusMinus);
      }
    }

    // Realistic trade logic - avoid fantasy suggestions
    const targetAge = calculatePlayerAgeSync(analysis.player.dateOfBirth, season) ?? 30;
    
    const improvement = (score - targetScore) / Math.max(targetScore, 1);
    
    // Mode-specific age filtering
    if (mode === 'rebuild') {
      // Rebuild heavily favors younger players
      if (candidateAge > 28) {
        continue; // Skip older players in rebuild mode
      }
      // Boost score for very young players in rebuild
      if (candidateAge < 25) {
        score += 10; // Significant bonus for youth in rebuild
      }
    } else {
      // Win-now mode: slight penalty for very young unproven players
      if (candidateAge < 23) {
        score -= 5; // Slight penalty for very young in win-now
      }
    }
    
    // Determine if this is a realistic trade based on player tiers
    const targetTier = getPlayerTier(analysis.player, targetMetrics, season);
    const candidateTier = getPlayerTier(candidate, candidateMetrics, season);
    
    // Check if this trade is realistic
    const isRealistic = isRealisticTrade(targetTier, candidateTier, targetAge, candidateAge);
    if (!isRealistic) continue; // Skip unrealistic trades like Makar for Carlson
    
    // CONTRACT EFFICIENCY ANALYSIS - This is what the user specifically wants!
    const targetSalary = parseFloat(analysis.player.capHit) || 0.925;
    const targetEfficiency = calculateContractEfficiency(analysis.player, targetMetrics);
    const candidateEfficiency = calculateContractEfficiency(candidate, candidateMetrics);
    const targetExpectedSalary = calculateExpectedSalary(analysis.player.position, targetMetrics);
    const candidateExpectedSalary = calculateExpectedSalary(candidate.position, candidateMetrics);
    
    // Prioritize trades that improve cap efficiency
    const efficiencyImprovement = candidateEfficiency - targetEfficiency;
    const salaryDifference = candidateSalary - targetSalary;
    
    let shouldInclude = false;
    const minPerformanceThreshold = targetScore * 0.85; // Allow some performance flexibility for cap efficiency
    
    // PRIORITY TRADE TYPES (what user wants):
    // 1. Better player at same salary (2M for better 2M player)
    // 2. Equal player at lower salary (equal performance for 1M instead of 2M) 
    // 3. Significant upgrade worth paying more for
    
    const isSameSalaryUpgrade = Math.abs(salaryDifference) < 0.5 && improvement > 0.1;
    const isSalaryEfficiencyGain = improvement >= -0.05 && salaryDifference < -1.0; // Similar performance, much cheaper
    const isWorthwhileUpgrade = improvement > 0.2 && salaryDifference < 2.0; // Clear upgrade without massive salary jump
    const isCapEfficiencyPlay = efficiencyImprovement > 0.3; // Significant efficiency improvement
    
    if (mode === 'rebuild') {
      // Rebuild: prioritize salary savings, youth, and efficiency
      if (candidateAge <= 28) {
        if (isSalaryEfficiencyGain || isCapEfficiencyPlay || (candidateAge < 26 && improvement >= -0.1)) {
          shouldInclude = true;
          // Boost score for rebuild priorities
          if (salaryDifference < -2.0) score += 15; // Big salary savings
          if (candidateAge < 24) score += 10; // Prime development age
          if (efficiencyImprovement > 0.5) score += 20; // Major efficiency upgrade
        }
      }
    } else {
      // Win-now: prioritize performance with reasonable salary management
      if (isSameSalaryUpgrade || isWorthwhileUpgrade || isCapEfficiencyPlay) {
        shouldInclude = true;
        // Boost score for win-now priorities  
        if (isSameSalaryUpgrade) score += 25; // Perfect trade - better player, same money
        if (improvement > 0.3 && salaryDifference < 1.0) score += 20; // Great upgrade, minimal cost
        if (efficiencyImprovement > 0.4) score += 15; // Solid efficiency gain
      }
    }
    
    // Additional contract context for smarter recommendations
    const isOverpaid = targetSalary > targetExpectedSalary * 1.2;
    const isBargain = candidateSalary < candidateExpectedSalary * 0.8;
    
    if (isOverpaid && isBargain && improvement >= -0.1) {
      shouldInclude = true; // Trade overpaid player for bargain player
      score += 30; // High priority
    }
    
    if (shouldInclude && score > minPerformanceThreshold) {
      scoredCandidates.push([candidate, score]);
    }
  }

  // Sort and return realistic candidates
  scoredCandidates.sort((a, b) => b[1] - a[1]);
  return scoredCandidates.slice(0, 5).map(([candidate]) => candidate); // Return top 5 options
}

// Classify player into tiers for realistic trade matching
function getPlayerTier(player: Player, metrics: any, season: string): 'Elite' | 'Star' | 'Solid' | 'Depth' | 'Replacement' {
  if (!metrics) return 'Replacement';

  const { pointsPerGame, plusMinus, timeOnIce } = metrics;
  const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
  const salary = parseFloat(player.capHit) || 0.925;
  
  // Elite tier: Top performers in their prime
  if ((pointsPerGame > 0.8 || (player.position === 'D' && pointsPerGame > 0.6)) 
      && age < 32 && salary > 6.0 && timeOnIce > 20) {
    return 'Elite';
  }
  
  // Star tier: Very good players, some past prime elites
  if ((pointsPerGame > 0.6 || (player.position === 'D' && pointsPerGame > 0.45)) 
      && timeOnIce > 18 && (salary > 4.0 || age < 27)) {
    return 'Star';
  }
  
  // Solid tier: Good role players, aging stars
  if ((pointsPerGame > 0.4 || (player.position === 'D' && pointsPerGame > 0.3))
      && timeOnIce > 15) {
    return 'Solid';
  }
  
  // Depth tier: Bottom-6/Bottom-4 players with roles
  if (timeOnIce > 10 && plusMinus > -10) {
    return 'Depth';
  }
  
  return 'Replacement';
}

// Check if a trade between player tiers is realistic
function isRealisticTrade(targetTier: string, candidateTier: string, targetAge: number, candidateAge: number): boolean {
  // Elite players rarely get traded for non-elite players
  if (candidateTier === 'Elite' && targetTier !== 'Elite') return false;
  
  // Very young elite prospects might trade for aging stars
  if (candidateTier === 'Star' && targetTier === 'Solid' && candidateAge < 24) return true;
  
  // Generally, only trade within one tier or downward
  const tierRanks = { 'Elite': 5, 'Star': 4, 'Solid': 3, 'Depth': 2, 'Replacement': 1 };
  const targetRank = tierRanks[targetTier as keyof typeof tierRanks] || 1;
  const candidateRank = tierRanks[candidateTier as keyof typeof tierRanks] || 1;
  
  // Can trade up one tier if target is significantly older
  if (candidateRank > targetRank && (targetAge - candidateAge) > 5) return true;
  
  // Generally trade lateral or down
  return candidateRank <= targetRank + 1;
}

// Find AHL prospects for promotion suggestions
async function findAHLProspects(nhltTeam: Team | null | undefined, targetPosition: string, targetRole: string): Promise<Player[]> {
  // Safety check
  if (!nhltTeam || !nhltTeam.abbr) {
    console.warn('findAHLProspects called with invalid team');
    return [];
  }

  const season = await currentSeason();

  // Map NHL teams to their AHL affiliates (extensive mapping based on real affiliations)
  const AFFILIATES: { [key: string]: string[] } = {
    'WAS': ['HER'], // Washington -> Hershey Bears  
    'CHI': ['RCK'], // Chicago -> Rockford IceHogs
    'CGY': ['CLG'], // Calgary -> Calgary Wranglers (AHL)
    'COL': ['COL'], // Colorado -> Colorado Eagles
    'VGK': ['HEN'], // Vegas -> Henderson Silver Knights
    'ANA': ['SDG'], // Anaheim -> San Diego Gulls
    'EDM': ['BAK'], // Edmonton -> Bakersfield Condors
    'OTT': ['BEL'], // Ottawa -> Belleville Senators
    'NYI': ['BRI'], // NY Islanders -> Bridgeport Islanders
    'FLA': ['CHA'], // Florida -> Charlotte Checkers
    'CBJ': ['CLE'], // Columbus -> Cleveland Monsters
    'VAN': ['ABB'], // Vancouver -> Abbotsford Canucks
    'DET': ['GRA'], // Detroit -> Grand Rapids Griffins
    'NYR': ['HAR'], // NY Rangers -> Hartford Wolf Pack
    'DAL': ['TEX'], // Dallas -> Texas Stars
    'MTL': ['LAV'], // Montreal -> Laval Rocket
    'PHI': ['LEH'], // Philadelphia -> Lehigh Valley Phantoms
    'WPG': ['MAN'], // Winnipeg -> Manitoba Moose
    'NSH': ['MIL'], // Nashville -> Milwaukee Admirals
    'LAK': ['ONT'], // Los Angeles -> Ontario Reign
    'BOS': ['PRO'], // Boston -> Providence Bruins
    'BUF': ['RCH'], // Buffalo -> Rochester Americans
    'SJS': ['SJB'], // San Jose -> San Jose Barracuda
    'STL': ['SPR'], // St. Louis -> Springfield Thunderbirds
    'TBL': ['SYR'], // Tampa Bay -> Syracuse Crunch
    'TOR': ['TOR'], // Toronto -> Toronto Marlies
    'ARZ': ['TUC'], // Arizona -> Tucson Roadrunners
    'NJD': ['UTI'], // New Jersey -> Utica Comets
    'PIT': ['WBS'], // Pittsburgh -> Wilkes-Barre/Scranton Penguins
    'SEA': ['COA'], // Seattle -> Coachella Valley Firebirds
    'MIN': ['IOW'], // Minnesota -> Iowa Wild (shared with Dallas historically)
    'CAR': ['CHI'], // Carolina -> Chicago Wolves (some affiliations change)
  };

  const ahlAbbrevs = AFFILIATES[nhltTeam.abbr] || [];
  if (ahlAbbrevs.length === 0) {
    console.log(`No AHL affiliate mapping found for ${nhltTeam.abbr}`);
    return [];
  }

  // Find AHL teams
  const ahlTeams = await Team.findAll({
    where: {
      abbr: { [Op.in]: ahlAbbrevs },
      leagueId: 1 // AHL
    }
  });

  if (ahlTeams.length === 0) {
    console.log(`No AHL teams found for affiliates: ${ahlAbbrevs.join(', ')}`);
    return [];
  }

  const ahlTeamIds = ahlTeams.map(t => t.teamId);

  // Find promising AHL players in the target position
  const ahlPlayers = await Player.findAll({
    where: {
      teamId: { [Op.in]: ahlTeamIds },
      position: targetPosition,
      retired: false
    },
    include: [{
      model: Team,
      as: 'team'
    }],
    limit: 15
  });

  // Score AHL players based on potential (age, basic stats if available)
  const scoredProspects: Array<[Player, number]> = [];
  for (const player of ahlPlayers) {
    let prospectScore = 50; // Base score

    // Age factor - younger players get higher scores for development
    const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
    if (age < 23) prospectScore += 20; // Young prospects with high upside
    else if (age < 26) prospectScore += 10; // Still good development age
    else if (age > 28) prospectScore -= 10; // Older AHL players less likely to improve

    // Salary factor - lower cap hits suggest more upside potential
    const capHit = parseFloat(player.capHit) || 0.925;
    if (capHit < 1.0) prospectScore += 5; // Entry-level or cheap deals

    scoredProspects.push([player, prospectScore]);
  }

  // Sort by score and return top prospects
  scoredProspects.sort((a, b) => b[1] - a[1]);
  return scoredProspects.slice(0, 2).map(([player]) => player); // Top 2 prospects per position
}

// Team analysis with hockey intelligence
export async function analyzeTeamWithHockeyIntelligence(teamAbbrev: string, mode: 'win-now' | 'rebuild' = 'win-now') {
  const team = await Team.findOne({ where: { abbr: teamAbbrev } });
  if (!team) return { analyses: [], weakLinks: [], recommendations: [] };

  const season = await currentSeason();

  const players = await Player.findAll({
    where: {
      teamId: team.teamId,
      retired: false
    },
    // Explicitly include all Player attributes to ensure dateOfBirth is loaded
    attributes: [
      'id', 'playerId', 'teamId', 'franchiseId', 'firstName', 'lastName',
      'nickName', 'height', 'weight', 'dateOfBirth', 'birthCity', 'birthState',
      'nationalityOne', 'nationalityTwo', 'nationalityThree', 'retired',
      'position', 'rfaUfa', 'yearsLeft', 'capHit'
    ],
    include: [{ model: Team, as: 'team' }]
  });

  // Analyze each player
  const analyses: PlayerAnalysis[] = [];
  for (const player of players) {
    const analysis = await analyzePlayerWithHockeyIntelligence(player);
    analyses.push(analysis);
  }

  // ALWAYS identify bottom 5 performers regardless of role - every team has weak links
  const allPlayerAnalyses = analyses.filter(a => a.performanceMetrics);
  
  // Our salary expectations based on roles (from calculateSalaries.ts)
  const SALARY_EXPECTATIONS = {
    '1C': { min: 5.9, max: 12.5, expectedPPG: 0.6 },
    '2C': { min: 4.1, max: 5.85, expectedPPG: 0.45 },
    '3C': { min: 1.8, max: 4.0, expectedPPG: 0.35 },
    '4C': { min: 0.925, max: 1.8, expectedPPG: 0.25 },
    
    '1LW': { min: 4.7, max: 9.538462, expectedPPG: 0.6 },
    '2LW': { min: 2.3, max: 4.625, expectedPPG: 0.45 },
    '3LW': { min: 0.925, max: 2.275, expectedPPG: 0.35 },
    '4LW': { min: 0.874125, max: 0.925, expectedPPG: 0.25 },
    
    '1RW': { min: 4.85, max: 10.5, expectedPPG: 0.6 },
    '2RW': { min: 1.85, max: 4.766667, expectedPPG: 0.45 },
    '3RW': { min: 0.925, max: 1.85, expectedPPG: 0.35 },
    '4RW': { min: 0.8, max: 0.925, expectedPPG: 0.25 },
    
    '1D': { min: 5.5, max: 9.0, expectedPPG: 0.5 },
    '2D': { min: 4.6504, max: 5.5, expectedPPG: 0.4 },
    '3D': { min: 3.875, max: 4.625, expectedPPG: 0.3 },
    '4D': { min: 2.5, max: 3.857143, expectedPPG: 0.25 },
    '5D': { min: 1.3, max: 2.5, expectedPPG: 0.2 },
    '6D': { min: 0.925, max: 1.3, expectedPPG: 0.15 },
    
    'Starting': { min: 7.0, max: 10.0, expectedSavePct: 0.915 },
    'Backup': { min: 2.0, max: 7.0, expectedSavePct: 0.905 }
  };

  // Score each player relative to their role and salary expectations from our system
  const playerScores = allPlayerAnalyses.map(analysis => {
    const metrics = analysis.performanceMetrics;
    if (!metrics) return { analysis, score: -1000 };
    
    const capHit = parseFloat(analysis.player.capHit) || 0.925;
    
    // Determine expected salary tier based on actual cap hit
    let expectedRole = 'Unknown';
    let expectedPPG = 0.3;
    
    if (analysis.position === 'C') {
      if (capHit >= 5.9) expectedRole = '1C';
      else if (capHit >= 4.1) expectedRole = '2C';
      else if (capHit >= 1.8) expectedRole = '3C';
      else expectedRole = '4C';
    } else if (analysis.position === 'LW') {
      if (capHit >= 4.7) expectedRole = '1LW';
      else if (capHit >= 2.3) expectedRole = '2LW';
      else if (capHit >= 0.925) expectedRole = '3LW';
      else expectedRole = '4LW';
    } else if (analysis.position === 'RW') {
      if (capHit >= 4.85) expectedRole = '1RW';
      else if (capHit >= 1.85) expectedRole = '2RW';
      else if (capHit >= 0.925) expectedRole = '3RW';
      else expectedRole = '4RW';
    } else if (['D', 'LD', 'RD'].includes(analysis.position)) {
      if (capHit >= 5.5) expectedRole = '1D';
      else if (capHit >= 4.6504) expectedRole = '2D';
      else if (capHit >= 3.875) expectedRole = '3D';
      else if (capHit >= 2.5) expectedRole = '4D';
      else if (capHit >= 1.3) expectedRole = '5D';
      else expectedRole = '6D';
    } else if (analysis.position === 'G') {
      expectedRole = capHit >= 7.0 ? 'Starting' : 'Backup';
    }
    
    const expectations = SALARY_EXPECTATIONS[expectedRole];
    if (expectations) {
      expectedPPG = expectations.expectedPPG || 0.3;
    }
    
    // Score = how much they exceed/fall short of salary-based expectations
    let performanceScore = 0;
    if (analysis.position === 'G') {
      const expectedSavePct = expectations?.expectedSavePct || 0.90;
      performanceScore = (metrics.savePct || 0) - expectedSavePct;
    } else {
      // Base performance on points vs expected
      performanceScore = (metrics.pointsPerGame || 0) - expectedPPG;

      // INCORPORATE ADVANCED METRICS (Corsi/Fenwick) to detect declining players
      // These metrics reveal underlying performance beyond just points
      const corsiRel = metrics.corsiForPercentageRelative || 0;
      const fenwickRel = metrics.fenwickForPercentageRelative || 0;

      // If a player has decent points but terrible possession metrics, they're likely declining
      // CF% rel and FF% rel should be around 0 (average). Below -3 is concerning, below -5 is bad
      if (corsiRel < -3 || fenwickRel < -3) {
        const possessionPenalty = Math.min(corsiRel, fenwickRel) / 10; // -0.3 to -0.5 penalty
        performanceScore += possessionPenalty;
        console.log(`  ${analysis.player.firstName} ${analysis.player.lastName}: Poor possession (CF% rel: ${corsiRel.toFixed(1)}, FF% rel: ${fenwickRel.toFixed(1)}) - penalty: ${possessionPenalty.toFixed(2)}`);
      }

      // For defensemen, weight defensive metrics more heavily
      if (analysis.position === 'D') {
        const defensiveRating = metrics.gameRatingDef || 0;
        // Game Rating Def scale: 10 = elite, 7-9 = good, 5-7 = average, <5 = poor
        if (defensiveRating < 6) {
          const defPenalty = (6 - defensiveRating) * 0.1; // Penalty for poor defense
          performanceScore -= defPenalty;
          console.log(`  ${analysis.player.firstName} ${analysis.player.lastName}: Poor defensive rating (${defensiveRating.toFixed(1)}) - penalty: ${defPenalty.toFixed(2)}`);
        }
      }
    }

    // CRITICAL: Adjust scoring based on win-now vs rebuild mode
    const playerAge = calculatePlayerAgeSync(analysis.player.dateOfBirth, season) ?? 30;

    if (mode === 'rebuild') {
      // In rebuild mode, heavily penalize older expensive players and reward younger cheap players

      // Age penalty/bonus (rebuild favors youth)
      const ageFactor = playerAge > 30 ? -0.2 * (playerAge - 30) : 0.1 * (28 - playerAge);

      // Salary penalty (rebuild wants to shed expensive contracts)
      const salaryPenalty = capHit > 4.0 ? -0.3 * (capHit - 4.0) : 0;

      performanceScore += ageFactor + salaryPenalty;

      // EXTRA PENALTY: Veterans (32+) making $6M+ with declining possession should be prime trade targets
      if (playerAge >= 32 && capHit >= 6.0) {
        const veteranPenalty = -0.5; // Strong signal to move expensive vets in rebuild
        performanceScore += veteranPenalty;
        console.log(`  ${analysis.player.firstName} ${analysis.player.lastName}: Expensive veteran in rebuild (age ${playerAge}, $${capHit}M) - penalty: ${veteranPenalty.toFixed(2)}`);
      }
    } else {
      // In win-now mode, slightly penalize very old players but don't heavily weight age

      if (playerAge > 35) {
        performanceScore -= 0.1 * (playerAge - 35); // Slight penalty for very old players
      }

      // In win-now, also flag expensive players who aren't producing
      // If making $7M+ but underperforming, that's a problem even in win-now mode
      if (capHit >= 7.0 && performanceScore < -0.15) {
        const expensiveUnderperformerPenalty = -0.3;
        performanceScore += expensiveUnderperformerPenalty;
        console.log(`  ${analysis.player.firstName} ${analysis.player.lastName}: Expensive underperformer (${capHit}M, score ${performanceScore.toFixed(2)}) - penalty: ${expensiveUnderperformerPenalty.toFixed(2)}`);
      }
    }

    // Lower scores = worse value (falling short of expectations)
    return { analysis, score: performanceScore };
  });
  
  // Sort by score (lowest = worst performers)
  playerScores.sort((a, b) => a.score - b.score);

  // NEW APPROACH: Only flag players as weak links if we can actually improve the situation
  // Take underperforming players and check if replacements exist
  const weakLinks = [];
  const candidates = playerScores.filter(item => item.score < -0.1); // Significantly underperforming

  console.log(`Found ${candidates.length} underperforming players, checking for upgrade paths...`);

  for (let i = 0; i < Math.min(candidates.length, 10); i++) {
    const item = candidates[i];
    const analysis = item.analysis;
    const capHit = parseFloat(analysis.player.capHit) || 0.925;

    // Build temporary weakness to test replacement search
    const modeContext = mode === 'rebuild' ?
      'Priority target for trading in rebuild - shed salary and acquire youth/assets' :
      'Immediate upgrade needed for playoff push';

    let weakness: HockeyWeakness;
    if (analysis.role.includes('Top-6')) {
      weakness = {
        type: 'forward_offensive',
        severity: 3,
        description: `Underperforming relative to role and salary: ${analysis.performanceMetrics?.pointsPerGame.toFixed(2)} PPG for $${capHit.toFixed(1)}M`,
        context: `Below expectations for role. ${modeContext}`,
        detailedAnalysis: '',
        impactOnTeam: '',
        urgency: 'medium'
      };
    } else if (analysis.role.includes('Energy') || analysis.role.includes('Defensive')) {
      weakness = {
        type: 'overall_ineffective',
        severity: 2,
        description: `Minimal impact for $${capHit.toFixed(1)}M salary`,
        context: `Poor value in support role. ${modeContext}`,
        detailedAnalysis: '',
        impactOnTeam: '',
        urgency: 'medium'
      };
    } else {
      weakness = {
        type: 'overall_ineffective',
        severity: 2,
        description: `Below expectations: ${analysis.performanceMetrics?.pointsPerGame.toFixed(2)} PPG for $${capHit.toFixed(1)}M`,
        context: `Underperforming relative to salary. ${modeContext}`,
        detailedAnalysis: '',
        impactOnTeam: '',
        urgency: 'medium'
      };
    }

    weakness = generateDetailedWeaknessAnalysis(analysis.player, analysis.performanceMetrics, weakness);

    const tempWeakLink = {
      ...analysis,
      weakness,
      isWeakLink: true,
      replacementStrategy: 'replace' as const,
      reasoning: 'Underperforming relative to salary expectations'
    };

    // Check if replacements actually exist
    const replacements = await findHockeyReplacements(tempWeakLink, mode);

    // Strategic importance check (even without replacements, may want to highlight for rebuild)
    const playerAge = calculatePlayerAgeSync(analysis.player.dateOfBirth, season) ?? 30;
    const strategicPriority = mode === 'rebuild' && capHit > 4.0 && playerAge > 30;

    // Only add to weak links if we have actionable recommendations OR strategic importance
    if (replacements.length > 0 || strategicPriority) {
      weakLinks.push(tempWeakLink);
      console.log(`Weak link identified: ${analysis.player.firstName} ${analysis.player.lastName} - ${replacements.length} replacements found, strategic: ${strategicPriority}`);
    } else {
      console.log(`Skipped: ${analysis.player.firstName} ${analysis.player.lastName} - no realistic upgrades available`);
    }
  }

  console.log(`Final weak links: ${weakLinks.length}`);

  // Generate recommendations
  const recommendations = [];
  for (const weakLink of weakLinks) {
    const team = weakLink.player.team;
    
    if (weakLink.replacementStrategy === 'replace') {
      const replacements = await findHockeyReplacements(weakLink, mode);
      if (replacements.length > 0) {
        // Generate detailed analysis for each replacement option
        const replacementOptions = [];
        
        for (const replacement of replacements) {
          const replacementTeam = replacement.team;
          const detailedAnalysis = await generateReplacementAnalysis(weakLink.player, replacement, weakLink.weakness!);
          
          replacementOptions.push({
            id: replacement.playerId,
            name: `${replacement.firstName} ${replacement.lastName}`,
            position: replacement.position,
            teamAbbrev: replacementTeam?.dataValues?.abbr ?? replacementTeam?.abbr ?? null,
            capHit: parseFloat(replacement.capHit) || 0.925,
            detailedAnalysis
          });
        }
        
        recommendations.push({
          forPlayerId: weakLink.player.playerId,
          suggestionType: 'replace',
          playerInfo: {
            id: weakLink.player.playerId,
            name: `${weakLink.player.firstName} ${weakLink.player.lastName}`,
            position: weakLink.player.position,
            role: weakLink.role,
            teamAbbrev: team?.abbr ?? null,
            capHit: parseFloat(weakLink.player.capHit) || 0.925
          },
          weakness: weakLink.weakness,
          reasoning: weakLink.reasoning,
          replacementOptions // Multiple options instead of single replacement
        });
      } else {
        // Try to find AHL prospects for promotion instead of generic "internal development"
        const ahlProspects = await findAHLProspects(team, weakLink.player.position, weakLink.role);
        
        if (ahlProspects.length > 0) {
          const prospectOptions = ahlProspects.map(prospect => ({
            id: prospect.playerId,
            name: `${prospect.firstName} ${prospect.lastName}`,
            position: prospect.position,
            teamAbbrev: prospect.team?.abbr ?? null,
            capHit: parseFloat(prospect.capHit) || 0.925,
            detailedAnalysis: `${prospect.firstName} ${prospect.lastName} could be promoted from ${prospect.team?.name ?? 'AHL affiliate'}. Young ${prospect.position} with development upside - worth giving NHL opportunity.`
          }));

          recommendations.push({
            forPlayerId: weakLink.player.playerId,
            suggestionType: 'promote',
            playerInfo: {
              id: weakLink.player.playerId,
              name: `${weakLink.player.firstName} ${weakLink.player.lastName}`,
              position: weakLink.player.position,
              role: weakLink.role,
              teamAbbrev: team?.abbr ?? null,
              capHit: parseFloat(weakLink.player.capHit) || 0.925
            },
            weakness: weakLink.weakness,
            reasoning: weakLink.reasoning,
            promotionOptions: prospectOptions,
            note: `Consider promoting ${prospectOptions.map(p => p.name).join(' or ')} from AHL affiliate`
          });
        }
        // If no replacements or prospects found, don't add a recommendation
        // The weak link will still appear in the weak links section
      }
    } else if (weakLink.replacementStrategy === 'reassign') {
      recommendations.push({
        forPlayerId: weakLink.player.playerId,
        suggestionType: 'reassign',
        playerInfo: {
          id: weakLink.player.playerId,
          name: `${weakLink.player.firstName} ${weakLink.player.lastName}`,
          position: weakLink.player.position,
          role: weakLink.role,
          teamAbbrev: team?.abbr ?? null,
          capHit: weakLink.player.capHit
        },
        weakness: weakLink.weakness,
        reasoning: weakLink.reasoning
      });
    }
  }

  // Clean the response to avoid circular references
  const cleanResponse = {
    analyses: [], // Skip analyses for now to avoid issues
    weakLinks: weakLinks.map(wl => ({
      player: {
        id: wl.player.playerId,
        name: `${wl.player.firstName} ${wl.player.lastName}`,
        position: wl.player.position,
        role: wl.role,
        teamAbbrev: wl.player.team?.dataValues?.abbr ?? wl.player.team?.abbr ?? null,
        capHit: parseFloat(wl.player.capHit) || 0.925
      },
      weakness: wl.weakness ? {
        type: wl.weakness.type,
        severity: wl.weakness.severity,
        description: wl.weakness.description,
        context: wl.weakness.context,
        detailedAnalysis: wl.weakness.detailedAnalysis,
        impactOnTeam: wl.weakness.impactOnTeam,
        urgency: wl.weakness.urgency
      } : null,
      reasoning: wl.reasoning
    })),
    recommendations: recommendations.map(rec => ({
      forPlayerId: rec.forPlayerId,
      suggestionType: rec.suggestionType,
      playerInfo: {
        id: rec.playerInfo.id,
        name: rec.playerInfo.name,
        position: rec.playerInfo.position,
        role: rec.playerInfo.role,
        teamAbbrev: rec.playerInfo.teamAbbrev,
        capHit: parseFloat(rec.playerInfo.capHit) || 0.925
      },
      weakness: rec.weakness ? {
        type: rec.weakness.type,
        severity: rec.weakness.severity,
        description: rec.weakness.description,
        context: rec.weakness.context,
        detailedAnalysis: rec.weakness.detailedAnalysis,
        impactOnTeam: rec.weakness.impactOnTeam,
        urgency: rec.weakness.urgency
      } : null,
      reasoning: rec.reasoning,
      replacementOptions: rec.replacementOptions || null,
      replacement: rec.replacement ? {
        id: rec.replacement.id,
        name: rec.replacement.name,
        position: rec.replacement.position,
        teamAbbrev: rec.replacement.teamAbbrev,
        capHit: parseFloat(rec.replacement.capHit) || 0.925
      } : null,
      note: rec.note || null
    }))
  };

  return cleanResponse;
}