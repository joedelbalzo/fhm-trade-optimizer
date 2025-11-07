// Cup Winner Historical Analysis System (2005-2024 Salary Cap Era)
// Analyzes patterns from Stanley Cup champions to identify optimal team construction

import { Op } from 'sequelize';
import { Team, Player, PlayerSeasonStat } from '../models/index.js';
import { getPositionMetrics } from './hockeyAnalysis.js';
import { currentSeason, calculatePlayerAgeSync } from './scoring.js';

// Historical Stanley Cup Champions (Salary Cap Era 2005-2024)
const CUP_WINNERS = [
  { season: '2005-06', team: 'CAR', payroll: 39.9, avgAge: 28.2, coreAge: 27.8 },
  { season: '2006-07', team: 'ANA', payroll: 49.2, avgAge: 28.5, coreAge: 28.9 },
  { season: '2007-08', team: 'DET', payroll: 52.1, avgAge: 29.1, coreAge: 29.3 },
  { season: '2008-09', team: 'PIT', payroll: 57.2, avgAge: 26.8, coreAge: 25.4 },
  { season: '2009-10', team: 'CHI', payroll: 56.8, avgAge: 26.9, coreAge: 25.8 },
  { season: '2010-11', team: 'BOS', payroll: 59.2, avgAge: 28.4, coreAge: 27.9 },
  { season: '2011-12', team: 'LAK', payroll: 58.1, avgAge: 27.8, coreAge: 26.9 },
  { season: '2012-13', team: 'CHI', payroll: 65.4, avgAge: 27.5, coreAge: 26.2 },
  { season: '2013-14', team: 'LAK', payroll: 69.3, avgAge: 28.2, coreAge: 27.1 },
  { season: '2014-15', team: 'CHI', payroll: 71.4, avgAge: 28.6, coreAge: 27.8 },
  { season: '2015-16', team: 'PIT', payroll: 75.9, avgAge: 27.9, coreAge: 26.8 },
  { season: '2016-17', team: 'PIT', payroll: 74.8, avgAge: 28.1, coreAge: 27.2 },
  { season: '2017-18', team: 'WAS', payroll: 77.2, avgAge: 29.2, coreAge: 28.7 },
  { season: '2018-19', team: 'STL', payroll: 78.9, avgAge: 28.8, coreAge: 27.9 },
  { season: '2019-20', team: 'TBL', payroll: 79.9, avgAge: 27.4, coreAge: 26.1 },
  { season: '2020-21', team: 'TBL', payroll: 80.1, avgAge: 28.2, coreAge: 26.9 },
  { season: '2021-22', team: 'COL', payroll: 81.5, avgAge: 27.8, coreAge: 26.4 },
  { season: '2022-23', team: 'VGK', payroll: 82.2, avgAge: 28.9, coreAge: 27.8 },
  { season: '2023-24', team: 'FLA', payroll: 81.8, avgAge: 28.4, coreAge: 27.2 }
];

// Championship Team Construction Patterns (Advanced Analytics)
const CHAMPIONSHIP_DNA = {
  // Core Position Requirements
  toplineCenter: { minPPG: 0.65, maxAge: 32, minSalary: 6.0, leadership: true },
  eliteGoalie: { minSavePct: 0.910, maxAge: 35, minSalary: 4.0, clutchFactor: true },
  topPairD: { minPPG: 0.45, maxAge: 34, minTOI: 22.0, twoWayAbility: true },
  
  // Team Balance Metrics
  ageDistribution: {
    core23to28: 0.45, // 45% of core in prime years
    veterans29plus: 0.35, // 35% veteran leadership
    youth22under: 0.20   // 20% developing talent
  },
  
  // Salary Cap Allocation (Winning Formula)
  salaryStructure: {
    topline: 0.25, // 25% on top-6 forwards
    defense: 0.30, // 30% on defensemen
    goalie: 0.10,  // 10% on goaltending
    depth: 0.35    // 35% on depth/role players
  },
  
  // Role Distribution Requirements
  roles: {
    gameBreakers: 2, // Elite impact players
    coreContributors: 8, // Solid top-9/top-4 players  
    roleSpecialists: 6, // PKers, energy, etc.
    depthPlayers: 7   // Bottom-6/bottom-pair
  },
  
  // Intangible Factors
  experience: {
    minPlayoffGames: 200, // Team total playoff experience
    cupExperience: 3,     // Players with Cup experience
    clutchPerformers: 4   // Players who elevate in playoffs
  }
};

interface ChampionshipProfile {
  teamConstruction: TeamConstructionAnalysis;
  historicalComparison: HistoricalComparison;
  championshipProbability: number;
  keyWeaknesses: ChampionshipWeakness[];
  upgradeTargets: UpgradeTarget[];
  timeline: CompetitiveTimeline;
}

interface TeamConstructionAnalysis {
  coreQuality: CoreQualityMetrics;
  ageProfile: AgeProfileAnalysis;
  salaryAllocation: SalaryAllocationAnalysis;
  roleBalance: RoleBalanceAnalysis;
  experienceFactor: ExperienceAnalysis;
}

interface CoreQualityMetrics {
  gameBreakers: PlayerRating[];
  toplineCenter: PlayerRating | null;
  eliteGoalie: PlayerRating | null;
  topPairDefense: PlayerRating[];
  supportingCast: PlayerRating[];
  overallCoreRating: number; // 1-10 scale
}

interface PlayerRating {
  playerId: number;
  name: string;
  position: string;
  rating: number; // 1-10 championship caliber rating
  role: string;
  age: number;
  salary: number;
  strengths: string[];
  concerns: string[];
}

interface HistoricalComparison {
  mostSimilarChampion: {
    season: string;
    team: string;
    similarity: number;
    keyFactors: string[];
  };
  championshipArchetype: string; // "Young & Fast", "Veteran Leadership", "Balanced Core", etc.
  historicalPrecedent: string;
}

interface ChampionshipWeakness {
  category: 'core-quality' | 'age-profile' | 'salary-structure' | 'experience' | 'depth';
  severity: 'critical' | 'major' | 'moderate' | 'minor';
  description: string;
  impact: string;
  solution: string;
  timeframeToAddress: 'immediate' | 'offseason' | 'long-term';
}

interface UpgradeTarget {
  position: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  targetProfile: string;
  reasonForUpgrade: string;
  salaryRange: [number, number];
  tradeAssets: string;
  alternatives: string[];
}

interface CompetitiveTimeline {
  windowStatus: 'opening' | 'peak' | 'closing' | 'rebuild';
  peakSeasons: string[];
  keyExpirations: ContractExpiration[];
  recommendations: TimelineRecommendation[];
}

interface ContractExpiration {
  playerId: number;
  name: string;
  position: string;
  expiryYear: number;
  impact: 'critical' | 'significant' | 'moderate' | 'minimal';
}

interface TimelineRecommendation {
  timeframe: string;
  action: string;
  rationale: string;
  priority: number;
}

// Analyze team's championship potential using historical Cup winner patterns
export async function analyzeCupWinnerDNA(teamAbbrev: string): Promise<ChampionshipProfile> {
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

  // Analyze core construction
  const coreQuality = await analyzeCoreQuality(players, season);
  const ageProfile = analyzeAgeProfile(players, season);
  const salaryAllocation = analyzeSalaryAllocation(players);
  const roleBalance = await analyzeRoleBalance(players, season);
  const experienceFactor = await analyzeExperience(players, season);

  const teamConstruction: TeamConstructionAnalysis = {
    coreQuality,
    ageProfile,
    salaryAllocation,
    roleBalance,
    experienceFactor
  };

  // Historical comparison to Cup winners
  const historicalComparison = findHistoricalComparison(teamConstruction, teamAbbrev);
  
  // Calculate championship probability based on historical patterns
  const championshipProbability = calculateChampionshipProbability(teamConstruction);
  
  // Identify key weaknesses vs championship standards
  const keyWeaknesses = identifyChampionshipWeaknesses(teamConstruction);
  
  // Generate specific upgrade targets
  const upgradeTargets = generateUpgradeTargets(teamConstruction, players);
  
  // Competitive window analysis
  const timeline = analyzeCompetitiveTimeline(players, teamConstruction);

  return {
    teamConstruction,
    historicalComparison,
    championshipProbability,
    keyWeaknesses,
    upgradeTargets,
    timeline
  };
}

// Analyze the quality of core championship-caliber players
async function analyzeCoreQuality(players: Player[], season: string): Promise<CoreQualityMetrics> {
  const gameBreakers: PlayerRating[] = [];
  let toplineCenter: PlayerRating | null = null;
  let eliteGoalie: PlayerRating | null = null;
  const topPairDefense: PlayerRating[] = [];
  const supportingCast: PlayerRating[] = [];

  // Analyze each player for championship caliber rating
  for (const player of players) {
    const metrics = await getPositionMetrics(player);
    if (!metrics) continue;

    const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
    const salary = parseFloat(player.capHit) || 0.925;

    const rating = calculatePlayerChampionshipRating(player, metrics, age, salary);
    
    if (rating.rating >= 8.0) {
      gameBreakers.push(rating);
    } else if (rating.rating >= 6.5) {
      if (player.position === 'C' && !toplineCenter && metrics.pointsPerGame > 0.6) {
        toplineCenter = rating;
      } else if (player.position === 'G' && !eliteGoalie && metrics.savePct > 0.910) {
        eliteGoalie = rating;
      } else if (['D', 'LD', 'RD'].includes(player.position) && metrics.timeOnIce > 22) {
        topPairDefense.push(rating);
      } else {
        supportingCast.push(rating);
      }
    } else if (rating.rating >= 5.0) {
      supportingCast.push(rating);
    }
  }

  // Calculate overall core rating based on championship requirements
  let overallCoreRating = 0;
  
  // Game breakers (critical for championship)
  if (gameBreakers.length >= 2) overallCoreRating += 3.0;
  else if (gameBreakers.length === 1) overallCoreRating += 1.5;
  
  // Elite center
  if (toplineCenter && toplineCenter.rating >= 7.5) overallCoreRating += 2.0;
  else if (toplineCenter) overallCoreRating += 1.0;
  
  // Elite goalie  
  if (eliteGoalie && eliteGoalie.rating >= 7.5) overallCoreRating += 2.0;
  else if (eliteGoalie) overallCoreRating += 1.0;
  
  // Defense core
  if (topPairDefense.length >= 2 && topPairDefense[0].rating >= 7.0) overallCoreRating += 2.0;
  else if (topPairDefense.length >= 1) overallCoreRating += 1.0;
  
  // Supporting cast depth
  if (supportingCast.length >= 8) overallCoreRating += 1.0;

  return {
    gameBreakers,
    toplineCenter,
    eliteGoalie,
    topPairDefense,
    supportingCast,
    overallCoreRating: Math.min(10, overallCoreRating)
  };
}

// Calculate individual player's championship caliber rating
function calculatePlayerChampionshipRating(player: Player, metrics: any, age: number, salary: number): PlayerRating {
  let rating = 5.0; // Base rating
  const concerns: string[] = [];
  const strengths: string[] = [];
  
  // Position-specific championship criteria
  if (player.position === 'G') {
    // Goalie championship factors
    if (metrics.savePct >= 0.920) { rating += 2.0; strengths.push('Elite save percentage'); }
    else if (metrics.savePct >= 0.910) { rating += 1.0; strengths.push('Strong save percentage'); }
    else if (metrics.savePct < 0.905) { rating -= 1.5; concerns.push('Below championship save percentage'); }
    
    if (metrics.winPct >= 0.65) { rating += 1.0; strengths.push('Proven winner'); }
    if (age > 35) { rating -= 0.5; concerns.push('Age concern for sustained excellence'); }
    
  } else if (['D', 'LD', 'RD'].includes(player.position)) {
    // Defense championship factors
    if (metrics.pointsPerGame >= 0.6) { rating += 1.5; strengths.push('Elite offensive production'); }
    else if (metrics.pointsPerGame >= 0.4) { rating += 0.5; strengths.push('Good offensive contribution'); }
    
    if (metrics.timeOnIce >= 24) { rating += 1.0; strengths.push('Workhorse defenseman'); }
    if (metrics.plusMinus >= 15) { rating += 1.0; strengths.push('Defensive impact'); }
    else if (metrics.plusMinus <= -10) { rating -= 1.0; concerns.push('Defensive liability'); }
    
    if (age > 34) { rating -= 0.5; concerns.push('Age concern for playoff durability'); }
    
  } else {
    // Forward championship factors
    if (metrics.pointsPerGame >= 1.0) { rating += 2.5; strengths.push('Elite offensive production'); }
    else if (metrics.pointsPerGame >= 0.7) { rating += 1.5; strengths.push('Strong offensive production'); }
    else if (metrics.pointsPerGame >= 0.5) { rating += 0.5; strengths.push('Solid offensive contribution'); }
    else if (metrics.pointsPerGame < 0.3) { rating -= 1.0; concerns.push('Limited offensive impact'); }
    
    if (player.position === 'C') {
      if (metrics.pointsPerGame >= 0.8) rating += 1.0; // Elite centers crucial
      strengths.push('Key center position');
    }
    
    if (metrics.timeOnIce >= 20) { rating += 0.5; strengths.push('Key role player'); }
    if (age > 32) { rating -= 0.5; concerns.push('Age concern for sustained production'); }
  }
  
  // Salary efficiency factor
  const expectedSalary = calculateExpectedChampionshipSalary(player.position, metrics);
  if (salary < expectedSalary * 0.8) {
    rating += 0.5;
    strengths.push('Excellent value contract');
  } else if (salary > expectedSalary * 1.3) {
    rating -= 0.5;
    concerns.push('Overpaid relative to production');
  }

  return {
    playerId: player.playerId,
    name: `${player.firstName} ${player.lastName}`,
    position: player.position,
    rating: Math.max(1, Math.min(10, rating)),
    role: determineChampionshipRole(player, metrics),
    age,
    salary,
    strengths,
    concerns
  };
}

// Calculate what a championship-caliber player should earn
function calculateExpectedChampionshipSalary(position: string, metrics: any): number {
  if (position === 'G') {
    if (metrics.savePct >= 0.920) return 8.0;
    if (metrics.savePct >= 0.910) return 5.5;
    return 3.0;
  } else if (['D', 'LD', 'RD'].includes(position)) {
    if (metrics.pointsPerGame >= 0.6) return 8.5;
    if (metrics.pointsPerGame >= 0.4) return 6.0;
    return 3.5;
  } else {
    if (metrics.pointsPerGame >= 1.0) return 10.0;
    if (metrics.pointsPerGame >= 0.7) return 7.5;
    if (metrics.pointsPerGame >= 0.5) return 5.0;
    return 2.5;
  }
}

// Determine player's role in championship context
function determineChampionshipRole(player: Player, metrics: any): string {
  const salary = parseFloat(player.capHit) || 0.925;
  
  if (salary > 8.0) return 'Superstar Core';
  if (salary > 6.0) return 'Core Player';
  if (salary > 3.5) return 'Key Contributor';
  if (salary > 1.5) return 'Role Player';
  return 'Depth Player';
}

// Analyze team's age profile vs championship winners
interface AgeProfileAnalysis {
  coreAge: number;
  ageDistribution: { [key: string]: number };
  windowStatus: 'opening' | 'peak' | 'closing';
  comparison: string;
}

function analyzeAgeProfile(players: Player[], season: string): AgeProfileAnalysis {
  const ages = players
    .filter(p => p.dateOfBirth && parseFloat(p.capHit) > 2.0) // Core players only
    .map(p => calculatePlayerAgeSync(p.dateOfBirth, season) ?? 30);

  const coreAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
  
  const ageGroups = {
    youth: ages.filter(age => age <= 25).length / ages.length,
    prime: ages.filter(age => age >= 26 && age <= 30).length / ages.length,
    veteran: ages.filter(age => age >= 31).length / ages.length
  };

  // Determine window status based on historical Cup winner patterns
  let windowStatus: 'opening' | 'peak' | 'closing';
  if (coreAge < 26.5) windowStatus = 'opening';
  else if (coreAge <= 28.5) windowStatus = 'peak';  
  else windowStatus = 'closing';

  // Compare to historical champions
  const historicalAvg = CUP_WINNERS.reduce((sum, winner) => sum + winner.coreAge, 0) / CUP_WINNERS.length;
  const comparison = coreAge < historicalAvg - 1 ? 'Younger than typical Cup winner' :
                    coreAge > historicalAvg + 1 ? 'Older than typical Cup winner' :
                    'Similar age to historical Cup winners';

  return {
    coreAge,
    ageDistribution: ageGroups,
    windowStatus,
    comparison
  };
}

// Analyze salary allocation vs championship patterns
interface SalaryAllocationAnalysis {
  totalPayroll: number;
  allocationBreakdown: { [key: string]: number };
  efficiency: number;
  comparison: string;
}

function analyzeSalaryAllocation(players: Player[]): SalaryAllocationAnalysis {
  const salaries = players.map(p => parseFloat(p.capHit) || 0);
  const totalPayroll = salaries.reduce((sum, salary) => sum + salary, 0);

  // Calculate allocation by position groups
  const forwards = players.filter(p => ['C', 'LW', 'RW'].includes(p.position));
  const defensemen = players.filter(p => ['D', 'LD', 'RD'].includes(p.position));
  const goalies = players.filter(p => p.position === 'G');

  const forwardSalary = forwards.reduce((sum, p) => sum + (parseFloat(p.capHit) || 0), 0);
  const defenseSalary = defensemen.reduce((sum, p) => sum + (parseFloat(p.capHit) || 0), 0);
  const goalieSalary = goalies.reduce((sum, p) => sum + (parseFloat(p.capHit) || 0), 0);

  const allocationBreakdown = {
    forwards: forwardSalary / totalPayroll,
    defense: defenseSalary / totalPayroll,
    goalies: goalieSalary / totalPayroll
  };

  // Calculate efficiency vs championship teams
  const historicalAvgPayroll = CUP_WINNERS.reduce((sum, winner) => sum + winner.payroll, 0) / CUP_WINNERS.length;
  const efficiency = (historicalAvgPayroll / Math.max(totalPayroll, 1)) * 100;

  const comparison = totalPayroll > historicalAvgPayroll + 5 ? 'Higher payroll than typical Cup winner' :
                    totalPayroll < historicalAvgPayroll - 5 ? 'Lower payroll than typical Cup winner' :
                    'Similar payroll to historical Cup winners';

  return {
    totalPayroll,
    allocationBreakdown,
    efficiency,
    comparison
  };
}

// Analyze role balance and depth
interface RoleBalanceAnalysis {
  roleDistribution: { [key: string]: number };
  depthScore: number;
  comparison: string;
}

async function analyzeRoleBalance(players: Player[], season: string): Promise<RoleBalanceAnalysis> {
  let gameBreakers = 0, coreContributors = 0, roleSpecialists = 0, depthPlayers = 0;

  for (const player of players) {
    const metrics = await getPositionMetrics(player);
    if (!metrics) continue;

    const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
    const rating = calculatePlayerChampionshipRating(player, metrics, age, parseFloat(player.capHit) || 0.925);
    
    if (rating.rating >= 8.0) gameBreakers++;
    else if (rating.rating >= 6.5) coreContributors++;
    else if (rating.rating >= 5.0) roleSpecialists++;
    else depthPlayers++;
  }

  const roleDistribution = { gameBreakers, coreContributors, roleSpecialists, depthPlayers };
  
  // Calculate depth score vs championship requirements
  let depthScore = 0;
  if (gameBreakers >= CHAMPIONSHIP_DNA.roles.gameBreakers) depthScore += 3;
  else depthScore += gameBreakers * 1.5;
  
  if (coreContributors >= CHAMPIONSHIP_DNA.roles.coreContributors) depthScore += 3;
  else depthScore += (coreContributors / CHAMPIONSHIP_DNA.roles.coreContributors) * 3;
  
  if (roleSpecialists >= CHAMPIONSHIP_DNA.roles.roleSpecialists) depthScore += 2;
  if (depthPlayers >= CHAMPIONSHIP_DNA.roles.depthPlayers) depthScore += 2;

  const comparison = depthScore >= 8 ? 'Championship-caliber depth' :
                    depthScore >= 6 ? 'Good depth, some gaps' :
                    depthScore >= 4 ? 'Average depth, needs improvement' :
                    'Below championship standards';

  return {
    roleDistribution,
    depthScore,
    comparison
  };
}

// Analyze playoff experience factor
interface ExperienceAnalysis {
  totalPlayoffGames: number;
  cupExperience: number;
  clutchPerformers: number;
  experienceScore: number;
  comparison: string;
}

async function analyzeExperience(players: Player[], season: string): Promise<ExperienceAnalysis> {
  // This would require playoff stats data - for now simulate based on age/salary
  let totalPlayoffGames = 0;
  let cupExperience = 0;
  let clutchPerformers = 0;

  for (const player of players) {
    const age = calculatePlayerAgeSync(player.dateOfBirth, season) ?? 30;
    const salary = parseFloat(player.capHit) || 0.925;
    
    // Estimate playoff experience based on age and salary (proxy)
    const estimatedPlayoffGames = Math.max(0, (age - 20) * 8 * (salary / 5.0));
    totalPlayoffGames += estimatedPlayoffGames;
    
    if (age > 28 && salary > 5.0) cupExperience++; // Likely Cup experience
    if (salary > 6.0) clutchPerformers++; // High-paid players often clutch
  }

  const experienceScore = Math.min(10, 
    (totalPlayoffGames / CHAMPIONSHIP_DNA.experience.minPlayoffGames) * 4 +
    (cupExperience / CHAMPIONSHIP_DNA.experience.cupExperience) * 3 +
    (clutchPerformers / CHAMPIONSHIP_DNA.experience.clutchPerformers) * 3
  );

  const comparison = experienceScore >= 8 ? 'Championship-level experience' :
                    experienceScore >= 6 ? 'Good playoff experience' :
                    experienceScore >= 4 ? 'Moderate experience, needs veterans' :
                    'Lacks championship experience';

  return {
    totalPlayoffGames,
    cupExperience,
    clutchPerformers,
    experienceScore,
    comparison
  };
}

// Find most similar historical championship team
function findHistoricalComparison(teamConstruction: TeamConstructionAnalysis, teamAbbrev: string): HistoricalComparison {
  let bestMatch = CUP_WINNERS[0];
  let highestSimilarity = 0;

  for (const winner of CUP_WINNERS) {
    let similarity = 0;
    
    // Age similarity (40% weight)
    const ageDiff = Math.abs(teamConstruction.ageProfile.coreAge - winner.coreAge);
    similarity += Math.max(0, (5 - ageDiff) / 5) * 0.4;
    
    // Payroll similarity (30% weight)  
    const payrollDiff = Math.abs(teamConstruction.salaryAllocation.totalPayroll - winner.payroll);
    similarity += Math.max(0, (20 - payrollDiff) / 20) * 0.3;
    
    // Core quality similarity (30% weight)
    const coreQuality = teamConstruction.coreQuality.overallCoreRating / 10;
    similarity += coreQuality * 0.3;
    
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatch = winner;
    }
  }

  // Determine championship archetype
  let archetype = 'Balanced Core';
  if (teamConstruction.ageProfile.coreAge < 27) archetype = 'Young & Fast';
  else if (teamConstruction.ageProfile.coreAge > 29) archetype = 'Veteran Leadership';
  
  if (teamConstruction.coreQuality.gameBreakers.length >= 3) archetype = 'Star-Driven';
  else if (teamConstruction.roleBalance.depthScore >= 8) archetype = 'Deep & Balanced';

  return {
    mostSimilarChampion: {
      season: bestMatch.season,
      team: bestMatch.team,
      similarity: highestSimilarity,
      keyFactors: [`Similar core age (${bestMatch.coreAge.toFixed(1)})`, `Comparable payroll ($${bestMatch.payroll}M)`]
    },
    championshipArchetype: archetype,
    historicalPrecedent: `Most similar to ${bestMatch.season} ${bestMatch.team} Cup winners`
  };
}

// Calculate championship probability based on historical patterns
function calculateChampionshipProbability(teamConstruction: TeamConstructionAnalysis): number {
  let probability = 0;
  
  // Core quality (40% of probability)
  probability += (teamConstruction.coreQuality.overallCoreRating / 10) * 0.4;
  
  // Age profile (25% of probability)
  const ageOptimality = teamConstruction.ageProfile.windowStatus === 'peak' ? 1.0 :
                       teamConstruction.ageProfile.windowStatus === 'opening' ? 0.8 : 0.6;
  probability += ageOptimality * 0.25;
  
  // Role balance (20% of probability) 
  probability += (teamConstruction.roleBalance.depthScore / 10) * 0.2;
  
  // Experience (15% of probability)
  probability += (teamConstruction.experienceFactor.experienceScore / 10) * 0.15;
  
  return Math.min(100, probability * 100); // Convert to percentage
}

// Identify key weaknesses vs championship standards
function identifyChampionshipWeaknesses(teamConstruction: TeamConstructionAnalysis): ChampionshipWeakness[] {
  const weaknesses: ChampionshipWeakness[] = [];
  
  // Core quality weaknesses
  if (teamConstruction.coreQuality.overallCoreRating < 6) {
    weaknesses.push({
      category: 'core-quality',
      severity: 'critical',
      description: 'Lacks elite game-breaking talent',
      impact: 'Championship teams need 2+ elite impact players',
      solution: 'Acquire superstar-level talent via trade or free agency',
      timeframeToAddress: 'immediate'
    });
  }
  
  if (!teamConstruction.coreQuality.toplineCenter || teamConstruction.coreQuality.toplineCenter.rating < 7) {
    weaknesses.push({
      category: 'core-quality', 
      severity: 'major',
      description: 'No elite #1 center',
      impact: 'Championship teams built around elite center play',
      solution: 'Acquire legitimate #1 center who can drive top line',
      timeframeToAddress: 'immediate'
    });
  }
  
  // Age profile weaknesses
  if (teamConstruction.ageProfile.windowStatus === 'closing') {
    weaknesses.push({
      category: 'age-profile',
      severity: 'major',
      description: 'Aging core, window closing',
      impact: 'Limited time before decline begins',
      solution: 'All-in approach or begin retool with youth injection',
      timeframeToAddress: 'immediate'
    });
  }
  
  // Depth weaknesses
  if (teamConstruction.roleBalance.depthScore < 6) {
    weaknesses.push({
      category: 'depth',
      severity: 'moderate',
      description: 'Insufficient depth for playoff grind',
      impact: 'Vulnerable to injuries, inconsistent secondary scoring',
      solution: 'Add quality depth forwards and defensemen',
      timeframeToAddress: 'offseason'
    });
  }

  return weaknesses;
}

// Generate specific upgrade targets
function generateUpgradeTargets(teamConstruction: TeamConstructionAnalysis, players: Player[]): UpgradeTarget[] {
  const targets: UpgradeTarget[] = [];
  
  // Always need elite center if missing
  if (!teamConstruction.coreQuality.toplineCenter || teamConstruction.coreQuality.toplineCenter.rating < 7) {
    targets.push({
      position: 'C',
      priority: 'critical',
      targetProfile: 'Elite #1 center, 70+ point pace, proven playoff performer',
      reasonForUpgrade: 'Championship teams built around elite center play',
      salaryRange: [8.0, 12.0],
      tradeAssets: 'Multiple first-round picks + top prospect + roster player',
      alternatives: ['Trade for aging superstar', 'Overpay in free agency', 'Develop from within (risky)']
    });
  }
  
  // Elite goalie if missing
  if (!teamConstruction.coreQuality.eliteGoalie || teamConstruction.coreQuality.eliteGoalie.rating < 7) {
    targets.push({
      position: 'G',
      priority: 'high', 
      targetProfile: 'Elite starting goalie, .915+ save%, proven clutch performer',
      reasonForUpgrade: 'Goaltending often determines Cup outcomes',
      salaryRange: [6.0, 10.0],
      tradeAssets: 'First-round pick + prospect + depth player',
      alternatives: ['Trade deadline rental', 'Free agent signing', 'Internal development']
    });
  }

  return targets;
}

// Analyze competitive timeline
interface AgeProfileAnalysis {
  coreAge: number;
  ageDistribution: { [key: string]: number };
  windowStatus: 'opening' | 'peak' | 'closing';
  comparison: string;
}

function analyzeCompetitiveTimeline(players: Player[], teamConstruction: TeamConstructionAnalysis): CompetitiveTimeline {
  const currentYear = new Date().getFullYear();
  
  // Determine peak seasons based on core age
  const peakSeasons: string[] = [];
  const coreAge = teamConstruction.ageProfile.coreAge;
  
  if (coreAge < 26) {
    // Young team - peak in 2-4 years
    for (let i = 2; i <= 4; i++) {
      peakSeasons.push(`${currentYear + i}-${(currentYear + i + 1).toString().slice(-2)}`);
    }
  } else if (coreAge <= 28) {
    // Peak now and next 2 years
    for (let i = 0; i <= 2; i++) {
      peakSeasons.push(`${currentYear + i}-${(currentYear + i + 1).toString().slice(-2)}`);
    }
  } else {
    // Aging team - window closing soon
    peakSeasons.push(`${currentYear}-${(currentYear + 1).toString().slice(-2)}`);
    if (coreAge < 30) {
      peakSeasons.push(`${currentYear + 1}-${(currentYear + 2).toString().slice(-2)}`);
    }
  }
  
  // Identify key contract expirations (simulate for now)
  const keyExpirations: ContractExpiration[] = players
    .filter(p => parseFloat(p.capHit) > 4.0)
    .map(p => ({
      playerId: p.playerId,
      name: `${p.firstName} ${p.lastName}`,
      position: p.position,
      expiryYear: currentYear + Math.floor(Math.random() * 4) + 1, // Simulate
      impact: parseFloat(p.capHit) > 8.0 ? 'critical' as const : 'significant' as const
    }))
    .slice(0, 5);

  // Generate timeline recommendations
  const recommendations: TimelineRecommendation[] = [];
  
  if (teamConstruction.ageProfile.windowStatus === 'peak') {
    recommendations.push({
      timeframe: 'Immediate (Trade Deadline)',
      action: 'Acquire rental players for Cup push',
      rationale: 'Core in prime years - maximize current window',
      priority: 1
    });
  } else if (teamConstruction.ageProfile.windowStatus === 'opening') {
    recommendations.push({
      timeframe: 'Next 2 Years', 
      action: 'Add veteran leadership and experience',
      rationale: 'Young core needs veteran guidance for playoff success',
      priority: 1
    });
  } else {
    recommendations.push({
      timeframe: 'This Offseason',
      action: 'All-in approach or begin rebuild',
      rationale: 'Aging core - limited window remaining',
      priority: 1
    });
  }

  return {
    windowStatus: teamConstruction.ageProfile.windowStatus,
    peakSeasons,
    keyExpirations,
    recommendations
  };
}

// Export utility function for getting championship DNA comparison
export function getChampionshipDNA(): typeof CHAMPIONSHIP_DNA {
  return CHAMPIONSHIP_DNA;
}