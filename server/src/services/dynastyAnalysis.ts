// Dynasty Mode Analysis - Long-term team building and prospect valuation
import { Op } from 'sequelize';
import { Team, Player, PlayerSeasonStat } from '../models/index.js';
import { getPositionMetrics } from './hockeyAnalysis.js';
import { currentSeason, calculatePlayerAgeSync } from './scoring.js';

interface DynastyProfile {
  organizationalHealth: OrganizationalHealth;
  futureCapProjections: FutureCapProjections;
  prospectValuation: ProspectValuation;
  draftCapitalAnalysis: DraftCapitalAnalysis;
  dynastyStrategy: DynastyStrategy;
  competitiveWindowForecast: CompetitiveWindowForecast;
  assetManagement: AssetManagement;
}

interface OrganizationalHealth {
  corePlayerAges: CorePlayerAge[];
  contractStructure: ContractStructure;
  pipelineStrength: PipelineStrength;
  organizationRating: number; // 1-10 dynasty potential
  keyStrengths: string[];
  majorConcerns: string[];
}

interface CorePlayerAge {
  playerId: number;
  name: string;
  position: string;
  currentAge: number;
  peakYears: number[]; // Years they'll be in prime
  declineProjection: number; // Year decline begins
  contractStatus: 'signed' | 'expiring' | 'rfa' | 'ufa';
  resignProbability: number; // 0-100%
}

interface FutureCapProjections {
  projections: YearlyCapProjection[];
  capFlexibility: CapFlexibility;
  contractAlerts: ContractAlert[];
  strategicRecommendations: string[];
}

interface YearlyCapProjection {
  season: string;
  commitments: number;
  availableSpace: number;
  keyExpirations: ContractExpiration[];
  projectedNeeds: PositionalNeed[];
}

interface ContractExpiration {
  playerId: number;
  name: string;
  position: string;
  currentCapHit: number;
  replacementCost: number; // Market value
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface PositionalNeed {
  position: string;
  urgency: 'immediate' | 'upcoming' | 'future';
  estimatedCost: [number, number]; // Min-max salary range
  internalOptions: string[]; // Prospects who could fill role
}

interface ProspectValuation {
  prospects: ProspectRating[];
  systemRanking: SystemRanking;
  graduationTimeline: GraduationTimeline;
  positionStrengths: { [position: string]: number };
  tradableAssets: TradableProspect[];
}

interface ProspectRating {
  playerId: number;
  name: string;
  position: string;
  age: number;
  currentLevel: 'NHL' | 'AHL' | 'Junior' | 'NCAA' | 'Europe';
  ceilingRating: number; // 1-10 (10 = franchise player)
  floorRating: number; // 1-10 (worst case scenario)
  buustProbability: number; // 0-100% chance of being a bust
  projectedNHLRole: string;
  estimatedNHLEntry: number; // Year they become full-time NHL player
  developmentTrack: 'ahead' | 'on-track' | 'behind' | 'stalled';
}

interface DraftCapitalAnalysis {
  upcomingPicks: DraftPick[];
  pickValue: PickValue;
  draftStrategy: DraftStrategyRecommendation;
  tradingRecommendations: string[];
}

interface DraftPick {
  year: number;
  round: number;
  estimatedPosition: number;
  value: number; // Trade value in points
  tradingRecommendation: 'keep' | 'trade-up' | 'trade-down' | 'trade-for-player';
}

interface DynastyStrategy {
  primaryApproach: 'contend-now' | 'retool' | 'rebuild' | 'hybrid';
  timeframe: DynastyTimeframe;
  keyMoves: StrategicMove[];
  riskAssessment: RiskAssessment;
}

interface DynastyTimeframe {
  competitiveTarget: number; // Year to be competitive
  windowDuration: number; // Expected years of contention
  keyMilestones: Milestone[];
}

interface StrategicMove {
  type: 'trade' | 'signing' | 'development' | 'draft';
  description: string;
  timeframe: string;
  rationale: string;
  successProbability: number;
  alternatives: string[];
}

interface Milestone {
  year: number;
  target: string;
  likelihood: number;
  dependencies: string[];
}

// Dynasty Analysis Main Function
export async function analyzeDynastyPotential(teamAbbrev: string): Promise<DynastyProfile> {
  const team = await Team.findOne({ where: { abbr: teamAbbrev } });
  if (!team) {
    throw new Error(`Team ${teamAbbrev} not found`);
  }

  const season = await currentSeason();

  // Get all players in organization (NHL + AHL)
  const allPlayers = await getAllOrganizationPlayers(team);
  
  const organizationalHealth = await analyzeOrganizationalHealth(allPlayers, season);
  const futureCapProjections = await projectFutureCap(allPlayers);
  const prospectValuation = await valueProspects(allPlayers, season);
  const draftCapitalAnalysis = analyzeDraftCapital(team);
  const dynastyStrategy = determineDynastyStrategy(organizationalHealth, prospectValuation);
  const competitiveWindowForecast = forecastCompetitiveWindow(allPlayers, prospectValuation, season);
  const assetManagement = analyzeAssetManagement(allPlayers, prospectValuation);

  return {
    organizationalHealth,
    futureCapProjections,
    prospectValuation,
    draftCapitalAnalysis,
    dynastyStrategy,
    competitiveWindowForecast,
    assetManagement
  };
}

// Get all players in organization (NHL + AHL affiliates)
async function getAllOrganizationPlayers(nhlTeam: Team): Promise<Player[]> {
  // Include both NHL and AHL players (use affiliate mapping from previous work)
  const AFFILIATES: { [key: string]: string[] } = {
    'WAS': ['HER'], 'CHI': ['RCK'], 'CGY': ['CLG'], 'COL': ['COL'], 'VGK': ['HEN'],
    'ANA': ['SDG'], 'EDM': ['BAK'], 'OTT': ['BEL'], 'NYI': ['BRI'], 'FLA': ['CHA'],
    'CBJ': ['CLE'], 'VAN': ['ABB'], 'DET': ['GRA'], 'NYR': ['HAR'], 'DAL': ['TEX'],
    'MTL': ['LAV'], 'PHI': ['LEH'], 'WPG': ['MAN'], 'NSH': ['MIL'], 'LAK': ['ONT'],
    'BOS': ['PRO'], 'BUF': ['RCH'], 'SJS': ['SJB'], 'STL': ['SPR'], 'TBL': ['SYR'],
    'TOR': ['TOR'], 'ARZ': ['TUC'], 'NJD': ['UTI'], 'PIT': ['WBS'], 'SEA': ['COA'],
    'MIN': ['IOW'], 'CAR': ['CHI']
  };

  const affiliateAbbrevs = AFFILIATES[nhlTeam.abbr] || [];
  const teamIds = [nhlTeam.teamId];

  if (affiliateAbbrevs.length > 0) {
    const ahlTeams = await Team.findAll({
      where: {
        abbr: { [Op.in]: affiliateAbbrevs },
        leagueId: 1 // AHL
      }
    });
    teamIds.push(...ahlTeams.map(t => t.teamId));
  }

  return await Player.findAll({
    where: {
      teamId: { [Op.in]: teamIds },
      retired: false
    },
    include: [{ model: Team, as: 'team' }]
  });
}

// Analyze organizational health for dynasty building
async function analyzeOrganizationalHealth(players: Player[], season: string): Promise<OrganizationalHealth> {
  const nhlPlayers = players.filter(p => p.team?.leagueId === 0);
  const ahlPlayers = players.filter(p => p.team?.leagueId === 1);

  // Analyze core player ages and contracts
  const corePlayerAges: CorePlayerAge[] = [];
  const keyStrengths: string[] = [];
  const majorConcerns: string[] = [];

  // Identify core players (NHL players making $3M+)
  const coreNHLers = nhlPlayers.filter(p => parseFloat(p.capHit || '0') >= 3.0);

  for (const player of coreNHLers) {
    const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
    
    // Calculate peak years (typically 24-29 for most players)
    const peakStart = Math.max(2024, 24 - age + 2024);
    const peakEnd = Math.max(2024, 29 - age + 2024);
    const peakYears = [];
    for (let year = peakStart; year <= peakEnd; year++) {
      peakYears.push(year);
    }

    const corePlayer: CorePlayerAge = {
      playerId: player.playerId,
      name: `${player.firstName} ${player.lastName}`,
      position: player.position,
      currentAge: age,
      peakYears,
      declineProjection: age < 30 ? age + (32 - age) + 2024 - age : 2024 + (35 - age),
      contractStatus: 'signed', // Simplified - would need contract data
      resignProbability: age > 32 ? 40 : age < 26 ? 85 : 70
    };

    corePlayerAges.push(corePlayer);
  }

  // Analyze contract structure
  const contractStructure = analyzeContractStructure(nhlPlayers);

  // Analyze pipeline strength
  const pipelineStrength = analyzePipelineStrength(ahlPlayers, season);

  // Calculate overall organization rating
  let organizationRating = 5.0; // Base score
  
  // Young core bonus
  const avgCoreAge = corePlayerAges.reduce((sum, p) => sum + p.currentAge, 0) / corePlayerAges.length;
  if (avgCoreAge < 26) {
    organizationRating += 2.0;
    keyStrengths.push('Young core with long window');
  } else if (avgCoreAge > 30) {
    organizationRating -= 1.5;
    majorConcerns.push('Aging core, limited window');
  }

  // Pipeline depth bonus/penalty
  if (pipelineStrength.overallGrade >= 7) {
    organizationRating += 1.5;
    keyStrengths.push('Deep prospect pipeline');
  } else if (pipelineStrength.overallGrade < 4) {
    organizationRating -= 1.0;
    majorConcerns.push('Weak prospect development');
  }

  // Cap flexibility analysis
  if (contractStructure.flexibilityRating >= 7) {
    organizationRating += 1.0;
    keyStrengths.push('Excellent cap management');
  } else if (contractStructure.flexibilityRating < 4) {
    organizationRating -= 1.0;
    majorConcerns.push('Cap constraints limit flexibility');
  }

  return {
    corePlayerAges,
    contractStructure,
    pipelineStrength,
    organizationRating: Math.max(1, Math.min(10, organizationRating)),
    keyStrengths,
    majorConcerns
  };
}

interface ContractStructure {
  totalCommitted: number;
  flexibilityRating: number;
  longTermRisk: number;
  expirationsPerYear: { [year: number]: number };
}

function analyzeContractStructure(nhlPlayers: Player[]): ContractStructure {
  const totalCommitted = nhlPlayers.reduce((sum, p) => sum + (parseFloat(p.capHit || '0')), 0);
  
  // Simulate contract analysis (would need real contract data)
  const flexibilityRating = totalCommitted < 70 ? 8 : totalCommitted < 80 ? 6 : 4;
  const longTermRisk = nhlPlayers.filter(p => parseFloat(p.capHit || '0') > 6).length * 0.5;
  
  // Simulate contract expirations
  const expirationsPerYear: { [year: number]: number } = {};
  for (let year = 2025; year <= 2030; year++) {
    expirationsPerYear[year] = Math.floor(Math.random() * 5) + 2; // 2-6 expirations per year
  }

  return {
    totalCommitted,
    flexibilityRating,
    longTermRisk,
    expirationsPerYear
  };
}

interface PipelineStrength {
  topProspects: number;
  overallDepth: number;
  overallGrade: number;
  positionCoverage: { [position: string]: number };
}

function analyzePipelineStrength(ahlPlayers: Player[], season: string): PipelineStrength {
  const positions = ['C', 'LW', 'RW', 'D', 'G'];
  const positionCoverage: { [position: string]: number } = {};

  positions.forEach(pos => {
    const positionPlayers = ahlPlayers.filter(p => p.position === pos);
    const youngProspects = positionPlayers.filter(p => {
      const age = calculatePlayerAgeSync(p.dateOfBirth, season) ?? 30;
      return age < 25;
    });
    positionCoverage[pos] = youngProspects.length;
  });

  const topProspects = ahlPlayers.filter(p => {
    const age = calculatePlayerAgeSync(p.dateOfBirth, season) ?? 30;
    return age < 23; // Very young prospects with high upside
  }).length;

  const overallDepth = ahlPlayers.length;
  const overallGrade = Math.min(10, Math.max(1, (topProspects * 2) + (overallDepth * 0.1)));

  return {
    topProspects,
    overallDepth,
    overallGrade,
    positionCoverage
  };
}

// Project future salary cap commitments
async function projectFutureCap(players: Player[], season?: string): Promise<FutureCapProjections> {
  const nhlPlayers = players.filter(p => p.team?.leagueId === 0);
  const projections: YearlyCapProjection[] = [];
  if (!season) season = await currentSeason();
  
  // Project next 5 years
  for (let year = 2025; year <= 2029; year++) {
    const seasonStr = `${year}-${year + 1}`;
    
    // Simulate cap commitments (would need real contract data)
    let commitments = nhlPlayers.reduce((sum, p) => {
      const capHit = parseFloat(p.capHit || '0');
      // Simulate contract lengths - assume most expire within 3-5 years
      const contractExpiry = 2024 + Math.floor(Math.random() * 5) + 1;
      return contractExpiry >= year ? sum + capHit : sum;
    }, 0);
    
    const capCeiling = 83.0 + (year - 2024) * 2; // Assume $2M annual increase
    const availableSpace = capCeiling - commitments;
    
    // Identify key expirations for this year
    const keyExpirations: ContractExpiration[] = nhlPlayers
      .filter(p => {
        const expiry = 2024 + Math.floor(Math.random() * 5) + 1;
        return expiry === year && parseFloat(p.capHit || '0') > 2.0;
      })
      .slice(0, 4)
      .map(p => ({
        playerId: p.playerId,
        name: `${p.firstName} ${p.lastName}`,
        position: p.position,
        currentCapHit: parseFloat(p.capHit || '0'),
        replacementCost: parseFloat(p.capHit || '0') * 1.1, // 10% inflation
        priority: parseFloat(p.capHit || '0') > 6 ? 'critical' as const : 'high' as const
      }));

    projections.push({
      season: seasonStr,
      commitments,
      availableSpace,
      keyExpirations,
      projectedNeeds: [] // Would analyze positional needs
    });
  }

  return {
    projections,
    capFlexibility: analyzeCapFlexibility(projections),
    contractAlerts: generateContractAlerts(nhlPlayers, season),
    strategicRecommendations: generateCapRecommendations(projections)
  };
}

interface CapFlexibility {
  rating: number; // 1-10
  averageSpace: number;
  peakSpace: number;
  concernYears: number[];
}

function analyzeCapFlexibility(projections: YearlyCapProjection[]): CapFlexibility {
  const spaces = projections.map(p => p.availableSpace);
  const averageSpace = spaces.reduce((sum, space) => sum + space, 0) / spaces.length;
  const peakSpace = Math.max(...spaces);
  const concernYears = projections
    .filter(p => p.availableSpace < 5)
    .map(p => parseInt(p.season.split('-')[0]));
  
  const rating = averageSpace > 15 ? 9 : averageSpace > 10 ? 7 : averageSpace > 5 ? 5 : 3;

  return {
    rating,
    averageSpace,
    peakSpace,
    concernYears
  };
}

interface ContractAlert {
  playerId: number;
  name: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium';
  recommendation: string;
}

function generateContractAlerts(players: Player[], season: string): ContractAlert[] {
  const alerts: ContractAlert[] = [];

  // Identify potential problem contracts
  const expensivePlayers = players.filter(p => parseFloat(p.capHit || '0') > 6.0);

  expensivePlayers.forEach(player => {
    const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
    
    if (age > 32) {
      alerts.push({
        playerId: player.playerId,
        name: `${player.firstName} ${player.lastName}`,
        issue: 'Aging expensive player - decline risk',
        severity: 'high',
        recommendation: 'Consider trading while value remains high'
      });
    }
  });

  return alerts.slice(0, 5); // Top 5 concerns
}

function generateCapRecommendations(projections: YearlyCapProjection[]): string[] {
  const recommendations: string[] = [];
  
  // Analyze spending patterns
  const tightYears = projections.filter(p => p.availableSpace < 8);
  const flexibleYears = projections.filter(p => p.availableSpace > 15);
  
  if (tightYears.length > 2) {
    recommendations.push('Focus on ELC and bridge contracts to maintain flexibility');
    recommendations.push('Avoid long-term deals for aging players');
  }
  
  if (flexibleYears.length > 0) {
    recommendations.push(`Years ${flexibleYears.map(y => y.season).join(', ')} offer spending opportunities`);
  }
  
  return recommendations;
}

// Value organizational prospects
async function valueProspects(players: Player[], season: string): Promise<ProspectValuation> {
  const ahlPlayers = players.filter(p => p.team?.leagueId === 1);
  const prospects: ProspectRating[] = [];

  for (const prospect of ahlPlayers) {
    const age = calculatePlayerAgeSync(prospect.dateOfBirth, season) ?? 25;
    
    // Only analyze true prospects (under 25)
    if (age >= 25) continue;

    const metrics = await getPositionMetrics(prospect);
    const rating = calculateProspectRating(prospect, metrics, age);
    prospects.push(rating);
  }

  // Sort prospects by ceiling
  prospects.sort((a, b) => b.ceilingRating - a.ceilingRating);

  const systemRanking = calculateSystemRanking(prospects);
  const graduationTimeline = analyzeGraduationTimeline(prospects);
  const positionStrengths = calculatePositionStrengths(prospects);
  const tradableAssets = identifyTradableProspects(prospects);

  return {
    prospects,
    systemRanking,
    graduationTimeline,
    positionStrengths,
    tradableAssets
  };
}

function calculateProspectRating(prospect: Player, metrics: any, age: number): ProspectRating {
  let ceilingRating = 5.0; // Base ceiling
  let floorRating = 3.0; // Base floor
  let bustProbability = 30; // Base bust chance

  // Age factor (younger = higher ceiling but more risk)
  if (age < 21) {
    ceilingRating += 1.5;
    bustProbability += 10;
  } else if (age > 23) {
    ceilingRating -= 0.5;
    bustProbability -= 10;
    floorRating += 0.5; // More proven
  }

  // Performance factor (if available)
  if (metrics) {
    const { pointsPerGame, timeOnIce } = metrics;
    if (pointsPerGame > 0.8) {
      ceilingRating += 2.0;
      floorRating += 1.0;
      bustProbability -= 15;
    } else if (pointsPerGame > 0.5) {
      ceilingRating += 1.0;
      bustProbability -= 5;
    }
  }

  // Position adjustments
  if (prospect.position === 'C') {
    ceilingRating += 0.5; // Centers more valuable
  } else if (prospect.position === 'G') {
    bustProbability += 20; // Goalies more volatile
  }

  const projectedNHLRole = determineProjectedRole(ceilingRating, prospect.position);
  const estimatedNHLEntry = 2024 + Math.max(1, 24 - age);
  const developmentTrack = age < 22 ? 'on-track' : age > 24 ? 'behind' : 'on-track';

  return {
    playerId: prospect.playerId,
    name: `${prospect.firstName} ${prospect.lastName}`,
    position: prospect.position,
    age,
    currentLevel: 'AHL', // Simplified
    ceilingRating: Math.max(1, Math.min(10, ceilingRating)),
    floorRating: Math.max(1, Math.min(10, floorRating)),
    buustProbability: Math.max(5, Math.min(80, bustProbability)),
    projectedNHLRole,
    estimatedNHLEntry,
    developmentTrack
  };
}

function determineProjectedRole(ceilingRating: number, position: string): string {
  if (ceilingRating >= 8.5) return 'Star Player';
  if (ceilingRating >= 7.0) return 'Top-6 Forward / Top-4 D';
  if (ceilingRating >= 5.5) return 'Middle-6 Forward / NHL Regular';
  if (ceilingRating >= 4.0) return 'Bottom-6 Forward / Depth Player';
  return 'AHL/Fringe Player';
}

interface SystemRanking {
  leagueRank: number; // 1-32
  grade: string; // A+, A, B+, etc.
  strengths: string[];
  weaknesses: string[];
}

function calculateSystemRanking(prospects: ProspectRating[]): SystemRanking {
  const topProspects = prospects.filter(p => p.ceilingRating >= 7).length;
  const qualityProspects = prospects.filter(p => p.ceilingRating >= 5.5).length;
  
  let rank = 16; // Average rank
  let grade = 'C+';
  
  if (topProspects >= 3 && qualityProspects >= 8) {
    rank = Math.floor(Math.random() * 5) + 1; // Top 5
    grade = 'A+';
  } else if (topProspects >= 2 && qualityProspects >= 6) {
    rank = Math.floor(Math.random() * 5) + 6; // 6-10
    grade = 'A';
  } else if (topProspects >= 1 && qualityProspects >= 4) {
    rank = Math.floor(Math.random() * 5) + 11; // 11-15
    grade = 'B+';
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (topProspects >= 2) strengths.push('Multiple high-ceiling prospects');
  if (qualityProspects >= 6) strengths.push('Good organizational depth');
  if (topProspects === 0) weaknesses.push('Lacks elite prospect talent');
  if (qualityProspects < 3) weaknesses.push('Limited depth in system');

  return { leagueRank: rank, grade, strengths, weaknesses };
}

interface GraduationTimeline {
  nextSeason: ProspectRating[];
  twoYears: ProspectRating[];
  longTerm: ProspectRating[];
}

function analyzeGraduationTimeline(prospects: ProspectRating[]): GraduationTimeline {
  return {
    nextSeason: prospects.filter(p => p.estimatedNHLEntry <= 2025),
    twoYears: prospects.filter(p => p.estimatedNHLEntry === 2026),
    longTerm: prospects.filter(p => p.estimatedNHLEntry >= 2027)
  };
}

function calculatePositionStrengths(prospects: ProspectRating[]): { [position: string]: number } {
  const positions = ['C', 'LW', 'RW', 'D', 'G'];
  const strengths: { [position: string]: number } = {};
  
  positions.forEach(pos => {
    const posProspects = prospects.filter(p => p.position === pos);
    const qualityCount = posProspects.filter(p => p.ceilingRating >= 6).length;
    strengths[pos] = Math.min(10, qualityCount * 2.5); // Scale to 10
  });

  return strengths;
}

interface TradableProspect {
  prospect: ProspectRating;
  tradeValue: number; // 1-100
  recommendation: 'keep' | 'trade-for-pick' | 'trade-for-player' | 'package-deal';
  reasoning: string;
}

function identifyTradableProspects(prospects: ProspectRating[]): TradableProspect[] {
  return prospects
    .filter(p => p.ceilingRating >= 5.5) // Only prospects with trade value
    .slice(3) // Keep top 3, consider trading others
    .map(prospect => {
      const tradeValue = Math.min(100, prospect.ceilingRating * 10 + (25 - prospect.age) * 2);
      
      let recommendation: TradableProspect['recommendation'] = 'keep';
      let reasoning = 'Developing prospect with upside';
      
      if (prospect.ceilingRating >= 7.5) {
        recommendation = 'package-deal';
        reasoning = 'High-value asset for major trade';
      } else if (prospect.age > 23 && prospect.developmentTrack === 'behind') {
        recommendation = 'trade-for-pick';
        reasoning = 'Development stalled, maximize return';
      }

      return {
        prospect,
        tradeValue,
        recommendation,
        reasoning
      };
    })
    .slice(0, 10); // Top 10 tradable assets
}

// Additional analysis functions would continue here...
// Simplified for length - would include draft capital analysis, strategy determination, etc.

function analyzeDraftCapital(team: Team): DraftCapitalAnalysis {
  // Simplified draft analysis - would need actual draft pick data
  const picks: DraftPick[] = [];
  for (let year = 2025; year <= 2027; year++) {
    for (let round = 1; round <= 3; round++) {
      picks.push({
        year,
        round,
        estimatedPosition: (round - 1) * 32 + Math.floor(Math.random() * 32) + 1,
        value: Math.max(1, 200 - ((round - 1) * 50)),
        tradingRecommendation: round === 1 ? 'keep' : 'trade-for-player'
      });
    }
  }

  return {
    upcomingPicks: picks,
    pickValue: { totalValue: picks.reduce((sum, p) => sum + p.value, 0) },
    draftStrategy: { recommendation: 'Balance prospects and immediate help' },
    tradingRecommendations: ['Use 2nd/3rd round picks for depth players']
  };
}

function determineDynastyStrategy(orgHealth: OrganizationalHealth, prospects: ProspectValuation): DynastyStrategy {
  let primaryApproach: DynastyStrategy['primaryApproach'] = 'hybrid';
  
  if (orgHealth.organizationRating >= 8 && prospects.systemRanking.leagueRank <= 10) {
    primaryApproach = 'contend-now';
  } else if (orgHealth.organizationRating <= 4) {
    primaryApproach = 'rebuild';
  } else if (orgHealth.corePlayerAges.some(p => p.currentAge < 25)) {
    primaryApproach = 'retool';
  }

  return {
    primaryApproach,
    timeframe: {
      competitiveTarget: primaryApproach === 'rebuild' ? 2028 : 2025,
      windowDuration: primaryApproach === 'contend-now' ? 3 : 5,
      keyMilestones: []
    },
    keyMoves: [],
    riskAssessment: {
      overallRisk: 'moderate',
      keyRisks: ['Prospect development uncertainty', 'Aging core decline'],
      mitigation: ['Diversified approach', 'Multiple development paths']
    }
  };
}

interface CompetitiveWindowForecast {
  peakYears: number[];
  windowLength: number;
  keyFactors: string[];
  probabilityByYear: { [year: number]: number };
}

function forecastCompetitiveWindow(players: Player[], prospects: ProspectValuation, season: string): CompetitiveWindowForecast {
  // Analyze when team will be most competitive based on player ages and prospect graduation
  const nhlPlayers = players.filter(p => p.team?.leagueId === 0);
  const coreAges = nhlPlayers
    .filter(p => parseFloat(p.capHit || '0') > 4.0)
    .map(p => calculatePlayerAgeSync(p.dateOfBirth, season) ?? 30);
  
  const averageCoreAge = coreAges.reduce((sum, age) => sum + age, 0) / coreAges.length;
  
  // Peak years when core is 26-30 and top prospects have graduated
  const peakStart = Math.max(2025, 2024 + (26 - averageCoreAge));
  const peakEnd = Math.max(2025, 2024 + (30 - averageCoreAge));
  
  const peakYears = [];
  for (let year = peakStart; year <= peakEnd; year++) {
    peakYears.push(year);
  }

  return {
    peakYears,
    windowLength: peakYears.length,
    keyFactors: ['Core player development', 'Prospect graduation', 'Contract management'],
    probabilityByYear: peakYears.reduce((acc, year) => {
      acc[year] = 75; // 75% chance of being competitive in peak years
      return acc;
    }, {} as { [year: number]: number })
  };
}

interface AssetManagement {
  tradableAssets: TradableAsset[];
  keepOrTrade: KeepOrTradeDecision[];
  assetAllocation: AssetAllocation;
}

interface TradableAsset {
  name: string;
  type: 'player' | 'prospect' | 'pick';
  value: number;
  marketDemand: 'high' | 'medium' | 'low';
  recommendation: string;
}

function analyzeAssetManagement(players: Player[], prospects: ProspectValuation): AssetManagement {
  const tradableAssets: TradableAsset[] = [];
  
  // High-value NHL players
  const valuableNHLers = players
    .filter(p => p.team?.leagueId === 0 && parseFloat(p.capHit || '0') > 5.0)
    .slice(0, 5);
  
  valuableNHLers.forEach(player => {
    tradableAssets.push({
      name: `${player.firstName} ${player.lastName}`,
      type: 'player',
      value: parseFloat(player.capHit || '0') * 10,
      marketDemand: parseFloat(player.capHit || '0') > 8 ? 'high' : 'medium',
      recommendation: 'Keep unless exceptional return offered'
    });
  });

  return {
    tradableAssets,
    keepOrTrade: [],
    assetAllocation: {
      currentNHL: 60,
      prospects: 30,
      picks: 10
    }
  };
}