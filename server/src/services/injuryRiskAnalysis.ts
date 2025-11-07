// Injury Risk Assessment and Backup Plan Analysis
import { Op } from 'sequelize';
import { Team, Player, PlayerSeasonStat } from '../models/index.js';
import { getPositionMetrics } from './hockeyAnalysis.js';
import { currentSeason, calculatePlayerAgeSync } from './scoring.js';

interface InjuryRiskProfile {
  teamOverview: TeamInjuryOverview;
  playerRiskAssessments: PlayerInjuryRisk[];
  positionVulnerabilities: PositionVulnerability[];
  backupPlans: BackupPlan[];
  recommendations: InjuryRecommendation[];
}

interface TeamInjuryOverview {
  overallRiskRating: number; // 1-10 (10 = highest risk)
  mostVulnerablePosition: string;
  depthConcerns: string[];
  injuryHistoryPattern: string;
  resilienceScore: number; // 1-10 ability to handle injuries
}

interface PlayerInjuryRisk {
  playerId: number;
  name: string;
  position: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  riskScore: number; // 1-100
  primaryRiskFactors: RiskFactor[];
  injuryHistory: InjuryHistoryPattern;
  gamesMissedProjection: number; // Expected games missed per season
  backupReadiness: number; // 1-10 how ready backup is
  criticalityToTeam: number; // 1-10 how much team depends on this player
}

interface RiskFactor {
  category: 'age' | 'injury-history' | 'playing-style' | 'workload' | 'position-specific';
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  preventable: boolean;
  mitigation: string;
}

interface InjuryHistoryPattern {
  gamesPlayedAverage: number; // Last 3 seasons
  injuryProneness: 'durable' | 'average' | 'injury-prone' | 'very-fragile';
  commonInjuryTypes: string[];
  careerGamesPlayed: number;
  missedTimePattern: string;
}

interface PositionVulnerability {
  position: string;
  vulnerabilityRating: number; // 1-10
  depth: DepthAnalysis;
  keyRisks: string[];
  contingencyPlans: ContingencyPlan[];
}

interface DepthAnalysis {
  starterQuality: number; // 1-10
  backupQuality: number; // 1-10
  depthCount: number; // Number of viable options
  internalOptions: InternalOption[];
  externalOptions: ExternalOption[];
}

interface InternalOption {
  playerId: number;
  name: string;
  readiness: number; // 1-10 ready to step up
  ceiling: string; // What they could become
  timeline: string; // How long to be effective
}

interface ExternalOption {
  type: 'trade' | 'free-agent' | 'waiver-claim' | 'emergency-recall';
  description: string;
  cost: string;
  feasibility: number; // 1-10 how likely to acquire
}

interface BackupPlan {
  scenario: string;
  affectedPositions: string[];
  severity: 'minor' | 'significant' | 'major' | 'catastrophic';
  primaryResponse: Response;
  alternativeResponses: Response[];
  timelineToImplement: string;
  successProbability: number; // 1-100
}

interface Response {
  action: string;
  players: string[];
  rationale: string;
  risks: string[];
  benefits: string[];
}

interface ContingencyPlan {
  triggerEvent: string;
  immediateResponse: string;
  mediumTermSolution: string;
  longTermImpact: string;
}

interface InjuryRecommendation {
  priority: 'immediate' | 'high' | 'medium' | 'low';
  category: 'depth-acquisition' | 'load-management' | 'position-flexibility' | 'development';
  recommendation: string;
  rationale: string;
  timeline: string;
  estimatedCost: string;
}

// Injury risk factors based on hockey analytics
const INJURY_RISK_FACTORS = {
  age: {
    under23: { multiplier: 0.8, description: 'Young, resilient body' },
    age23to27: { multiplier: 1.0, description: 'Prime athletic years' },
    age28to32: { multiplier: 1.2, description: 'Entering decline phase' },
    age33to36: { multiplier: 1.5, description: 'Aging body, slower recovery' },
    over36: { multiplier: 2.0, description: 'Significant age-related risk' }
  },
  
  playingStyle: {
    finesse: { multiplier: 0.9, description: 'Avoids physical contact' },
    balanced: { multiplier: 1.0, description: 'Average physical engagement' },
    physical: { multiplier: 1.3, description: 'High-contact style increases risk' },
    agitator: { multiplier: 1.4, description: 'Frequent scrums and hits' }
  },
  
  position: {
    'G': { multiplier: 0.7, description: 'Protected position' },
    'D': { multiplier: 1.2, description: 'High contact, shot blocking' },
    'C': { multiplier: 1.1, description: 'High faceoff and traffic exposure' },
    'LW': { multiplier: 1.0, description: 'Moderate contact level' },
    'RW': { multiplier: 1.0, description: 'Moderate contact level' }
  },
  
  workload: {
    under16min: { multiplier: 0.8, description: 'Limited exposure' },
    min16to20: { multiplier: 1.0, description: 'Normal workload' },
    min20to24: { multiplier: 1.2, description: 'Heavy minutes increase risk' },
    over24min: { multiplier: 1.4, description: 'Extreme usage, high fatigue' }
  }
};

// Common injury patterns by position
const POSITION_INJURY_PATTERNS = {
  'G': ['Groin strain', 'Hip injury', 'Knee problems', 'Concussion'],
  'D': ['Shoulder injury', 'Blocked shot injuries', 'Back problems', 'Concussion'],
  'C': ['Faceoff-related injuries', 'Shoulder separation', 'Concussion', 'Hand/wrist'],
  'LW': ['Shoulder injury', 'Knee problems', 'Concussion', 'Back injury'],
  'RW': ['Shoulder injury', 'Knee problems', 'Concussion', 'Wrist injury']
};

export async function analyzeInjuryRisk(teamAbbrev: string): Promise<InjuryRiskProfile> {
  const team = await Team.findOne({ where: { abbr: teamAbbrev } });
  if (!team) {
    throw new Error(`Team ${teamAbbrev} not found`);
  }

  const season = await currentSeason();

  const players = await Player.findAll({
    where: {
      teamId: team.teamId,
      retired: false
    },
    include: [{ model: Team, as: 'team' }]
  });

  const playerRiskAssessments = await analyzePlayerRisks(players, season);
  const positionVulnerabilities = await analyzePositionVulnerabilities(players);
  const backupPlans = generateBackupPlans(players, positionVulnerabilities);
  const teamOverview = calculateTeamOverview(playerRiskAssessments, positionVulnerabilities);
  const recommendations = generateInjuryRecommendations(teamOverview, positionVulnerabilities, backupPlans);

  return {
    teamOverview,
    playerRiskAssessments,
    positionVulnerabilities,
    backupPlans,
    recommendations
  };
}

async function analyzePlayerRisks(players: Player[], season: string): Promise<PlayerInjuryRisk[]> {
  const riskAssessments: PlayerInjuryRisk[] = [];

  for (const player of players) {
    const metrics = await getPositionMetrics(player);
    const riskAssessment = await calculatePlayerInjuryRisk(player, metrics, season);
    riskAssessments.push(riskAssessment);
  }

  // Sort by risk score (highest first)
  return riskAssessments.sort((a, b) => b.riskScore - a.riskScore);
}

async function calculatePlayerInjuryRisk(player: Player, metrics: any, season: string): Promise<PlayerInjuryRisk> {
  const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
  
  let riskScore = 20; // Base risk score
  const riskFactors: RiskFactor[] = [];

  // Age risk factor
  const ageRisk = getAgeRiskFactor(age);
  riskScore *= ageRisk.multiplier;
  if (ageRisk.multiplier > 1.2) {
    riskFactors.push({
      category: 'age',
      description: `Age ${age}: ${ageRisk.description}`,
      severity: age > 33 ? 'major' : 'moderate',
      preventable: false,
      mitigation: 'Load management, recovery focus'
    });
  }

  // Position risk factor
  const positionRisk = INJURY_RISK_FACTORS.position[player.position] || INJURY_RISK_FACTORS.position['LW'];
  riskScore *= positionRisk.multiplier;
  if (positionRisk.multiplier > 1.1) {
    riskFactors.push({
      category: 'position-specific',
      description: `${player.position}: ${positionRisk.description}`,
      severity: 'moderate',
      preventable: true,
      mitigation: 'Equipment upgrades, technique coaching'
    });
  }

  // Workload risk factor
  if (metrics?.timeOnIce) {
    const workloadRisk = getWorkloadRiskFactor(metrics.timeOnIce);
    riskScore *= workloadRisk.multiplier;
    if (workloadRisk.multiplier > 1.1) {
      riskFactors.push({
        category: 'workload',
        description: `${metrics.timeOnIce.toFixed(1)} min/game: ${workloadRisk.description}`,
        severity: metrics.timeOnIce > 22 ? 'major' : 'moderate',
        preventable: true,
        mitigation: 'Reduce ice time, strategic rest games'
      });
    }
  }

  // Playing style risk (estimated from stats)
  const playingStyleRisk = estimatePlayingStyleRisk(metrics);
  riskScore *= playingStyleRisk.multiplier;
  if (playingStyleRisk.multiplier > 1.2) {
    riskFactors.push({
      category: 'playing-style',
      description: playingStyleRisk.description,
      severity: 'moderate',
      preventable: true,
      mitigation: 'Adjust playing style, avoid unnecessary contact'
    });
  }

  // Injury history analysis (simplified - would need injury database)
  const injuryHistory = analyzeInjuryHistory(player, metrics);
  const historyMultiplier = getInjuryHistoryMultiplier(injuryHistory.injuryProneness);
  riskScore *= historyMultiplier;

  if (historyMultiplier > 1.2) {
    riskFactors.push({
      category: 'injury-history',
      description: `${injuryHistory.injuryProneness}: Pattern of missed time`,
      severity: injuryHistory.injuryProneness === 'very-fragile' ? 'critical' : 'major',
      preventable: false,
      mitigation: 'Enhanced medical support, preventive treatment'
    });
  }

  // Cap and normalize risk score
  const finalRiskScore = Math.min(100, Math.max(5, riskScore));
  
  const riskLevel = getRiskLevel(finalRiskScore);
  const gamesMissedProjection = calculateGamesMissedProjection(finalRiskScore, injuryHistory);
  const criticalityToTeam = calculateCriticalityToTeam(player, metrics);

  return {
    playerId: player.playerId,
    name: `${player.firstName} ${player.lastName}`,
    position: player.position,
    riskLevel,
    riskScore: finalRiskScore,
    primaryRiskFactors: riskFactors,
    injuryHistory,
    gamesMissedProjection,
    backupReadiness: 5, // Would calculate based on depth analysis
    criticalityToTeam
  };
}

function getAgeRiskFactor(age: number) {
  if (age < 23) return INJURY_RISK_FACTORS.age.under23;
  if (age <= 27) return INJURY_RISK_FACTORS.age.age23to27;
  if (age <= 32) return INJURY_RISK_FACTORS.age.age28to32;
  if (age <= 36) return INJURY_RISK_FACTORS.age.age33to36;
  return INJURY_RISK_FACTORS.age.over36;
}

function getWorkloadRiskFactor(timeOnIce: number) {
  if (timeOnIce < 16) return INJURY_RISK_FACTORS.workload.under16min;
  if (timeOnIce <= 20) return INJURY_RISK_FACTORS.workload.min16to20;
  if (timeOnIce <= 24) return INJURY_RISK_FACTORS.workload.min20to24;
  return INJURY_RISK_FACTORS.workload.over24min;
}

function estimatePlayingStyleRisk(metrics: any) {
  if (!metrics) return INJURY_RISK_FACTORS.playingStyle.balanced;
  
  const hitsPerGame = metrics.hits || 0;
  const takeaways = metrics.takeaways || 0;
  const physicality = hitsPerGame + (takeaways * 0.5);
  
  if (physicality > 3.0) {
    return { 
      ...INJURY_RISK_FACTORS.playingStyle.agitator,
      description: `High physicality (${hitsPerGame.toFixed(1)} hits/game)`
    };
  } else if (physicality > 2.0) {
    return { 
      ...INJURY_RISK_FACTORS.playingStyle.physical,
      description: `Physical style (${hitsPerGame.toFixed(1)} hits/game)`
    };
  } else if (physicality < 0.5) {
    return INJURY_RISK_FACTORS.playingStyle.finesse;
  }
  return INJURY_RISK_FACTORS.playingStyle.balanced;
}

function analyzeInjuryHistory(player: Player, metrics: any): InjuryHistoryPattern {
  // Simplified analysis - would need actual injury database
  const gamesPlayedAverage = metrics?.gamesPlayed || 70;
  
  let injuryProneness: InjuryHistoryPattern['injuryProneness'] = 'average';
  if (gamesPlayedAverage >= 78) injuryProneness = 'durable';
  else if (gamesPlayedAverage >= 65) injuryProneness = 'average';
  else if (gamesPlayedAverage >= 50) injuryProneness = 'injury-prone';
  else injuryProneness = 'very-fragile';

  const commonInjuryTypes = POSITION_INJURY_PATTERNS[player.position] || ['General injury risk'];
  const careerGamesPlayed = gamesPlayedAverage * 8; // Estimate
  const missedTimePattern = gamesPlayedAverage >= 75 ? 'Rarely misses time' :
                           gamesPlayedAverage >= 60 ? 'Occasional missed games' :
                           'Frequently unavailable';

  return {
    gamesPlayedAverage,
    injuryProneness,
    commonInjuryTypes,
    careerGamesPlayed,
    missedTimePattern
  };
}

function getInjuryHistoryMultiplier(proneness: InjuryHistoryPattern['injuryProneness']): number {
  switch (proneness) {
    case 'durable': return 0.8;
    case 'average': return 1.0;
    case 'injury-prone': return 1.4;
    case 'very-fragile': return 1.8;
    default: return 1.0;
  }
}

function getRiskLevel(riskScore: number): PlayerInjuryRisk['riskLevel'] {
  if (riskScore >= 70) return 'critical';
  if (riskScore >= 50) return 'high';
  if (riskScore >= 30) return 'moderate';
  return 'low';
}

function calculateGamesMissedProjection(riskScore: number, history: InjuryHistoryPattern): number {
  const baseGamesMissed = Math.max(0, 82 - history.gamesPlayedAverage);
  const riskMultiplier = riskScore / 50; // Risk score of 50 = 1x multiplier
  return Math.round(baseGamesMissed * riskMultiplier);
}

function calculateCriticalityToTeam(player: Player, metrics: any): number {
  const salary = parseFloat(player.capHit || '0');
  const performance = metrics ? (metrics.pointsPerGame || 0) * 10 + Math.max(0, metrics.plusMinus || 0) : 0;
  const timeOnIce = metrics?.timeOnIce || 15;
  
  // Combine salary, performance, and ice time to determine importance
  let criticality = (salary / 2) + performance + (timeOnIce / 5);
  
  // Position adjustments
  if (player.position === 'G') criticality *= 1.3; // Goalies more critical
  if (player.position === 'C') criticality *= 1.1; // Centers important
  
  return Math.min(10, Math.max(1, criticality));
}

async function analyzePositionVulnerabilities(players: Player[]): Promise<PositionVulnerability[]> {
  const positions = ['G', 'D', 'C', 'LW', 'RW'];
  const vulnerabilities: PositionVulnerability[] = [];

  for (const position of positions) {
    const positionPlayers = players.filter(p => p.position === position);
    const vulnerability = await analyzePositionDepth(position, positionPlayers);
    vulnerabilities.push(vulnerability);
  }

  return vulnerabilities.sort((a, b) => b.vulnerabilityRating - a.vulnerabilityRating);
}

async function analyzePositionDepth(position: string, players: Player[]): Promise<PositionVulnerability> {
  const depth = await analyzeDepthChart(position, players);
  
  // Calculate vulnerability rating based on depth quality and quantity
  let vulnerabilityRating = 5; // Base vulnerability
  
  if (depth.starterQuality < 6) vulnerabilityRating += 2;
  if (depth.backupQuality < 4) vulnerabilityRating += 2;
  if (depth.depthCount < 2) vulnerabilityRating += 2;
  if (position === 'G' && depth.depthCount < 2) vulnerabilityRating += 1; // Goalies need depth
  
  vulnerabilityRating = Math.min(10, Math.max(1, vulnerabilityRating));

  const keyRisks = identifyPositionRisks(position, depth);
  const contingencyPlans = generateContingencyPlans(position, depth);

  return {
    position,
    vulnerabilityRating,
    depth,
    keyRisks,
    contingencyPlans
  };
}

async function analyzeDepthChart(position: string, players: Player[]): Promise<DepthAnalysis> {
  // Sort players by salary/importance
  const sortedPlayers = players.sort((a, b) => 
    (parseFloat(b.capHit || '0')) - (parseFloat(a.capHit || '0'))
  );

  const starterQuality = sortedPlayers.length > 0 ? await ratePlayerQuality(sortedPlayers[0]) : 1;
  const backupQuality = sortedPlayers.length > 1 ? await ratePlayerQuality(sortedPlayers[1]) : 1;
  const depthCount = sortedPlayers.length;

  // Analyze internal options (current players who could step up)
  const internalOptions: InternalOption[] = sortedPlayers.slice(1, 4).map((player, index) => ({
    playerId: player.playerId,
    name: `${player.firstName} ${player.lastName}`,
    readiness: Math.max(1, 8 - index * 2), // Decrease readiness for lower depth
    ceiling: index === 0 ? 'NHL Regular' : index === 1 ? 'Bottom-6/3rd Pair' : 'Depth Player',
    timeline: index === 0 ? 'Immediate' : index === 1 ? '1-2 weeks' : '1+ months'
  }));

  // Generate external options
  const externalOptions: ExternalOption[] = [
    {
      type: 'trade',
      description: `Trade for established ${position}`,
      cost: 'Multiple assets (picks/prospects)',
      feasibility: position === 'G' ? 6 : 7
    },
    {
      type: 'free-agent',
      description: `Sign available ${position}`,
      cost: '$1-3M salary commitment',
      feasibility: 4 // Limited mid-season availability
    },
    {
      type: 'waiver-claim',
      description: `Claim ${position} off waivers`,
      cost: 'Minimal (contract only)',
      feasibility: 3 // Rare quality available
    }
  ];

  return {
    starterQuality,
    backupQuality,
    depthCount,
    internalOptions,
    externalOptions
  };
}

async function ratePlayerQuality(player: Player): Promise<number> {
  const metrics = await getPositionMetrics(player);
  if (!metrics) return 3; // Unknown quality

  const salary = parseFloat(player.capHit || '0');
  const performance = metrics.pointsPerGame || 0;
  const timeOnIce = metrics.timeOnIce || 15;
  
  // Simple quality rating based on salary and performance
  let quality = 3; // Base
  
  if (salary > 7) quality += 3;
  else if (salary > 4) quality += 2;
  else if (salary > 2) quality += 1;
  
  if (performance > 0.7) quality += 2;
  else if (performance > 0.4) quality += 1;
  
  if (timeOnIce > 20) quality += 1;
  
  return Math.min(10, Math.max(1, quality));
}

function identifyPositionRisks(position: string, depth: DepthAnalysis): string[] {
  const risks: string[] = [];
  
  if (depth.starterQuality < 6) {
    risks.push(`Starting ${position} below NHL standard`);
  }
  
  if (depth.backupQuality < 4) {
    risks.push(`Backup ${position} significant drop-off`);
  }
  
  if (depth.depthCount < 2) {
    risks.push(`Insufficient ${position} depth`);
  }
  
  if (position === 'G' && depth.depthCount < 3) {
    risks.push('Goalie position requires 3 viable options');
  }
  
  if (position === 'C' && depth.depthCount < 4) {
    risks.push('Center depth critical for faceoffs and special teams');
  }

  return risks;
}

function generateContingencyPlans(position: string, depth: DepthAnalysis): ContingencyPlan[] {
  const plans: ContingencyPlan[] = [];
  
  // Plan for starter injury
  plans.push({
    triggerEvent: `Starting ${position} injured`,
    immediateResponse: depth.internalOptions.length > 0 ? 
      `Promote ${depth.internalOptions[0].name} to starting role` : 
      `Emergency call-up from AHL`,
    mediumTermSolution: depth.backupQuality >= 5 ? 
      'Internal promotion covers adequately' : 
      'Trade deadline acquisition needed',
    longTermImpact: depth.starterQuality >= 7 ? 
      'Significant impact on team performance' : 
      'Manageable with proper depth'
  });
  
  // Plan for multiple injuries at position
  if (depth.depthCount >= 2) {
    plans.push({
      triggerEvent: `Multiple ${position} injuries`,
      immediateResponse: 'Call up multiple AHL players',
      mediumTermSolution: 'Emergency trades or signings required',
      longTermImpact: 'Severe impact on team competitiveness'
    });
  }

  return plans;
}

function generateBackupPlans(players: Player[], vulnerabilities: PositionVulnerability[]): BackupPlan[] {
  const plans: BackupPlan[] = [];
  
  // Generate plans for most vulnerable positions
  const criticalVulnerabilities = vulnerabilities.filter(v => v.vulnerabilityRating >= 7);
  
  for (const vulnerability of criticalVulnerabilities) {
    // Single player injury scenario
    plans.push({
      scenario: `Starting ${vulnerability.position} injury`,
      affectedPositions: [vulnerability.position],
      severity: vulnerability.depth.backupQuality >= 5 ? 'significant' : 'major',
      primaryResponse: {
        action: `Promote backup ${vulnerability.position}`,
        players: vulnerability.depth.internalOptions.slice(0, 1).map(p => p.name),
        rationale: 'Minimize disruption with internal promotion',
        risks: ['Performance drop-off', 'Lack of experience'],
        benefits: ['No acquisition cost', 'Familiar with system']
      },
      alternativeResponses: vulnerability.depth.externalOptions.map(option => ({
        action: option.description,
        players: ['External acquisition'],
        rationale: `External help needed - ${option.cost}`,
        risks: ['Integration time', 'Asset cost'],
        benefits: ['Proven performance', 'Immediate impact']
      })),
      timelineToImplement: '1-7 days',
      successProbability: Math.max(30, vulnerability.depth.backupQuality * 10)
    });
  }
  
  // Multi-position injury scenario
  if (criticalVulnerabilities.length > 1) {
    plans.push({
      scenario: 'Multiple key position injuries',
      affectedPositions: criticalVulnerabilities.slice(0, 2).map(v => v.position),
      severity: 'catastrophic',
      primaryResponse: {
        action: 'Emergency roster management',
        players: ['Multiple call-ups', 'Position changes'],
        rationale: 'Survive until trade deadline or returns',
        risks: ['Team performance collapse', 'Season derailment'],
        benefits: ['Preserve long-term assets', 'Development opportunities']
      },
      alternativeResponses: [{
        action: 'Aggressive trade deadline moves',
        players: ['Multiple acquisitions'],
        rationale: 'Mortgage future for current season',
        risks: ['Depleted prospect pool', 'Long-term consequences'],
        benefits: ['Maintain competitiveness', 'Playoff push']
      }],
      timelineToImplement: '1-4 weeks',
      successProbability: 25
    });
  }

  return plans;
}

function calculateTeamOverview(risks: PlayerInjuryRisk[], vulnerabilities: PositionVulnerability[]): TeamInjuryOverview {
  const overallRiskRating = risks.slice(0, 10).reduce((sum, risk) => sum + risk.riskScore, 0) / 100;
  const mostVulnerablePosition = vulnerabilities[0]?.position || 'Unknown';
  
  const depthConcerns = vulnerabilities
    .filter(v => v.vulnerabilityRating >= 6)
    .map(v => `${v.position}: ${v.keyRisks[0] || 'Depth concerns'}`);
  
  const highRiskCount = risks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;
  const injuryHistoryPattern = highRiskCount > 3 ? 'Multiple injury-prone players' :
                              highRiskCount > 1 ? 'Some injury concerns' :
                              'Generally healthy roster';
  
  const resilienceScore = Math.max(1, 10 - vulnerabilities.reduce((sum, v) => sum + v.vulnerabilityRating, 0) / vulnerabilities.length);

  return {
    overallRiskRating: Math.min(10, Math.max(1, overallRiskRating)),
    mostVulnerablePosition,
    depthConcerns,
    injuryHistoryPattern,
    resilienceScore
  };
}

function generateInjuryRecommendations(overview: TeamInjuryOverview, vulnerabilities: PositionVulnerability[], plans: BackupPlan[]): InjuryRecommendation[] {
  const recommendations: InjuryRecommendation[] = [];
  
  // Address highest vulnerability
  if (vulnerabilities.length > 0) {
    const topVulnerability = vulnerabilities[0];
    if (topVulnerability.vulnerabilityRating >= 8) {
      recommendations.push({
        priority: 'immediate',
        category: 'depth-acquisition',
        recommendation: `Acquire depth at ${topVulnerability.position}`,
        rationale: `Critical vulnerability (${topVulnerability.vulnerabilityRating}/10) with limited internal options`,
        timeline: 'Next 2 weeks',
        estimatedCost: '$1-3M in salary or mid-round pick'
      });
    }
  }
  
  // Load management for high-risk players
  recommendations.push({
    priority: 'high',
    category: 'load-management',
    recommendation: 'Implement strategic rest schedule for high-risk players',
    rationale: `${overview.injuryHistoryPattern} suggests proactive management needed`,
    timeline: 'Immediate implementation',
    estimatedCost: 'Potential short-term performance impact'
  });
  
  // Position flexibility
  if (vulnerabilities.filter(v => v.vulnerabilityRating >= 6).length > 2) {
    recommendations.push({
      priority: 'medium',
      category: 'position-flexibility',
      recommendation: 'Develop players with multi-position capability',
      rationale: 'Multiple position vulnerabilities require flexible solutions',
      timeline: '1-3 months',
      estimatedCost: 'Practice time and development focus'
    });
  }

  return recommendations;
}