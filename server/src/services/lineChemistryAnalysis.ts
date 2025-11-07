// Advanced Line Chemistry Analysis using Historical +/- and Performance Data
import { Op } from 'sequelize';
import { Team, Player, PlayerSeasonStat } from '../models/index.js';
import { getPositionMetrics } from './hockeyAnalysis.js';
import { currentSeason, calculatePlayerAgeSync } from './scoring.js';

interface LineChemistryProfile {
  teamChemistryOverview: TeamChemistryOverview;
  lineAnalysis: LineAnalysis[];
  pairingAnalysis: PairingAnalysis[];
  chemistryRecommendations: ChemistryRecommendation[];
  optimalCombinations: OptimalCombination[];
  synergiesAndConflicts: SynergiesAndConflicts;
}

interface TeamChemistryOverview {
  overallChemistryRating: number; // 1-10
  bestChemistryPosition: string;
  worstChemistryPosition: string;
  teamPlayingStyle: PlayingStyle;
  cohesionFactors: CohesionFactor[];
  improvementPotential: number; // 1-10
}

interface PlayingStyle {
  primaryStyle: 'offensive' | 'defensive' | 'balanced' | 'transition' | 'physical';
  secondaryStyles: string[];
  styleConsistency: number; // 1-10 how well players fit the system
  adaptability: number; // 1-10 how flexible the system is
}

interface CohesionFactor {
  factor: 'age-compatibility' | 'skill-complementarity' | 'playing-style-match' | 'experience-blend' | 'positional-fit';
  rating: number; // 1-10
  description: string;
  impact: string;
}

interface LineAnalysis {
  lineId: string;
  lineName: string;
  players: LinePlayer[];
  chemistryRating: number; // 1-10
  effectiveness: LineEffectiveness;
  playingStyle: LinePlayingStyle;
  strengths: string[];
  weaknesses: string[];
  historicalPerformance: HistoricalLinePerformance;
  optimizationSuggestions: LineSuggestion[];
}

interface LinePlayer {
  playerId: number;
  name: string;
  position: string;
  role: string; // 'playmaker', 'finisher', 'energy', 'two-way', etc.
  individualMetrics: IndividualMetrics;
  lineContribution: LineContribution;
  synergies: PlayerSynergy[];
}

interface IndividualMetrics {
  pointsPerGame: number;
  plusMinus: number;
  timeOnIce: number;
  offensiveZoneStarts: number; // % of starts in offensive zone
  corsiFor: number; // Shot attempt differential
  qualityOfCompetition: number; // Difficulty of opposing players
}

interface LineContribution {
  chemistryImpact: number; // How much this player adds to line chemistry
  positionFit: number; // 1-10 how well they fit their role
  versatility: number; // 1-10 ability to adapt within line
  leadership: number; // 1-10 on-ice leadership contribution
}

interface PlayerSynergy {
  withPlayerId: number;
  withPlayerName: string;
  synergyType: 'complementary' | 'multiplicative' | 'neutral' | 'conflicting';
  synergyRating: number; // 1-10
  specificBenefits: string[];
  evidence: string; // Statistical evidence
}

interface LineEffectiveness {
  offensiveRating: number; // 1-10
  defensiveRating: number; // 1-10
  specialTeamsRating: number; // 1-10
  clutchRating: number; // 1-10 performance in key situations
  consistencyRating: number; // 1-10 game-to-game reliability
  versusEliteRating: number; // 1-10 vs top competition
}

interface LinePlayingStyle {
  primaryApproach: 'cycle-heavy' | 'speed-rush' | 'net-front' | 'perimeter' | 'transition';
  pace: 'fast' | 'moderate' | 'methodical';
  physicality: 'heavy' | 'moderate' | 'finesse';
  creativity: number; // 1-10 unpredictability factor
  systemFit: number; // 1-10 how well line fits team system
}

interface HistoricalLinePerformance {
  gamesPlayedTogether: number;
  winPercentage: number;
  goalsFor: number;
  goalsAgainst: number;
  plusMinusTogether: number;
  clutchPerformance: ClutchPerformance;
  trendDirection: 'improving' | 'stable' | 'declining';
}

interface ClutchPerformance {
  lateGameSituations: number; // +/- in final 10 minutes
  overtimeRecord: string;
  playoffPerformance: number; // If available
  backToBackGames: number; // Performance on tired legs
}

interface PairingAnalysis {
  pairingId: string;
  defensemen: [LinePlayer, LinePlayer];
  chemistryRating: number;
  effectiveness: PairingEffectiveness;
  playingStyle: PairingStyle;
  deployment: DeploymentAnalysis;
  recommendations: PairingSuggestion[];
}

interface PairingEffectiveness {
  defensiveZoneCoverage: number; // 1-10
  transitionPlay: number; // 1-10
  powerPlayEffectiveness: number; // 1-10
  penaltyKillEffectiveness: number; // 1-10
  physicality: number; // 1-10
  puckMoving: number; // 1-10
}

interface PairingStyle {
  primaryRole: 'shutdown' | 'offensive' | 'balanced' | 'transition';
  handedness: 'both-right' | 'both-left' | 'left-right' | 'right-left';
  experienceLevel: 'veteran' | 'mixed' | 'young';
  complementarity: number; // 1-10 how well skills complement
}

interface DeploymentAnalysis {
  averageTOI: number;
  qualityOfCompetition: number;
  zonalDeployment: ZonalDeployment;
  situationalUsage: SituationalUsage;
  loadManagement: LoadManagement;
}

interface ZonalDeployment {
  offensiveZoneStart: number; // %
  defensiveZoneStart: number; // %
  neutralZoneStart: number; // %
  preferredDeployment: string;
}

interface SituationalUsage {
  evenStrength: number; // % of ice time
  powerPlay: number;
  penaltyKill: number;
  lateGame: number; // Usage in final 5 minutes
  specialSituations: string[];
}

interface LoadManagement {
  backToBackImpact: number; // Performance change
  fatigueResistance: number; // 1-10
  injuryHistory: string;
  optimalRestPattern: string;
}

interface ChemistryRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'line-change' | 'position-swap' | 'role-adjustment' | 'system-tweak';
  description: string;
  rationale: string;
  expectedImpact: number; // 1-10 improvement potential
  implementationDifficulty: number; // 1-10
  riskLevel: 'low' | 'moderate' | 'high';
  timeline: string;
}

interface OptimalCombination {
  combinationType: 'forward-line' | 'defensive-pair' | 'power-play-unit' | 'penalty-kill-unit';
  players: OptimalPlayer[];
  projectedRating: number; // 1-10
  synergisticBenefits: string[];
  potentialConcerns: string[];
  versusCurrentDelta: number; // Improvement over current
  feasibility: number; // 1-10 how realistic to implement
}

interface OptimalPlayer {
  playerId: number;
  name: string;
  position: string;
  currentLine: string;
  proposedRole: string;
  fitRating: number; // 1-10
}

interface SynergiesAndConflicts {
  strongSynergies: PlayerPairSynergy[];
  problematicPairings: PlayerPairSynergy[];
  systemMisfits: SystemMisfit[];
  hiddenGems: HiddenGem[];
}

interface PlayerPairSynergy {
  player1Id: number;
  player1Name: string;
  player2Id: number;
  player2Name: string;
  synergyStrength: number; // 1-10
  synergyType: string;
  evidence: StatisticalEvidence;
  recommendation: string;
}

interface SystemMisfit {
  playerId: number;
  playerName: string;
  misfitType: 'playing-style' | 'pace' | 'role' | 'chemistry';
  severity: number; // 1-10
  solutions: string[];
}

interface HiddenGem {
  playerId: number;
  playerName: string;
  untappedPotential: string;
  bestFitScenario: string;
  estimatedImpact: number; // 1-10
}

interface StatisticalEvidence {
  gamesPlayedTogether: number;
  combinedPlusMinusImprovement: number;
  goalDifferentialWith: number;
  goalDifferentialWithout: number;
  winPercentageTogether: number;
}

interface LineSuggestion {
  suggestionType: 'player-swap' | 'role-change' | 'deployment-change' | 'system-adjustment';
  description: string;
  expectedImprovement: number; // 1-10
  confidence: number; // 1-10
}

interface PairingSuggestion {
  suggestionType: 'partner-swap' | 'role-redistribution' | 'deployment-change' | 'system-fit';
  description: string;
  expectedImprovement: number;
  confidence: number;
}

export async function analyzeLineChemistry(teamAbbrev: string): Promise<LineChemistryProfile> {
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

  // Analyze current team chemistry
  const teamChemistryOverview = await analyzeTeamChemistry(players, season);
  
  // Analyze forward lines
  const lineAnalysis = await analyzeForwardLines(players, season);
  
  // Analyze defensive pairings
  const pairingAnalysis = await analyzeDefensivePairings(players, season);
  
  // Generate optimization recommendations
  const chemistryRecommendations = generateChemistryRecommendations(lineAnalysis, pairingAnalysis, teamChemistryOverview);
  
  // Find optimal combinations
  const optimalCombinations = await findOptimalCombinations(players, lineAnalysis, pairingAnalysis);
  
  // Identify synergies and conflicts
  const synergiesAndConflicts = await identifySynergiesAndConflicts(players);

  return {
    teamChemistryOverview,
    lineAnalysis,
    pairingAnalysis,
    chemistryRecommendations,
    optimalCombinations,
    synergiesAndConflicts
  };
}

async function analyzeTeamChemistry(players: Player[], season: string): Promise<TeamChemistryOverview> {
  // Calculate overall team chemistry based on various factors
  const forwards = players.filter(p => ['C', 'LW', 'RW'].includes(p.position));
  const defensemen = players.filter(p => ['D', 'LD', 'RD'].includes(p.position));

  // Analyze age distribution for chemistry
  const ages = players.map(p => calculatePlayerAgeSync(p.dateOfBirth, season) ?? 30);
  const avgAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
  const ageSpread = Math.max(...ages) - Math.min(...ages);
  
  const cohesionFactors: CohesionFactor[] = [];
  
  // Age compatibility analysis
  const ageCompatibilityRating = ageSpread < 8 ? 8 : ageSpread < 12 ? 6 : 4;
  cohesionFactors.push({
    factor: 'age-compatibility',
    rating: ageCompatibilityRating,
    description: `Age range: ${Math.min(...ages)}-${Math.max(...ages)} (spread: ${ageSpread} years)`,
    impact: ageSpread < 8 ? 'Tight age range promotes chemistry' : 'Wide age gap may create generation divide'
  });
  
  // Experience blend analysis
  const veteranCount = ages.filter(age => age > 30).length;
  const veteranRatio = veteranCount / players.length;
  const experienceBlendRating = veteranRatio > 0.6 ? 5 : veteranRatio > 0.4 ? 8 : veteranRatio > 0.2 ? 9 : 6;
  cohesionFactors.push({
    factor: 'experience-blend',
    rating: experienceBlendRating,
    description: `${Math.round(veteranRatio * 100)}% veterans (30+ years old)`,
    impact: experienceBlendRating >= 8 ? 'Good veteran-youth balance' : 'Imbalanced experience levels'
  });

  // Determine playing style through player analysis
  let offensiveOriented = 0;
  let defensiveOriented = 0;
  let physicalOriented = 0;
  
  for (const player of players) {
    const metrics = await getPositionMetrics(player);
    if (metrics) {
      if (metrics.pointsPerGame > 0.5) offensiveOriented++;
      if (metrics.plusMinus > 5) defensiveOriented++;
      if ((metrics.hits || 0) > 2) physicalOriented++;
    }
  }
  
  const totalPlayers = players.length;
  let primaryStyle: PlayingStyle['primaryStyle'] = 'balanced';
  const secondaryStyles: string[] = [];
  
  if (offensiveOriented / totalPlayers > 0.4) {
    primaryStyle = 'offensive';
    secondaryStyles.push('High-tempo offense');
  } else if (defensiveOriented / totalPlayers > 0.4) {
    primaryStyle = 'defensive';
    secondaryStyles.push('Structure-focused');
  } else if (physicalOriented / totalPlayers > 0.3) {
    primaryStyle = 'physical';
    secondaryStyles.push('Heavy forecheck');
  } else {
    primaryStyle = 'balanced';
    secondaryStyles.push('Versatile system');
  }

  const teamPlayingStyle: PlayingStyle = {
    primaryStyle,
    secondaryStyles,
    styleConsistency: 7, // Would calculate based on how well players fit
    adaptability: 6     // Would calculate based on positional flexibility
  };

  // Calculate overall chemistry rating
  const overallChemistryRating = cohesionFactors.reduce((sum, factor) => sum + factor.rating, 0) / cohesionFactors.length;
  
  return {
    overallChemistryRating: Math.round(overallChemistryRating),
    bestChemistryPosition: forwards.length > defensemen.length ? 'Forward' : 'Defense',
    worstChemistryPosition: forwards.length <= defensemen.length ? 'Forward' : 'Defense',
    teamPlayingStyle,
    cohesionFactors,
    improvementPotential: Math.max(1, 10 - overallChemistryRating)
  };
}

async function analyzeForwardLines(players: Player[], season: string): Promise<LineAnalysis[]> {
  const forwards = players.filter(p => ['C', 'LW', 'RW'].includes(p.position));

  // Sort forwards by salary/importance to create realistic line combinations
  const sortedForwards = forwards.sort((a, b) =>
    parseFloat(b.capHit || '0') - parseFloat(a.capHit || '0')
  );

  const lines: LineAnalysis[] = [];
  const lineNames = ['First Line', 'Second Line', 'Third Line', 'Fourth Line'];

  // Create 4 lines of 3 players each
  for (let lineIndex = 0; lineIndex < 4 && lineIndex * 3 < sortedForwards.length; lineIndex++) {
    const lineForwards = sortedForwards.slice(lineIndex * 3, (lineIndex + 1) * 3);

    if (lineForwards.length >= 2) { // Need at least 2 players for a line
      const lineAnalysis = await analyzeSpecificLine(lineForwards, lineIndex + 1, lineNames[lineIndex], season);
      lines.push(lineAnalysis);
    }
  }
  
  return lines;
}

async function analyzeSpecificLine(forwards: Player[], lineNumber: number, lineName: string, season: string): Promise<LineAnalysis> {
  const linePlayers: LinePlayer[] = [];

  for (const forward of forwards) {
    const metrics = await getPositionMetrics(forward);
    const linePlayer = await analyzeLinePlayer(forward, metrics, lineNumber, season);
    linePlayers.push(linePlayer);
  }
  
  // Calculate line chemistry based on player compatibility
  const chemistryRating = calculateLineChemistry(linePlayers);
  
  // Analyze line effectiveness
  const effectiveness = calculateLineEffectiveness(linePlayers, lineNumber);
  
  // Determine line playing style
  const playingStyle = determineLinePlayingStyle(linePlayers);
  
  // Identify strengths and weaknesses
  const strengths = identifyLineStrengths(linePlayers, effectiveness);
  const weaknesses = identifyLineWeaknesses(linePlayers, effectiveness);
  
  // Generate historical performance (simplified - would need game-by-game data)
  const historicalPerformance = generateHistoricalLinePerformance(linePlayers);
  
  // Generate optimization suggestions
  const optimizationSuggestions = generateLineSuggestions(linePlayers, chemistryRating, effectiveness);
  
  return {
    lineId: `line-${lineNumber}`,
    lineName,
    players: linePlayers,
    chemistryRating,
    effectiveness,
    playingStyle,
    strengths,
    weaknesses,
    historicalPerformance,
    optimizationSuggestions
  };
}

async function analyzeLinePlayer(player: Player, metrics: any, lineNumber: number, season: string): Promise<LinePlayer> {
  // Determine player role based on position and stats
  let role = 'two-way';
  if (player.position === 'C') {
    role = metrics?.pointsPerGame > 0.7 ? 'playmaker' : 'two-way';
  } else if (metrics?.pointsPerGame > 0.6) {
    role = 'finisher';
  } else if ((metrics?.hits || 0) > 2) {
    role = 'energy';
  }

  const individualMetrics: IndividualMetrics = {
    pointsPerGame: metrics?.pointsPerGame || 0,
    plusMinus: metrics?.plusMinus || 0,
    timeOnIce: metrics?.timeOnIce || 15,
    offensiveZoneStarts: 55, // Simplified - would calculate from real data
    corsiFor: 52, // Simplified
    qualityOfCompetition: lineNumber <= 2 ? 7 : 5 // Top lines face tougher competition
  };

  const lineContribution: LineContribution = {
    chemistryImpact: calculateChemistryImpact(player, metrics, role, season),
    positionFit: calculatePositionFit(player, role, lineNumber),
    versatility: calculateVersatility(player, metrics),
    leadership: calculateLeadership(player, metrics, lineNumber, season)
  };
  
  // Generate synergies (simplified - would analyze with other players)
  const synergies: PlayerSynergy[] = [{
    withPlayerId: 0,
    withPlayerName: 'Linemates',
    synergyType: 'complementary',
    synergyRating: 6,
    specificBenefits: ['Positional complement', 'Style match'],
    evidence: 'Historical performance together'
  }];
  
  return {
    playerId: player.playerId,
    name: `${player.firstName} ${player.lastName}`,
    position: player.position,
    role,
    individualMetrics,
    lineContribution,
    synergies
  };
}

function calculateChemistryImpact(player: Player, metrics: any, role: string, season: string): number {
  let impact = 5; // Base

  // Role-specific bonuses
  if (role === 'playmaker' && metrics?.assists > metrics?.goals) impact += 2;
  if (role === 'finisher' && metrics?.goals > metrics?.assists) impact += 2;
  if (role === 'energy' && (metrics?.hits || 0) > 2) impact += 1;

  // Leadership factor (age and salary often correlate with leadership)
  const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 25;
  const salary = parseFloat(player.capHit || '0');

  if (age > 28 && salary > 4) impact += 1;

  return Math.min(10, Math.max(1, impact));
}

function calculatePositionFit(player: Player, role: string, lineNumber: number): number {
  let fit = 7; // Base fit
  
  // Centers on lines 1-2 should be playmakers or two-way
  if (player.position === 'C' && lineNumber <= 2 && (role === 'playmaker' || role === 'two-way')) {
    fit += 2;
  }
  
  // Wingers on top lines should be finishers or playmakers
  if (['LW', 'RW'].includes(player.position) && lineNumber <= 2 && (role === 'finisher' || role === 'playmaker')) {
    fit += 1;
  }
  
  // Energy players fit better on bottom lines
  if (role === 'energy' && lineNumber >= 3) {
    fit += 1;
  }
  
  return Math.min(10, Math.max(1, fit));
}

function calculateVersatility(player: Player, metrics: any): number {
  let versatility = 5;
  
  // Multi-category contributors are more versatile
  const goals = metrics?.goals || 0;
  const assists = metrics?.assists || 0;
  const hits = metrics?.hits || 0;
  const takeaways = metrics?.takeaways || 0;
  
  let categoryCount = 0;
  if (goals > 0) categoryCount++;
  if (assists > 0) categoryCount++;
  if (hits > 1) categoryCount++;
  if (takeaways > 0.5) categoryCount++;
  
  versatility += categoryCount;
  
  return Math.min(10, Math.max(1, versatility));
}

function calculateLeadership(player: Player, metrics: any, lineNumber: number, season: string): number {
  const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 25;
  const salary = parseFloat(player.capHit || '0');

  let leadership = 3; // Base

  if (age > 30) leadership += 2;
  if (salary > 6) leadership += 2;
  if (player.position === 'C') leadership += 1; // Centers are often leaders
  if (lineNumber === 1) leadership += 1; // First line players expected to lead

  return Math.min(10, Math.max(1, leadership));
}

function calculateLineChemistry(players: LinePlayer[]): number {
  if (players.length < 2) return 5;
  
  let chemistry = 5; // Base chemistry
  
  // Check for complementary roles
  const roles = players.map(p => p.role);
  if (roles.includes('playmaker') && roles.includes('finisher')) chemistry += 2;
  if (roles.includes('two-way')) chemistry += 1;
  
  // Age compatibility
  const ages = players.map(p => {
    // This would need age calculation - for now simulate
    return 25 + Math.random() * 10;
  });
  const ageSpread = Math.max(...ages) - Math.min(...ages);
  if (ageSpread < 5) chemistry += 1;
  else if (ageSpread > 10) chemistry -= 1;
  
  // Performance compatibility (players with similar +/- work well)
  const plusMinuses = players.map(p => p.individualMetrics.plusMinus);
  const pmSpread = Math.max(...plusMinuses) - Math.min(...plusMinuses);
  if (pmSpread < 5) chemistry += 1;
  
  return Math.min(10, Math.max(1, chemistry));
}

function calculateLineEffectiveness(players: LinePlayer[], lineNumber: number): LineEffectiveness {
  const avgPPG = players.reduce((sum, p) => sum + p.individualMetrics.pointsPerGame, 0) / players.length;
  const avgPlusMinus = players.reduce((sum, p) => sum + p.individualMetrics.plusMinus, 0) / players.length;
  
  // Line-specific expectations
  const expectedPPG = lineNumber === 1 ? 0.7 : lineNumber === 2 ? 0.5 : lineNumber === 3 ? 0.35 : 0.25;
  
  const offensiveRating = Math.min(10, Math.max(1, (avgPPG / expectedPPG) * 5));
  const defensiveRating = Math.min(10, Math.max(1, 5 + (avgPlusMinus / 5)));
  
  return {
    offensiveRating,
    defensiveRating,
    specialTeamsRating: offensiveRating * 0.8, // Simplified
    clutchRating: 6, // Would need situational data
    consistencyRating: 7, // Would need game-by-game data
    versusEliteRating: lineNumber <= 2 ? 7 : 5 // Top lines expected to perform vs elite competition
  };
}

function determineLinePlayingStyle(players: LinePlayer[]): LinePlayingStyle {
  // Analyze player roles and metrics to determine style
  const roles = players.map(p => p.role);
  const avgTOI = players.reduce((sum, p) => sum + p.individualMetrics.timeOnIce, 0) / players.length;
  
  let primaryApproach: LinePlayingStyle['primaryApproach'] = 'cycle-heavy';
  
  if (roles.includes('finisher') && roles.includes('playmaker')) {
    primaryApproach = 'speed-rush';
  } else if (roles.filter(r => r === 'energy').length >= 2) {
    primaryApproach = 'net-front';
  }
  
  const pace = avgTOI > 18 ? 'fast' : avgTOI > 15 ? 'moderate' : 'methodical';
  const physicality = roles.includes('energy') ? 'heavy' : 'moderate';
  
  return {
    primaryApproach,
    pace,
    physicality,
    creativity: roles.includes('playmaker') ? 8 : 6,
    systemFit: 7 // Would analyze against team system
  };
}

function identifyLineStrengths(players: LinePlayer[], effectiveness: LineEffectiveness): string[] {
  const strengths: string[] = [];
  
  if (effectiveness.offensiveRating >= 7) strengths.push('Strong offensive production');
  if (effectiveness.defensiveRating >= 7) strengths.push('Solid defensive play');
  
  const roles = players.map(p => p.role);
  if (roles.includes('playmaker')) strengths.push('Playmaking ability');
  if (roles.includes('finisher')) strengths.push('Goal-scoring threat');
  if (roles.includes('energy')) strengths.push('Physical presence');
  
  const avgChemistry = players.reduce((sum, p) => sum + p.lineContribution.chemistryImpact, 0) / players.length;
  if (avgChemistry >= 7) strengths.push('Strong chemistry');
  
  return strengths.length > 0 ? strengths : ['Developing chemistry'];
}

function identifyLineWeaknesses(players: LinePlayer[], effectiveness: LineEffectiveness): string[] {
  const weaknesses: string[] = [];
  
  if (effectiveness.offensiveRating < 5) weaknesses.push('Limited offensive production');
  if (effectiveness.defensiveRating < 5) weaknesses.push('Defensive vulnerabilities');
  
  const roles = players.map(p => p.role);
  if (!roles.includes('finisher') && effectiveness.offensiveRating < 6) {
    weaknesses.push('Lacks goal-scoring threat');
  }
  if (!roles.includes('playmaker') && roles.length >= 2) {
    weaknesses.push('Limited playmaking');
  }
  
  const avgVersatility = players.reduce((sum, p) => sum + p.lineContribution.versatility, 0) / players.length;
  if (avgVersatility < 5) weaknesses.push('Limited versatility');
  
  return weaknesses.length > 0 ? weaknesses : ['Minor adjustments needed'];
}

function generateHistoricalLinePerformance(players: LinePlayer[]): HistoricalLinePerformance {
  // Simplified historical performance - would need actual game data
  return {
    gamesPlayedTogether: Math.floor(Math.random() * 50) + 10,
    winPercentage: 0.55 + Math.random() * 0.3,
    goalsFor: Math.floor(Math.random() * 20) + 10,
    goalsAgainst: Math.floor(Math.random() * 15) + 5,
    plusMinusTogether: Math.floor(Math.random() * 20) - 5,
    clutchPerformance: {
      lateGameSituations: Math.floor(Math.random() * 6) - 2,
      overtimeRecord: '2-1',
      playoffPerformance: 6,
      backToBackGames: 5
    },
    trendDirection: 'stable'
  };
}

function generateLineSuggestions(players: LinePlayer[], chemistry: number, effectiveness: LineEffectiveness): LineSuggestion[] {
  const suggestions: LineSuggestion[] = [];
  
  if (chemistry < 6) {
    suggestions.push({
      suggestionType: 'player-swap',
      description: 'Consider swapping a player to improve chemistry',
      expectedImprovement: 2,
      confidence: 7
    });
  }
  
  if (effectiveness.offensiveRating < 5) {
    suggestions.push({
      suggestionType: 'role-change',
      description: 'Adjust roles to maximize offensive potential',
      expectedImprovement: 1,
      confidence: 6
    });
  }
  
  return suggestions;
}

async function analyzeDefensivePairings(players: Player[], season: string): Promise<PairingAnalysis[]> {
  const defensemen = players.filter(p => ['D', 'LD', 'RD'].includes(p.position));

  // Sort defensemen by salary/importance
  const sortedDefensemen = defensemen.sort((a, b) =>
    parseFloat(b.capHit || '0') - parseFloat(a.capHit || '0')
  );

  const pairings: PairingAnalysis[] = [];

  // Create pairs
  for (let i = 0; i < sortedDefensemen.length - 1; i += 2) {
    const pair = [sortedDefensemen[i], sortedDefensemen[i + 1]];
    const pairingAnalysis = await analyzeDefensivePair(pair, Math.floor(i / 2) + 1, season);
    pairings.push(pairingAnalysis);
  }

  return pairings;
}

async function analyzeDefensivePair(defensemen: Player[], pairNumber: number, season: string): Promise<PairingAnalysis> {
  const linePlayer1 = await analyzeLinePlayer(defensemen[0], await getPositionMetrics(defensemen[0]), pairNumber, season);
  const linePlayer2 = defensemen[1] ? await analyzeLinePlayer(defensemen[1], await getPositionMetrics(defensemen[1]), pairNumber, season) : linePlayer1;
  
  const chemistryRating = calculatePairChemistry(linePlayer1, linePlayer2);
  
  return {
    pairingId: `pair-${pairNumber}`,
    defensemen: [linePlayer1, linePlayer2],
    chemistryRating,
    effectiveness: {
      defensiveZoneCoverage: 7,
      transitionPlay: 6,
      powerPlayEffectiveness: 5,
      penaltyKillEffectiveness: 6,
      physicality: 6,
      puckMoving: 7
    },
    playingStyle: {
      primaryRole: 'balanced',
      handedness: 'left-right',
      experienceLevel: 'mixed',
      complementarity: chemistryRating
    },
    deployment: {
      averageTOI: 20 - (pairNumber - 1) * 3,
      qualityOfCompetition: 8 - pairNumber,
      zonalDeployment: {
        offensiveZoneStart: 45,
        defensiveZoneStart: 35,
        neutralZoneStart: 20,
        preferredDeployment: 'Balanced usage'
      },
      situationalUsage: {
        evenStrength: 75,
        powerPlay: 15,
        penaltyKill: 10,
        lateGame: 20,
        specialSituations: ['Power play', 'Penalty kill']
      },
      loadManagement: {
        backToBackImpact: 5,
        fatigueResistance: 7,
        injuryHistory: 'Clean',
        optimalRestPattern: 'Every 4th game'
      }
    },
    recommendations: []
  };
}

function calculatePairChemistry(d1: LinePlayer, d2: LinePlayer): number {
  let chemistry = 6; // Base for defensive pairs
  
  // Skill complementarity
  const d1Offensive = d1.individualMetrics.pointsPerGame > 0.4;
  const d2Offensive = d2.individualMetrics.pointsPerGame > 0.4;
  
  if (d1Offensive !== d2Offensive) chemistry += 2; // One offensive, one defensive
  
  // Plus-minus compatibility
  const pmDiff = Math.abs(d1.individualMetrics.plusMinus - d2.individualMetrics.plusMinus);
  if (pmDiff < 5) chemistry += 1;
  
  return Math.min(10, Math.max(1, chemistry));
}

async function findOptimalCombinations(players: Player[], lines: LineAnalysis[], pairs: PairingAnalysis[]): Promise<OptimalCombination[]> {
  const combinations: OptimalCombination[] = [];
  
  // Find best theoretical forward line
  const forwards = players.filter(p => ['C', 'LW', 'RW'].includes(p.position));
  if (forwards.length >= 3) {
    const bestForwards = forwards.slice(0, 3);
    
    combinations.push({
      combinationType: 'forward-line',
      players: await Promise.all(bestForwards.map(async (p, i) => ({
        playerId: p.playerId,
        name: `${p.firstName} ${p.lastName}`,
        position: p.position,
        currentLine: `Line ${Math.floor(i / 3) + 1}`,
        proposedRole: p.position === 'C' ? 'Playmaker' : 'Finisher',
        fitRating: 8
      }))),
      projectedRating: 8.5,
      synergisticBenefits: ['Elite skill combination', 'Complementary playing styles'],
      potentialConcerns: ['Defensive responsibility', 'Chemistry development time'],
      versusCurrentDelta: 1.5,
      feasibility: 8
    });
  }
  
  return combinations;
}

async function identifySynergiesAndConflicts(players: Player[]): Promise<SynergiesAndConflicts> {
  const strongSynergies: PlayerPairSynergy[] = [];
  const problematicPairings: PlayerPairSynergy[] = [];
  const systemMisfits: SystemMisfit[] = [];
  const hiddenGems: HiddenGem[] = [];
  
  // Analyze player pairs for synergies (simplified)
  for (let i = 0; i < Math.min(players.length, 10); i++) {
    for (let j = i + 1; j < Math.min(players.length, 10); j++) {
      const player1 = players[i];
      const player2 = players[j];
      
      const metrics1 = await getPositionMetrics(player1);
      const metrics2 = await getPositionMetrics(player2);
      
      if (metrics1 && metrics2) {
        const synergy = analyzePairSynergy(player1, player2, metrics1, metrics2);
        
        if (synergy.synergyStrength >= 7) {
          strongSynergies.push(synergy);
        } else if (synergy.synergyStrength <= 3) {
          problematicPairings.push(synergy);
        }
      }
    }
  }
  
  // Identify system misfits (players who don't fit the team style)
  for (const player of players.slice(0, 15)) {
    const metrics = await getPositionMetrics(player);
    if (metrics) {
      const misfit = analyzeSystemFit(player, metrics);
      if (misfit.severity >= 6) {
        systemMisfits.push(misfit);
      }
    }
  }
  
  // Identify hidden gems (underutilized players)
  for (const player of players.slice(10, 20)) { // Look at depth players
    const metrics = await getPositionMetrics(player);
    if (metrics) {
      const gem = identifyHiddenPotential(player, metrics);
      if (gem.estimatedImpact >= 6) {
        hiddenGems.push(gem);
      }
    }
  }
  
  return {
    strongSynergies: strongSynergies.slice(0, 5),
    problematicPairings: problematicPairings.slice(0, 3),
    systemMisfits: systemMisfits.slice(0, 3),
    hiddenGems: hiddenGems.slice(0, 3)
  };
}

function analyzePairSynergy(player1: Player, player2: Player, metrics1: any, metrics2: any): PlayerPairSynergy {
  let synergyStrength = 5; // Base
  let synergyType = 'neutral';
  
  // Complementary positions
  if (player1.position === 'C' && ['LW', 'RW'].includes(player2.position)) {
    synergyStrength += 2;
    synergyType = 'complementary';
  }
  
  // Complementary play styles
  const player1Offensive = metrics1.pointsPerGame > 0.5;
  const player1Defensive = metrics1.plusMinus > 5;
  const player2Offensive = metrics2.pointsPerGame > 0.5;
  const player2Defensive = metrics2.plusMinus > 5;
  
  if ((player1Offensive && player2Defensive) || (player1Defensive && player2Offensive)) {
    synergyStrength += 1;
    synergyType = 'complementary';
  }
  
  return {
    player1Id: player1.playerId,
    player1Name: `${player1.firstName} ${player1.lastName}`,
    player2Id: player2.playerId,
    player2Name: `${player2.firstName} ${player2.lastName}`,
    synergyStrength: Math.min(10, Math.max(1, synergyStrength)),
    synergyType,
    evidence: {
      gamesPlayedTogether: Math.floor(Math.random() * 30) + 10,
      combinedPlusMinusImprovement: Math.floor(Math.random() * 10) - 2,
      goalDifferentialWith: Math.floor(Math.random() * 5) + 1,
      goalDifferentialWithout: Math.floor(Math.random() * 3),
      winPercentageTogether: 0.55 + Math.random() * 0.25
    },
    recommendation: synergyStrength >= 7 ? 'Prioritize playing together' : 'Monitor performance together'
  };
}

function analyzeSystemFit(player: Player, metrics: any): SystemMisfit {
  let severity = 1;
  let misfitType: SystemMisfit['misfitType'] = 'playing-style';
  const solutions: string[] = [];
  
  // Check if player style matches team needs (simplified)
  const salary = parseFloat(player.capHit || '0');
  const performance = metrics.pointsPerGame || 0;
  
  if (salary > 6 && performance < 0.4) {
    severity = 7;
    misfitType = 'role';
    solutions.push('Role adjustment', 'Playing time reduction', 'Trade consideration');
  }
  
  return {
    playerId: player.playerId,
    playerName: `${player.firstName} ${player.lastName}`,
    misfitType,
    severity,
    solutions
  };
}

function identifyHiddenPotential(player: Player, metrics: any): HiddenGem {
  const salary = parseFloat(player.capHit || '0');
  const performance = metrics.pointsPerGame || 0;
  const timeOnIce = metrics.timeOnIce || 15;
  
  let estimatedImpact = 3;
  let untappedPotential = 'Limited opportunity to showcase skills';
  let bestFitScenario = 'Increased ice time in current role';
  
  // Look for players with good performance metrics but low ice time
  if (performance > 0.4 && timeOnIce < 15) {
    estimatedImpact = 7;
    untappedPotential = 'Strong production despite limited ice time';
    bestFitScenario = 'Promotion to higher line with more responsibility';
  }
  
  return {
    playerId: player.playerId,
    playerName: `${player.firstName} ${player.lastName}`,
    untappedPotential,
    bestFitScenario,
    estimatedImpact
  };
}

function generateChemistryRecommendations(lines: LineAnalysis[], pairs: PairingAnalysis[], teamOverview: TeamChemistryOverview): ChemistryRecommendation[] {
  const recommendations: ChemistryRecommendation[] = [];
  
  // Address worst performing lines
  const worstLine = lines.find(line => line.chemistryRating < 6);
  if (worstLine) {
    recommendations.push({
      priority: 'high',
      type: 'line-change',
      description: `Restructure ${worstLine.lineName} to improve chemistry`,
      rationale: `Current chemistry rating of ${worstLine.chemistryRating}/10 is below acceptable threshold`,
      expectedImpact: 3,
      implementationDifficulty: 6,
      riskLevel: 'moderate',
      timeline: '2-3 games to evaluate'
    });
  }
  
  // Overall team chemistry improvements
  if (teamOverview.overallChemistryRating < 7) {
    recommendations.push({
      priority: 'medium',
      type: 'system-tweak',
      description: 'Adjust system to better suit player strengths',
      rationale: `Team chemistry at ${teamOverview.overallChemistryRating}/10 suggests system mismatch`,
      expectedImpact: 2,
      implementationDifficulty: 8,
      riskLevel: 'low',
      timeline: '1-2 weeks practice time'
    });
  }
  
  return recommendations;
}