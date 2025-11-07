// Advanced Team Analysis - Deep GM-level insights
import { Op } from 'sequelize';
import { Team, Player, PlayerSeasonStat, PlayerRating } from '../models/index.js';
import { currentSeason, calculatePlayerAgeSync } from './scoring.js';

interface ContractEfficiency {
  playerId: number;
  name: string;
  position: string;
  capHit: number;
  performance: number;
  expectedSalary: number;
  efficiency: number; // Performance per dollar (higher = better value)
  category: 'Overpaid' | 'Fair' | 'Bargain' | 'Steal';
  yearsRemaining?: number;
  contractStatus: 'UFA' | 'RFA' | 'Signed';
}

interface TeamNeed {
  position: string;
  role: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  reason: string;
  suggestions: string[];
  targetSalaryRange: { min: number; max: number };
  specialTeamsImpact?: string;
}

interface TradeValue {
  player: Player;
  marketValue: number; // What they could realistically get back
  draftPickEquivalent: string; // e.g., "Late 1st + 3rd round pick"
  tradeability: 'High' | 'Medium' | 'Low' | 'Untradeable';
  factors: string[]; // Why this value
}

interface AdvancedTeamAnalysis {
  teamSummary: {
    totalCapHit: number;
    capEfficiency: number; // Overall team efficiency
    avgAge: number;
    coreAge: number; // Age of top players
    contractFlexibility: 'High' | 'Medium' | 'Low';
    competitiveWindow: string;
  };
  contractEfficiency: ContractEfficiency[];
  teamNeeds: TeamNeed[];
  tradeAssets: TradeValue[];
  specialTeamsAnalysis: {
    powerPlay: { strength: number; needs: string[] };
    penaltyKill: { strength: number; needs: string[] };
    faceoffs: { strength: number; needs: string[] };
  };
  strategicRecommendations: {
    immediateActions: string[];
    seasonPlan: string[];
    offseasonPriorities: string[];
  };
}

// Calculate performance-based expected salary
function calculateExpectedSalary(position: string, metrics: any): number {
  const { pointsPerGame, timeOnIce, hits, shotBlocks, plusMinus, takeaways } = metrics;
  
  let baseSalary = 0.925; // League minimum
  
  if (position === 'G') {
    // Goalies based on save percentage and games played
    return baseSalary; // Simplified for now
  } else if (position === 'D') {
    // Defensemen: points + defensive metrics + ice time
    const offensiveValue = Math.max(0, pointsPerGame * 6000000); // ~$6M per PPG
    const defensiveValue = Math.max(0, (shotBlocks * 50000) + (hits * 30000) + (takeaways * 80000));
    const iceTimeValue = Math.max(0, (timeOnIce - 15) * 200000); // Premium for heavy minutes
    const plusMinusAdjustment = Math.max(-1000000, Math.min(1000000, plusMinus * 50000));
    
    baseSalary = Math.max(0.925, (offensiveValue + defensiveValue + iceTimeValue + plusMinusAdjustment) / 1000000);
  } else {
    // Forwards: primarily points + some defensive metrics + ice time
    const offensiveValue = Math.max(0, pointsPerGame * 8000000); // ~$8M per PPG for forwards
    const defensiveValue = Math.max(0, (hits * 25000) + (takeaways * 60000));
    const iceTimeValue = Math.max(0, (timeOnIce - 12) * 150000);
    const plusMinusAdjustment = Math.max(-500000, Math.min(500000, plusMinus * 30000));
    
    baseSalary = Math.max(0.925, (offensiveValue + defensiveValue + iceTimeValue + plusMinusAdjustment) / 1000000);
  }
  
  // Cap at reasonable maximums
  if (position === 'D') {
    return Math.min(baseSalary, 11.0);
  } else {
    return Math.min(baseSalary, 13.0);
  }
}

// Analyze contract efficiency for the entire roster
async function analyzeContractEfficiency(players: Player[]): Promise<ContractEfficiency[]> {
  const efficiencyAnalysis: ContractEfficiency[] = [];
  
  for (const player of players) {
    const metrics = await getPlayerMetrics(player);
    if (!metrics) continue;
    
    const capHit = parseFloat(player.capHit?.toString() || '0.925');
    const expectedSalary = calculateExpectedSalary(player.position, metrics);
    const performance = metrics.pointsPerGame * 100 + Math.max(0, metrics.plusMinus * 2);
    const efficiency = performance / Math.max(capHit, 0.1); // Performance per million
    
    let category: ContractEfficiency['category'];
    const ratio = expectedSalary / capHit;
    
    if (ratio > 1.5) category = 'Steal';
    else if (ratio > 1.2) category = 'Bargain';
    else if (ratio > 0.8) category = 'Fair';
    else category = 'Overpaid';
    
    efficiencyAnalysis.push({
      playerId: player.playerId,
      name: `${player.firstName} ${player.lastName}`,
      position: player.position,
      capHit,
      performance,
      expectedSalary,
      efficiency,
      category,
      yearsRemaining: player.yearsLeft || undefined,
      contractStatus: player.rfaUfa as any || 'Signed'
    });
  }
  
  return efficiencyAnalysis.sort((a, b) => b.efficiency - a.efficiency);
}

async function getPlayerMetrics(player: Player) {
  const season = await currentSeason();
  const stats = await PlayerSeasonStat.findOne({
    where: { playerId: player.playerId, season }
  });
  
  if (!stats || !stats.gamesPlayed || stats.gamesPlayed < 10) return null;
  
  const games = stats.gamesPlayed;
  return {
    pointsPerGame: ((stats.goals || 0) + (stats.assists || 0)) / games,
    timeOnIce: (stats.timeOnIce || 0) / games / 60, // Convert to minutes per game
    hits: (stats.hits || 0) / games,
    shotBlocks: (stats.shotBlocks || 0) / games,
    plusMinus: stats.plusMinus || 0,
    takeaways: (stats.takeaways || 0) / games,
    giveaways: (stats.giveaways || 0) / games,
    faceoffWinPct: stats.faceoffWinPct || 0
  };
}

// Identify specific team needs beyond just "worst players"
async function identifyTeamNeeds(players: Player[], contractAnalysis: ContractEfficiency[]): Promise<TeamNeed[]> {
  const needs: TeamNeed[] = [];
  
  // Group players by position and analyze depth
  const positionGroups = players.reduce((acc, player) => {
    const pos = player.position === 'F' ? 'C' : player.position; // Treat F as C for analysis
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(player);
    return acc;
  }, {} as { [key: string]: Player[] });
  
  // Analyze forward lines (need 12+ forwards)
  const forwards = [...(positionGroups['C'] || []), ...(positionGroups['LW'] || []), ...(positionGroups['RW'] || [])];
  const forwardsByPerformance = contractAnalysis.filter(p => ['C', 'LW', 'RW', 'F'].includes(p.position));
  
  if (forwards.length < 12) {
    needs.push({
      position: 'Forward',
      role: 'Depth Forward',
      priority: 'High',
      reason: `Only ${forwards.length} forwards on roster - need depth`,
      suggestions: ['Target veteran depth forwards under $2M', 'Consider AHL promotions'],
      targetSalaryRange: { min: 0.925, max: 2.5 }
    });
  }
  
  // Check for top-6 scoring need
  const topSixForwards = forwardsByPerformance.slice(0, 6);
  const lowScoringTopSix = topSixForwards.filter(f => f.performance < 40).length;
  if (lowScoringTopSix >= 3) {
    needs.push({
      position: 'Forward',
      role: 'Top-6 Scorer',
      priority: 'Critical',
      reason: `${lowScoringTopSix} of top 6 forwards underperforming offensively`,
      suggestions: ['Target proven 20+ goal scorer', 'Consider trading multiple pieces for star'],
      targetSalaryRange: { min: 4.0, max: 10.0 },
      specialTeamsImpact: 'Power play upgrade needed'
    });
  }
  
  // Analyze defense (need 6+ defensemen)
  const defensemen = positionGroups['D'] || [];
  const defenseByPerformance = contractAnalysis.filter(p => p.position === 'D');
  
  if (defensemen.length < 6) {
    needs.push({
      position: 'Defense',
      role: 'Depth Defenseman',
      priority: 'High',
      reason: `Only ${defensemen.length} defensemen on roster`,
      suggestions: ['Add veteran depth defenseman', 'Promote from AHL'],
      targetSalaryRange: { min: 0.925, max: 3.0 }
    });
  }
  
  // Check for defensive zone coverage
  const defensiveSpecialists = defenseByPerformance.filter(d => d.capHit > 3.0 && d.efficiency > 2.0);
  if (defensiveSpecialists.length < 2) {
    needs.push({
      position: 'Defense',
      role: 'Shutdown Defenseman',
      priority: 'Medium',
      reason: 'Need reliable defensive zone coverage',
      suggestions: ['Target stay-at-home defenseman', 'Improve defensive positioning'],
      targetSalaryRange: { min: 2.5, max: 6.0 },
      specialTeamsImpact: 'Penalty kill improvement'
    });
  }
  
  return needs;
}

// Calculate realistic trade values
async function calculateTradeValues(players: Player[], contractAnalysis: ContractEfficiency[]): Promise<TradeValue[]> {
  const tradeValues: TradeValue[] = [];
  const season = await currentSeason();

  for (const player of players) {
    const contract = contractAnalysis.find(c => c.playerId === player.playerId);
    if (!contract) continue;

    const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
    const capHit = contract.capHit;
    
    let marketValue = 0;
    let tradeability: TradeValue['tradeability'] = 'Medium';
    let draftPickEquivalent = '';
    const factors: string[] = [];
    
    // Base value on performance and contract
    if (contract.category === 'Steal') {
      marketValue = capHit * 1.8;
      factors.push('Excellent contract value');
      tradeability = 'High';
    } else if (contract.category === 'Bargain') {
      marketValue = capHit * 1.4;
      factors.push('Good contract value');
      tradeability = 'High';
    } else if (contract.category === 'Fair') {
      marketValue = capHit;
      factors.push('Fair market contract');
    } else {
      marketValue = capHit * 0.6;
      factors.push('Overpaid - limited market');
      tradeability = 'Low';
    }
    
    // Age adjustments
    if (age < 25) {
      marketValue *= 1.3;
      factors.push('Prime development age');
      tradeability = tradeability === 'Low' ? 'Medium' : 'High';
    } else if (age > 32) {
      marketValue *= 0.8;
      factors.push('Aging player');
      if (tradeability === 'High') tradeability = 'Medium';
    }
    
    // Contract status
    if (contract.contractStatus === 'UFA' && contract.yearsRemaining === 1) {
      marketValue *= 0.7;
      factors.push('Rental player (UFA after season)');
    } else if (contract.yearsRemaining && contract.yearsRemaining > 3 && contract.category === 'Bargain') {
      marketValue *= 1.2;
      factors.push('Term remaining on good deal');
    }
    
    // Convert market value to draft pick equivalent
    if (marketValue > 8.0) {
      draftPickEquivalent = '1st round pick + prospect';
    } else if (marketValue > 5.0) {
      draftPickEquivalent = '1st round pick';
    } else if (marketValue > 3.0) {
      draftPickEquivalent = '2nd + 3rd round pick';
    } else if (marketValue > 1.5) {
      draftPickEquivalent = '3rd round pick';
    } else {
      draftPickEquivalent = '4th-7th round pick';
    }
    
    // Special cases
    if (capHit > 8.0 && contract.category === 'Overpaid') {
      tradeability = 'Untradeable';
      factors.push('Salary too high for performance');
    }
    
    tradeValues.push({
      player,
      marketValue,
      draftPickEquivalent,
      tradeability,
      factors
    });
  }
  
  return tradeValues.sort((a, b) => b.marketValue - a.marketValue);
}

// Advanced team analysis with all components
export async function performAdvancedTeamAnalysis(teamAbbrev: string): Promise<AdvancedTeamAnalysis> {
  const team = await Team.findOne({ where: { abbr: teamAbbrev } });
  if (!team) throw new Error('Team not found');
  
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
  
  const contractAnalysis = await analyzeContractEfficiency(players);
  const teamNeeds = await identifyTeamNeeds(players, contractAnalysis);
  const tradeValues = await calculateTradeValues(players, contractAnalysis);

  // Get current game season for age calculations
  const season = await currentSeason();

  // Calculate team summary metrics
  const totalCapHit = contractAnalysis.reduce((sum, player) => sum + player.capHit, 0);
  const avgEfficiency = contractAnalysis.reduce((sum, player) => sum + player.efficiency, 0) / contractAnalysis.length;
  const avgAge = players.reduce((sum, player) => {
    const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
    return sum + age;
  }, 0) / players.length;

  // Core players (top 10 by cap hit)
  const corePlayerAges = contractAnalysis
    .sort((a, b) => b.capHit - a.capHit)
    .slice(0, 10)
    .map(p => players.find(player => player.playerId === p.playerId)!)
    .map(player => calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30);
  const coreAge = corePlayerAges.reduce((sum, age) => sum + age, 0) / corePlayerAges.length;
  
  // Competitive window assessment
  let competitiveWindow = '';
  if (coreAge < 27) {
    competitiveWindow = 'Rising - Core entering prime years';
  } else if (coreAge < 30) {
    competitiveWindow = 'Peak - Win-now window open';
  } else if (coreAge < 33) {
    competitiveWindow = 'Closing - Last competitive years';
  } else {
    competitiveWindow = 'Rebuild - Core aging out';
  }
  
  // Strategic recommendations
  const immediateActions: string[] = [];
  const seasonPlan: string[] = [];
  const offseasonPriorities: string[] = [];
  
  // Generate recommendations based on analysis
  const overpaidPlayers = contractAnalysis.filter(p => p.category === 'Overpaid' && p.capHit > 3.0);
  const bargainPlayers = contractAnalysis.filter(p => p.category === 'Bargain' && p.capHit < 5.0);
  
  if (overpaidPlayers.length > 3) {
    immediateActions.push(`Trade overpaid players: ${overpaidPlayers.slice(0, 2).map(p => p.name).join(', ')}`);
    offseasonPriorities.push('Address salary cap efficiency - multiple overpaid contracts');
  }
  
  if (bargainPlayers.length > 2) {
    seasonPlan.push(`Leverage bargain contracts: ${bargainPlayers.slice(0, 2).map(p => p.name).join(', ')} have excellent value`);
    offseasonPriorities.push('Extend bargain players before they get expensive');
  }
  
  if (teamNeeds.some(need => need.priority === 'Critical')) {
    immediateActions.push(`Address critical needs: ${teamNeeds.filter(n => n.priority === 'Critical').map(n => n.role).join(', ')}`);
  }
  
  return {
    teamSummary: {
      totalCapHit,
      capEfficiency: avgEfficiency,
      avgAge,
      coreAge,
      contractFlexibility: totalCapHit > 75 ? 'Low' : totalCapHit > 65 ? 'Medium' : 'High',
      competitiveWindow
    },
    contractEfficiency: contractAnalysis,
    teamNeeds,
    tradeAssets: tradeValues,
    specialTeamsAnalysis: {
      powerPlay: { strength: 50, needs: ['Improved zone entries', 'Net-front presence'] },
      penaltyKill: { strength: 50, needs: ['Better defensive positioning'] },
      faceoffs: { strength: 50, needs: ['Reliable center for defensive draws'] }
    },
    strategicRecommendations: {
      immediateActions,
      seasonPlan,
      offseasonPriorities
    }
  };
}