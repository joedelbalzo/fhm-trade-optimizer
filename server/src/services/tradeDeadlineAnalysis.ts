// Trade Deadline Analysis - Rental vs Long-term Value System
import { Op } from 'sequelize';
import { Team, Player, PlayerSeasonStat } from '../models/index.js';
import { getPositionMetrics } from './hockeyAnalysis.js';
import { currentSeason, calculatePlayerAgeSync } from './scoring.js';

interface TradeDeadlineProfile {
  teamStatus: TeamCompetitiveStatus;
  tradeStrategy: TradeStrategy;
  rentalTargets: RentalTarget[];
  longTermTargets: LongTermTarget[];
  sellCandidates: SellCandidate[];
  assetValuation: AssetValuation;
  recommendations: DeadlineRecommendation[];
  marketAnalysis: MarketAnalysis;
}

interface TeamCompetitiveStatus {
  playoffPosition: 'guaranteed' | 'likely' | 'bubble' | 'longshot' | 'eliminated';
  playoffProbability: number; // 0-100%
  competitiveWindow: 'peak' | 'opening' | 'closing' | 'future';
  urgency: 'win-now' | 'improve' | 'neutral' | 'develop' | 'rebuild';
  keyFactors: string[];
  seasonOutlook: string;
}

interface TradeStrategy {
  primaryApproach: 'aggressive-buyer' | 'selective-buyer' | 'neutral' | 'selective-seller' | 'rebuild-seller';
  riskTolerance: 'high' | 'medium' | 'low';
  assetWillingness: 'all-in' | 'moderate' | 'conservative';
  targetTypes: ('rental' | 'term' | 'youth')[];
  budgetConstraints: BudgetConstraints;
}

interface BudgetConstraints {
  maxSalaryAddition: number;
  capSpaceAvailable: number;
  ltirSpace: number;
  retentionSlots: number;
  preferredTermLength: number; // Years
}

interface RentalTarget {
  playerId: number;
  name: string;
  position: string;
  team: string;
  currentSalary: number;
  deadlineValue: number; // Trade value at deadline
  skillSet: string[];
  fit: 'perfect' | 'good' | 'acceptable' | 'questionable';
  impact: ImpactProjection;
  acquisitionCost: AcquisitionCost;
  riskAssessment: RiskAssessment;
  alternativeOptions: string[];
}

interface LongTermTarget {
  playerId: number;
  name: string;
  position: string;
  team: string;
  age: number;
  contractStatus: ContractStatus;
  skillSet: string[];
  developmentTrajectory: 'ascending' | 'peak' | 'stable' | 'declining';
  longTermValue: number;
  acquisitionCost: AcquisitionCost;
  sustainability: SustainabilityAnalysis;
}

interface ContractStatus {
  yearsRemaining: number;
  annualValue: number;
  contractType: 'elc' | 'bridge' | 'ufa' | 'rfa' | 'extension';
  tradeRestrictions: string[];
}

interface SustainabilityAnalysis {
  ageAtContractEnd: number;
  projectedPerformance: number; // 1-10 throughout contract
  injuryRisk: 'low' | 'moderate' | 'high';
  contractValue: 'excellent' | 'good' | 'fair' | 'overpaid';
  resignability: number; // 0-100% chance of extending
}

interface SellCandidate {
  playerId: number;
  name: string;
  position: string;
  currentValue: number;
  deadlineValue: number;
  contractStatus: ContractStatus;
  sellRationale: string[];
  targetReturnType: 'picks' | 'prospects' | 'young-players' | 'cap-relief';
  urgency: 'immediate' | 'high' | 'moderate' | 'conditional';
  marketDemand: 'high' | 'medium' | 'low';
}

interface ImpactProjection {
  offensiveImpact: number; // Expected points added
  defensiveImpact: number; // Plus-minus improvement
  specialTeamsImpact: number; // PP/PK contribution
  intangibleImpact: string; // Leadership, experience, etc.
  playoffImpact: number; // 1-10 playoff performance boost
  overallRating: number; // 1-10 total impact
}

interface AcquisitionCost {
  estimatedAssets: string[];
  salaryRetention: number; // % retained by selling team
  alternativeCosts: string[];
  competitionLevel: 'high' | 'medium' | 'low';
  priceRange: [number, number]; // Min-max in trade value points
}

interface RiskAssessment {
  overallRisk: 'low' | 'moderate' | 'high' | 'extreme';
  riskFactors: RiskFactor[];
  mitigation: string[];
  successProbability: number; // 0-100%
}

interface RiskFactor {
  category: 'injury' | 'performance' | 'chemistry' | 'contract' | 'market';
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  probability: number; // 0-100%
}

interface AssetValuation {
  tradableAssets: TradableAsset[];
  untouchables: Player[];
  assetRanking: AssetRank[];
  draftCapital: DraftCapital;
  totalTradeValue: number;
}

interface TradableAsset {
  playerId: number;
  name: string;
  assetType: 'roster-player' | 'prospect' | 'pick';
  tradeValue: number;
  demandLevel: 'high' | 'medium' | 'low';
  tradingRecommendation: 'available' | 'conditional' | 'retain';
  reasoningForValue: string;
}

interface AssetRank {
  rank: number;
  asset: string;
  value: number;
  tradability: number; // 1-10
  replacement: string;
}

interface DraftCapital {
  upcomingPicks: DraftPick[];
  totalPickValue: number;
  tradingFlexibility: number; // 1-10
}

interface DraftPick {
  year: number;
  round: number;
  estimatedPosition: number;
  tradeValue: number;
  conditional: boolean;
}

interface DeadlineRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  timeline: string;
  alternatives: string[];
  successMetrics: string[];
  riskMitigation: string[];
}

interface MarketAnalysis {
  availableRentals: MarketPlayer[];
  availableLongTerm: MarketPlayer[];
  marketTrends: MarketTrend[];
  competitorAnalysis: CompetitorAnalysis[];
  timingRecommendations: string[];
}

interface MarketPlayer {
  name: string;
  position: string;
  team: string;
  availability: 'confirmed' | 'rumored' | 'possible' | 'unlikely';
  estimatedCost: string;
  competition: string[];
}

interface MarketTrend {
  position: string;
  trend: 'seller-market' | 'buyer-market' | 'balanced';
  priceDirection: 'rising' | 'stable' | 'falling';
  reasoning: string;
}

interface CompetitorAnalysis {
  team: string;
  status: 'buyer' | 'seller' | 'neutral';
  needs: string[];
  assets: string[];
  likelihood: number; // 0-100% chance of major move
}

export async function analyzeTradeDeadline(teamAbbrev: string): Promise<TradeDeadlineProfile> {
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
    // Explicitly include all Player attributes to ensure dateOfBirth is loaded
    attributes: [
      'id', 'playerId', 'teamId', 'franchiseId', 'firstName', 'lastName',
      'nickName', 'height', 'weight', 'dateOfBirth', 'birthCity', 'birthState',
      'nationalityOne', 'nationalityTwo', 'nationalityThree', 'retired',
      'position', 'rfaUfa', 'yearsLeft', 'capHit'
    ],
    include: [{ model: Team, as: 'team' }]
  });

  const teamStatus = await analyzeCompetitiveStatus(team, players, season);
  const tradeStrategy = determineTradeStrategy(teamStatus);
  const assetValuation = await evaluateAssets(players, season);
  
  let rentalTargets: RentalTarget[] = [];
  let longTermTargets: LongTermTarget[] = [];
  let sellCandidates: SellCandidate[] = [];

  if (tradeStrategy.primaryApproach.includes('buyer')) {
    rentalTargets = await identifyRentalTargets(teamStatus, tradeStrategy, players);
    longTermTargets = await identifyLongTermTargets(teamStatus, tradeStrategy, players);
  } else if (tradeStrategy.primaryApproach.includes('seller')) {
    sellCandidates = await identifySellCandidates(players, teamStatus, season);
  }

  const recommendations = generateDeadlineRecommendations(teamStatus, tradeStrategy, assetValuation);
  const marketAnalysis = analyzeMarketConditions(tradeStrategy.primaryApproach);

  return {
    teamStatus,
    tradeStrategy,
    rentalTargets,
    longTermTargets,
    sellCandidates,
    assetValuation,
    recommendations,
    marketAnalysis
  };
}

async function analyzeCompetitiveStatus(team: Team, players: Player[], season: string): Promise<TeamCompetitiveStatus> {
  // This would typically use standings data - for now we'll simulate based on team quality
  const teamQuality = await calculateTeamQuality(players);

  let playoffPosition: TeamCompetitiveStatus['playoffPosition'] = 'bubble';
  let playoffProbability = 50;

  if (teamQuality >= 8) {
    playoffPosition = 'guaranteed';
    playoffProbability = 95;
  } else if (teamQuality >= 7) {
    playoffPosition = 'likely';
    playoffProbability = 75;
  } else if (teamQuality >= 5.5) {
    playoffPosition = 'bubble';
    playoffProbability = 45;
  } else if (teamQuality >= 4) {
    playoffPosition = 'longshot';
    playoffProbability = 15;
  } else {
    playoffPosition = 'eliminated';
    playoffProbability = 5;
  }

  // Determine competitive window based on core age
  const coreAges = players
    .filter(p => parseFloat(p.capHit || '0') > 4.0)
    .map(p => calculatePlayerAgeSync(p.dateOfBirth, season) ?? 30);
  
  const avgCoreAge = coreAges.reduce((sum, age) => sum + age, 0) / coreAges.length;
  
  let competitiveWindow: TeamCompetitiveStatus['competitiveWindow'];
  if (avgCoreAge < 26) competitiveWindow = 'opening';
  else if (avgCoreAge <= 28) competitiveWindow = 'peak';
  else if (avgCoreAge <= 31) competitiveWindow = 'closing';
  else competitiveWindow = 'future';

  // Determine urgency
  let urgency: TeamCompetitiveStatus['urgency'] = 'neutral';
  if (playoffPosition === 'guaranteed' && competitiveWindow === 'peak') {
    urgency = 'win-now';
  } else if (playoffPosition === 'likely' || playoffPosition === 'bubble') {
    urgency = 'improve';
  } else if (competitiveWindow === 'future') {
    urgency = 'rebuild';
  } else {
    urgency = 'develop';
  }

  const keyFactors = [
    `Team quality: ${teamQuality.toFixed(1)}/10`,
    `Core age: ${avgCoreAge.toFixed(1)} years`,
    `Playoff probability: ${playoffProbability}%`
  ];

  const seasonOutlook = generateSeasonOutlook(playoffPosition, competitiveWindow, urgency);

  return {
    playoffPosition,
    playoffProbability,
    competitiveWindow,
    urgency,
    keyFactors,
    seasonOutlook
  };
}

async function calculateTeamQuality(players: Player[]): Promise<number> {
  let totalQuality = 0;
  let playerCount = 0;

  for (const player of players) {
    const metrics = await getPositionMetrics(player);
    if (metrics) {
      const salary = parseFloat(player.capHit || '0');
      const performance = metrics.pointsPerGame * 10 + Math.max(0, metrics.plusMinus);
      const quality = Math.min(10, (salary + performance) / 2);
      totalQuality += quality;
      playerCount++;
    }
  }

  return playerCount > 0 ? totalQuality / playerCount : 5;
}

function generateSeasonOutlook(position: string, window: string, urgency: string): string {
  if (urgency === 'win-now') {
    return 'Championship window - all-in approach justified';
  } else if (urgency === 'improve') {
    return 'Playoff contender - selective improvements needed';
  } else if (urgency === 'develop') {
    return 'Development year - balance present and future';
  } else if (urgency === 'rebuild') {
    return 'Asset accumulation phase - sell high-value pieces';
  } else {
    return 'Evaluation period - assess core and direction';
  }
}

function determineTradeStrategy(status: TeamCompetitiveStatus): TradeStrategy {
  let primaryApproach: TradeStrategy['primaryApproach'];
  let riskTolerance: TradeStrategy['riskTolerance'];
  let assetWillingness: TradeStrategy['assetWillingness'];

  switch (status.urgency) {
    case 'win-now':
      primaryApproach = 'aggressive-buyer';
      riskTolerance = 'high';
      assetWillingness = 'all-in';
      break;
    case 'improve':
      primaryApproach = status.playoffProbability > 60 ? 'selective-buyer' : 'neutral';
      riskTolerance = 'medium';
      assetWillingness = 'moderate';
      break;
    case 'rebuild':
      primaryApproach = 'rebuild-seller';
      riskTolerance = 'low';
      assetWillingness = 'conservative';
      break;
    case 'develop':
      primaryApproach = 'selective-seller';
      riskTolerance = 'low';
      assetWillingness = 'conservative';
      break;
    default:
      primaryApproach = 'neutral';
      riskTolerance = 'medium';
      assetWillingness = 'moderate';
  }

  const targetTypes: TradeStrategy['targetTypes'] = [];
  if (primaryApproach.includes('buyer')) {
    if (status.competitiveWindow === 'peak' || status.competitiveWindow === 'closing') {
      targetTypes.push('rental');
    } else {
      targetTypes.push('term', 'youth');
    }
  }

  return {
    primaryApproach,
    riskTolerance,
    assetWillingness,
    targetTypes,
    budgetConstraints: {
      maxSalaryAddition: assetWillingness === 'all-in' ? 8.0 : assetWillingness === 'moderate' ? 4.0 : 2.0,
      capSpaceAvailable: 5.0, // Simplified - would calculate actual cap space
      ltirSpace: 0,
      retentionSlots: 3,
      preferredTermLength: status.competitiveWindow === 'opening' ? 5 : 2
    }
  };
}

async function evaluateAssets(players: Player[], season: string): Promise<AssetValuation> {
  const tradableAssets: TradableAsset[] = [];
  const untouchables: Player[] = [];

  // Evaluate each player as a potential trade asset
  for (const player of players) {
    const metrics = await getPositionMetrics(player);
    const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
    const salary = parseFloat(player.capHit || '0');

    const tradeValue = calculateTradeValue(player, metrics, age, salary);
    
    if (tradeValue.value > 20) { // Significant trade value
      if (tradeValue.demandLevel === 'high' && age < 26 && salary > 6) {
        untouchables.push(player); // Young stars are typically untouchable
      } else {
        tradableAssets.push({
          playerId: player.playerId,
          name: `${player.firstName} ${player.lastName}`,
          assetType: 'roster-player',
          tradeValue: tradeValue.value,
          demandLevel: tradeValue.demandLevel,
          tradingRecommendation: tradeValue.recommendation,
          reasoningForValue: tradeValue.reasoning
        });
      }
    }
  }

  // Add draft picks (simplified)
  const draftCapital: DraftCapital = {
    upcomingPicks: [
      { year: 2025, round: 1, estimatedPosition: 20, tradeValue: 100, conditional: false },
      { year: 2025, round: 2, estimatedPosition: 50, tradeValue: 50, conditional: false },
      { year: 2025, round: 3, estimatedPosition: 80, tradeValue: 25, conditional: false }
    ],
    totalPickValue: 175,
    tradingFlexibility: 8
  };

  // Create asset ranking
  const allAssets = [...tradableAssets, ...draftCapital.upcomingPicks.map(pick => ({
    playerId: 0,
    name: `${pick.year} ${pick.round}${pick.round === 1 ? 'st' : pick.round === 2 ? 'nd' : 'rd'} Round Pick`,
    assetType: 'pick' as const,
    tradeValue: pick.tradeValue,
    demandLevel: 'medium' as const,
    tradingRecommendation: 'available' as const,
    reasoningForValue: `Draft pick value based on estimated position ${pick.estimatedPosition}`
  }))];

  const assetRanking = allAssets
    .sort((a, b) => b.tradeValue - a.tradeValue)
    .map((asset, index) => ({
      rank: index + 1,
      asset: asset.name,
      value: asset.tradeValue,
      tradability: asset.assetType === 'pick' ? 10 : 7,
      replacement: asset.assetType === 'roster-player' ? 'Internal promotion/Free agency' : 'Future draft'
    }));

  return {
    tradableAssets,
    untouchables,
    assetRanking,
    draftCapital,
    totalTradeValue: allAssets.reduce((sum, asset) => sum + asset.tradeValue, 0)
  };
}

function calculateTradeValue(player: Player, metrics: any, age: number, salary: number) {
  let value = 30; // Base value
  let demandLevel: 'high' | 'medium' | 'low' = 'medium';
  let recommendation: 'available' | 'conditional' | 'retain' = 'conditional';
  
  // Performance factor
  if (metrics) {
    const performance = metrics.pointsPerGame * 10 + Math.max(0, metrics.plusMinus);
    value += performance;
  }
  
  // Age factor
  if (age < 26) value += 20; // Young player premium
  else if (age > 32) value -= 15; // Aging discount
  
  // Salary factor
  if (salary > 8) value -= 10; // Expensive players harder to trade
  else if (salary < 2) value += 10; // Cheap players valuable
  
  // Contract factor (simplified)
  const contractYears = Math.floor(Math.random() * 4) + 1; // 1-4 years
  if (contractYears > 2) value += 10; // Term adds value
  
  // Determine demand level
  if (value > 80) demandLevel = 'high';
  else if (value < 40) demandLevel = 'low';
  
  // Trading recommendation
  if (age > 30 && salary > 5) recommendation = 'available';
  else if (age < 25 && value > 60) recommendation = 'retain';
  else recommendation = 'conditional';

  const reasoning = `Age ${age}, $${salary}M salary, ${metrics?.pointsPerGame.toFixed(2) || 'unknown'} PPG`;

  return {
    value: Math.max(10, Math.min(150, value)),
    demandLevel,
    recommendation,
    reasoning
  };
}

async function identifyRentalTargets(status: TeamCompetitiveStatus, strategy: TradeStrategy, players: Player[]): Promise<RentalTarget[]> {
  // This would query league-wide data for expiring contracts
  // For now, simulate rental targets based on team needs
  
  const teamNeeds = await identifyTeamNeeds(players);
  const mockRentals: RentalTarget[] = [];
  
  // Generate mock rental targets for each need
  for (const need of teamNeeds.slice(0, 5)) {
    const rental: RentalTarget = {
      playerId: Math.floor(Math.random() * 1000),
      name: `Rental ${need.position}`,
      position: need.position,
      team: 'OTT', // Mock selling team
      currentSalary: need.estimatedSalary,
      deadlineValue: 75,
      skillSet: [`${need.position} specialist`, 'Playoff experience', 'Leadership'],
      fit: need.priority === 'critical' ? 'perfect' : 'good',
      impact: {
        offensiveImpact: need.position.includes('D') ? 2 : 8,
        defensiveImpact: need.position === 'G' ? 10 : 4,
        specialTeamsImpact: 6,
        intangibleImpact: 'Veteran presence',
        playoffImpact: 7,
        overallRating: 7
      },
      acquisitionCost: {
        estimatedAssets: ['2nd round pick', 'Prospect'],
        salaryRetention: 25,
        alternativeCosts: ['1st + 3rd', '2nd + player'],
        competitionLevel: 'medium',
        priceRange: [40, 80]
      },
      riskAssessment: {
        overallRisk: 'moderate',
        riskFactors: [
          {
            category: 'performance',
            description: 'May not fit team system',
            severity: 'moderate',
            probability: 30
          }
        ],
        mitigation: ['Pre-trade scouting', 'System integration'],
        successProbability: 70
      },
      alternativeOptions: [`Internal promotion`, `Different ${need.position}`]
    };
    
    mockRentals.push(rental);
  }
  
  return mockRentals;
}

async function identifyLongTermTargets(status: TeamCompetitiveStatus, strategy: TradeStrategy, players: Player[]): Promise<LongTermTarget[]> {
  // Mock long-term targets based on team building needs
  const mockTargets: LongTermTarget[] = [
    {
      playerId: Math.floor(Math.random() * 1000),
      name: 'Young Core Player',
      position: 'C',
      team: 'BUF',
      age: 24,
      contractStatus: {
        yearsRemaining: 3,
        annualValue: 5.5,
        contractType: 'ufa',
        tradeRestrictions: []
      },
      skillSet: ['Elite faceoffs', 'Two-way play', 'Leadership'],
      developmentTrajectory: 'ascending',
      longTermValue: 120,
      acquisitionCost: {
        estimatedAssets: ['1st round pick', 'Top prospect', 'Roster player'],
        salaryRetention: 0,
        alternativeCosts: ['Multiple 1sts', '1st + multiple prospects'],
        competitionLevel: 'high',
        priceRange: [100, 150]
      },
      sustainability: {
        ageAtContractEnd: 27,
        projectedPerformance: 8,
        injuryRisk: 'low',
        contractValue: 'good',
        resignability: 80
      }
    }
  ];
  
  return mockTargets;
}

async function identifySellCandidates(players: Player[], status: TeamCompetitiveStatus, season: string): Promise<SellCandidate[]> {
  const candidates: SellCandidate[] = [];

  // Look for players who make sense to sell
  for (const player of players) {
    const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
    const salary = parseFloat(player.capHit || '0');
    const metrics = await getPositionMetrics(player);
    
    // Criteria for selling: aging, expensive, or expiring contract
    if ((age > 29 && salary > 4) || salary > 7) {
      const tradeValue = calculateTradeValue(player, metrics, age, salary);
      
      candidates.push({
        playerId: player.playerId,
        name: `${player.firstName} ${player.lastName}`,
        position: player.position,
        currentValue: tradeValue.value,
        deadlineValue: tradeValue.value * 1.2, // Deadline premium
        contractStatus: {
          yearsRemaining: Math.floor(Math.random() * 3) + 1,
          annualValue: salary,
          contractType: 'ufa',
          tradeRestrictions: []
        },
        sellRationale: [
          age > 32 ? 'Aging player - maximize return' : 'High salary cap hit',
          'Asset value at peak',
          status.urgency === 'rebuild' ? 'Team rebuilding' : 'Cap management'
        ],
        targetReturnType: status.urgency === 'rebuild' ? 'picks' : 'cap-relief',
        urgency: age > 33 ? 'immediate' : 'high',
        marketDemand: tradeValue.demandLevel
      });
    }
  }
  
  return candidates.slice(0, 8); // Top 8 candidates
}

async function identifyTeamNeeds(players: Player[]) {
  const positions = ['G', 'D', 'C', 'LW', 'RW'];
  const needs = [];
  
  for (const position of positions) {
    const positionPlayers = players.filter(p => p.position === position);
    const quality = await calculatePositionQuality(positionPlayers);
    
    if (quality < 6) {
      needs.push({
        position,
        priority: quality < 4 ? 'critical' : 'high',
        estimatedSalary: position === 'G' ? 4.0 : 3.5
      });
    }
  }
  
  return needs;
}

async function calculatePositionQuality(players: Player[]): Promise<number> {
  if (players.length === 0) return 1;
  
  let totalQuality = 0;
  for (const player of players) {
    const metrics = await getPositionMetrics(player);
    const salary = parseFloat(player.capHit || '0');
    const quality = metrics ? 
      Math.min(10, (metrics.pointsPerGame * 10 + salary) / 2) : 
      Math.min(10, salary);
    totalQuality += quality;
  }
  
  return totalQuality / players.length;
}

function generateDeadlineRecommendations(status: TeamCompetitiveStatus, strategy: TradeStrategy, assets: AssetValuation): DeadlineRecommendation[] {
  const recommendations: DeadlineRecommendation[] = [];
  
  // Primary recommendation based on strategy
  if (strategy.primaryApproach === 'aggressive-buyer') {
    recommendations.push({
      priority: 'critical',
      action: 'Acquire impactful rental player for playoff push',
      rationale: 'Championship window open - maximize current season potential',
      timeline: '2-4 weeks before deadline',
      alternatives: ['Multiple smaller moves', 'Wait for price drops'],
      successMetrics: ['Playoff performance improvement', 'Chemistry integration'],
      riskMitigation: ['Scout thoroughly', 'Have backup options', 'Consider retention']
    });
  } else if (strategy.primaryApproach === 'rebuild-seller') {
    recommendations.push({
      priority: 'critical',
      action: 'Sell veteran assets for future draft capital',
      rationale: 'Maximize return on depreciating assets while focusing on future',
      timeline: '4-6 weeks before deadline for best prices',
      alternatives: ['Retain and extend', 'Package deals'],
      successMetrics: ['Draft pick acquisition', 'Prospect development'],
      riskMitigation: ['Set minimum price', 'Multiple suitors', 'Deadline flexibility']
    });
  }
  
  // Asset management recommendation
  recommendations.push({
    priority: 'high',
    action: 'Optimize asset allocation for strategic goals',
    rationale: `${assets.totalTradeValue} total trade value available for moves`,
    timeline: 'Ongoing evaluation through deadline',
    alternatives: ['Hold assets', 'Package for bigger move'],
    successMetrics: ['Asset value maximization', 'Strategic goal achievement'],
    riskMitigation: ['Market timing', 'Multiple negotiation tracks']
  });
  
  return recommendations;
}

function analyzeMarketConditions(approach: string): MarketAnalysis {
  // Mock market analysis - would analyze league-wide data
  const mockMarket: MarketAnalysis = {
    availableRentals: [
      {
        name: 'Veteran Forward',
        position: 'RW',
        team: 'CHI',
        availability: 'confirmed',
        estimatedCost: '2nd round pick + prospect',
        competition: ['BOS', 'FLA', 'DAL']
      },
      {
        name: 'Shutdown Defenseman',
        position: 'D',
        team: 'ANA',
        availability: 'rumored',
        estimatedCost: '1st round pick + player',
        competition: ['TOR', 'NYR', 'COL']
      }
    ],
    availableLongTerm: [
      {
        name: 'Young Center',
        position: 'C',
        team: 'OTT',
        availability: 'possible',
        estimatedCost: 'Multiple 1st round picks',
        competition: ['Multiple teams']
      }
    ],
    marketTrends: [
      {
        position: 'D',
        trend: 'seller-market',
        priceDirection: 'rising',
        reasoning: 'High demand for playoff defensemen'
      },
      {
        position: 'G',
        trend: 'buyer-market',
        priceDirection: 'stable',
        reasoning: 'Limited rental goalies available'
      }
    ],
    competitorAnalysis: [
      {
        team: 'BOS',
        status: 'buyer',
        needs: ['Top-6 forward', 'PP quarterback'],
        assets: ['High picks', 'Deep prospect pool'],
        likelihood: 85
      },
      {
        team: 'ARZ',
        status: 'seller',
        needs: ['Future assets'],
        assets: ['Veteran players', 'Expiring contracts'],
        likelihood: 95
      }
    ],
    timingRecommendations: [
      'Start negotiations early but expect prices to drop closer to deadline',
      'Monitor competitor moves to adjust strategy',
      'Be prepared for quick decisions in final 48 hours'
    ]
  };
  
  return mockMarket;
}