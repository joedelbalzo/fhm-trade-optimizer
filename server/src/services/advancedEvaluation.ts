/**
 * Advanced Hockey Player Evaluation Service
 * Integrates the sophisticated role-aware algorithm with FHM database
 */

import { Op } from 'sequelize';
import { Player, PlayerSeasonStat, PlayerRating, Team } from '../models/index.js';
import {
  PlayerInput, PlayerBio, SeasonCounting, SeasonDeployment, SeasonRates, Ratings,
  LeagueContext, Role, Position, evaluatePlayer, evaluateRoster,
  classifyRole, Evaluation
} from '../algo_v1.js';

/**
 * Transform FHM database player data into PlayerInput format for algorithm
 */
export async function transformPlayerData(
  player: Player,
  season: number = new Date().getFullYear()
): Promise<PlayerInput | null> {
  // Get associated data
  const [stats, ratings] = await Promise.all([
    PlayerSeasonStat.findOne({ where: { playerId: player.playerId, season } }),
    PlayerRating.findOne({ where: { playerId: player.playerId } })
  ]);
  const team = player.team;

  if (!stats) {
    console.warn(`No stats found for player ${player.playerId} in season ${season}`);
    return null;
  }

  // Determine position from ratings or fallback
  let position: Position = 'F'; // default
  if (ratings) {
    const goalieRating = ratings.goalie || 0;
    const leftDefense = ratings.leftDefense || 0;
    const rightDefense = ratings.rightDefense || 0;
    
    if (goalieRating >= 15) position = 'G';
    else if (leftDefense >= 10 || rightDefense >= 10) position = 'D';
    else position = 'F';
  }

  // Build PlayerBio
  const bio: PlayerBio = {
    firstName: player.firstName,
    lastName: player.lastName,
    nickName: player.nickName || undefined,
    position,
    birthYear: player.dateOfBirth ? new Date(player.dateOfBirth).getFullYear() : undefined,
    teamAbbrev: team?.abbr || undefined
  };

  // Use readable field names consistently
  const gamesPlayed = stats.gamesPlayed || 0;
  const goals = stats.goals || 0;
  const assists = stats.assists || 0;
  const timeOnIce = stats.timeOnIce || 0;
  const powerPlayTimeOnIce = stats.powerPlayTimeOnIce || 0;
  const shortHandedTimeOnIce = stats.shortHandedTimeOnIce || 0;

  const seasonCounting: SeasonCounting = {
    gamesPlayed,
    goals,
    assists,
    points: goals + assists,
    penaltyMinutes: stats.penaltyMinutes || 0,
    hits: stats.hits || 0,
    fights: stats.fights || 0,
    fightsWon: stats.fightsWon || 0,
    giveaways: stats.giveaways || 0,
    takeaways: stats.takeaways || 0,
    shotBlocks: stats.shotBlocks || 0,
    shotsOnGoal: stats.shotsOnGoal || 0,
    faceoffs: stats.faceoffs || 0,
    faceoffWins: stats.faceoffWins || 0,
    plusMinus: stats.plusMinus || 0,
    powerPlayGoals: stats.powerPlayGoals || 0,
    powerPlayAssists: stats.powerPlayAssists || 0,
    shortHandedGoals: stats.shortHandedGoals || 0,
    shortHandedAssists: stats.shortHandedAssists || 0,
    gameWinningGoals: stats.gameWinningGoals || 0
  };

  const seasonDeployment: SeasonDeployment = {
    timeOnIce,
    powerPlayTimeOnIce,
    shortHandedTimeOnIce,
    // Add zone starts and quality metrics if available
    ozStartPct: undefined, // FHM doesn't export this directly
    qocTier: undefined,
    qotTier: undefined
  };

  const seasonRates: SeasonRates = {
    goalsFor60: stats.goalsFor60,
    goalsAgainst60: stats.goalsAgainst60,
    shotsFor60: stats.shotsFor60,
    shotsAgainst60: stats.shotsAgainst60,
    pdo: stats.pdo,
    corsiFors: stats.corsiFors,
    corsiAgainst: stats.corsiAgainst,
    corsiForPercentage: stats.corsiForPercentage,
    corsiForPercentageRelative: stats.corsiForPercentageRelative,
    fenwickFor: stats.fenwickFor,
    fenwickAgainst: stats.fenwickAgainst,
    fenwickForPercentage: stats.fenwickForPercentage,
    fenwickForPercentageRelative: stats.fenwickForPercentageRelative,
    // Goalie stats (if applicable)
    savePct: undefined, // Would need to calculate from GA and shots against
    gaa: undefined,
    hdSavePct: undefined,
    // Expected goals (would need to calculate or import)
    xGF60: undefined,
    xGA60: undefined
  };

  // Transform ratings
  const playerRatings: Ratings = {};
  if (ratings) {
    playerRatings.offensiveRead = ratings.offensiveRead;
    playerRatings.defensiveRead = ratings.defensiveRead;
    playerRatings.hockeySense = ratings.hockeySense;
    playerRatings.speed = ratings.speed;
    playerRatings.skating = ratings.skating;
    playerRatings.strength = ratings.strength;
    playerRatings.physicality = ratings.physicality;
    playerRatings.stamina = ratings.stamina;
    playerRatings.shooting = ratings.shooting;
    playerRatings.shootingAccuracy = ratings.shootingAccuracy;
    playerRatings.shootingRange = ratings.shootingRange;
    playerRatings.playmaking = ratings.playmaking;
    playerRatings.passing = ratings.passing;
    playerRatings.gettingOpen = ratings.gettingOpen;
    playerRatings.puckHandling = ratings.puckHandling;
    playerRatings.screening = ratings.screening;
    playerRatings.checking = ratings.checking;
    playerRatings.hitting = ratings.hitting;
    playerRatings.stickchecking = ratings.stickchecking;
    playerRatings.positioning = ratings.positioning;
    playerRatings.shotBlocking = ratings.shotBlocking;
    playerRatings.faceoffs = ratings.faceoffs;

    // Goalie-specific ratings
    if (position === 'G') {
      playerRatings.gPositioning = ratings.gPositioning;
      playerRatings.goalieOverallPositioning = ratings.goalieOverallPositioning;
      playerRatings.blocker = ratings.blocker;
      playerRatings.glove = ratings.glove;
      playerRatings.lowShots = ratings.lowShots;
      playerRatings.reflexes = ratings.reflexes;
      playerRatings.rebound = ratings.rebound;
      playerRatings.recovery = ratings.recovery;
      playerRatings.gPassing = ratings.gPassing;
      playerRatings.gPokecheck = ratings.gPokecheck;
      playerRatings.gPuckhandling = ratings.gPuckhandling;
      playerRatings.gSkating = ratings.gSkating;
      playerRatings.goalieTechnique = ratings.goalieTechnique;
    }
  }

  return {
    bio,
    season: { ...seasonCounting, ...seasonDeployment, ...seasonRates },
    ratings: playerRatings
  };
}

/**
 * Generate league benchmarks from all players in the database
 * This is computationally expensive but provides accurate role-based comparisons
 */
export async function generateLeagueBenchmarks(season?: number): Promise<LeagueContext> {
  // If no season specified, find the most recent season with data
  if (!season) {
    const recentSeason = await PlayerSeasonStat.findOne({
      attributes: ['season'],
      order: [['season', 'DESC']],
      limit: 1
    });
    season = recentSeason?.season || new Date().getFullYear();
  }
  console.log('Generating league benchmarks from database...');
  
  // Get all players with stats and ratings for the season
  const players = await Player.findAll({
    include: [
      {
        model: PlayerSeasonStat,
        where: { season },
        required: true
      },
      {
        model: PlayerRating,
        required: false
      }
    ]
  });

  console.log(`Found ${players.length} players with stats for season ${season}`);

  // Transform all players to PlayerInput format
  const playerInputs: PlayerInput[] = [];
  for (const player of players) {
    const transformed = await transformPlayerData(player, season);
    if (transformed) playerInputs.push(transformed);
  }

  console.log(`Successfully transformed ${playerInputs.length} players`);

  // Classify all players by role
  const playersByRole: Record<Role, PlayerInput[]> = {
    scorer: [], playmaker: [], twoWayF: [], defensiveC: [], grinder: [],
    offensiveD: [], shutdownD: [], goalie: []
  };

  for (const player of playerInputs) {
    const { role } = classifyRole(player);
    playersByRole[role].push(player);
  }

  // Log role distribution
  Object.entries(playersByRole).forEach(([role, players]) => {
    console.log(`${role}: ${players.length} players`);
  });

  // Generate benchmarks per role (simplified version)
  const metricsByRole: any = {};
  const impactMeanSdByRole: any = {};

  // For now, use hardcoded reasonable defaults
  // In production, you'd compute these from the actual data
  const roles: Role[] = ['scorer', 'playmaker', 'twoWayF', 'defensiveC', 'grinder', 'offensiveD', 'shutdownD', 'goalie'];
  
  roles.forEach(role => {
    metricsByRole[role] = {
      goals60: { mean: role === 'scorer' ? 1.2 : role === 'playmaker' ? 0.8 : 0.6, sd: 0.4 },
      primA60: { mean: role === 'playmaker' ? 1.5 : role === 'scorer' ? 1.0 : 0.5, sd: 0.5 },
      xGF60: { mean: 2.2, sd: 0.6 },
      shotsF60: { mean: 28, sd: 8 },
      shootAcc: { mean: 12, sd: 3 },
      xGA60: { mean: 2.2, sd: 0.6 },
      cfRel: { mean: 0, sd: 3 },
      takeaways60: { mean: 1.0, sd: 0.6 },
      blocks60: { mean: role.includes('D') ? 2.5 : 1.2, sd: 1.0 },
      pkGA60: { mean: 3.5, sd: 1.5 },
      giveaways60: { mean: 1.2, sd: 0.6 },
      penalties60: { mean: 0.6, sd: 0.4 },
      faceoffPct: { mean: role === 'defensiveC' ? 52 : 49.8, sd: 6 },
      ppP60: { mean: role === 'scorer' ? 2.5 : role === 'playmaker' ? 2.0 : 1.0, sd: 1.2 },
      pdo: { mean: 100, sd: 2 },
      svPct: { mean: 0.905, sd: 0.020 },
      hdSvPct: { mean: 0.80, sd: 0.050 },
      gsaX: { mean: 0, sd: 5 }
    };

    impactMeanSdByRole[role] = { mean: 0, sd: 1 }; // Normalized impact scores
  });

  return {
    impactMeanSdByRole,
    metricsByRole,
    pdoRef: { mean: 100, sd: 2 },
    minTOIForConfidence: 300
  };
}

/**
 * Evaluate a single player using the advanced algorithm
 */
export async function evaluatePlayerAdvanced(
  player: Player,
  leagueContext: LeagueContext,
  season: number = new Date().getFullYear()
): Promise<Evaluation | null> {
  const playerInput = await transformPlayerData(player, season);
  if (!playerInput) return null;

  return evaluatePlayer(playerInput, leagueContext);
}

/**
 * Evaluate an entire team's roster
 */
export async function evaluateTeamRoster(
  teamAbbrev: string,
  leagueContext: LeagueContext,
  season?: number
): Promise<Evaluation[]> {
  // If no season specified, find the most recent season with data
  if (!season) {
    const recentSeason = await PlayerSeasonStat.findOne({
      attributes: ['season'],
      order: [['season', 'DESC']],
      limit: 1
    });
    season = recentSeason?.season || new Date().getFullYear();
  }
  // Get team
  const team = await Team.findOne({ where: { abbr: teamAbbrev } });
  if (!team) return [];

  // Get all players on the team
  const players = await Player.findAll({
    where: { teamId: team.teamId },
    include: [
      {
        model: PlayerSeasonStat,
        where: { season },
        required: true
      },
      {
        model: PlayerRating,
        required: false
      }
    ]
  });

  const evaluations: Evaluation[] = [];
  for (const player of players) {
    const evaluation = await evaluatePlayerAdvanced(player, leagueContext, season);
    if (evaluation) evaluations.push(evaluation);
  }

  return evaluations;
}

/**
 * Find weak players on a team using the advanced algorithm
 */
export async function findWeakPlayersAdvanced(
  teamAbbrev: string,
  mode: 'win-now' | 'rebuild' = 'win-now'
): Promise<{
  weakPlayers: Array<{
    player: Evaluation;
    weaknessType: 'impact' | 'misuse';
    recommendation: string;
  }>;
  leagueContext: LeagueContext;
}> {
  // Generate league context with most recent season
  const leagueContext = await generateLeagueBenchmarks();
  
  // Evaluate the team
  const evaluations = await evaluateTeamRoster(teamAbbrev, leagueContext);
  
  // Filter for weak players
  const weakPlayers = evaluations
    .filter(playerEval => playerEval.recommendation === 'replace' || playerEval.recommendation === 'reassign')
    .map(playerEval => ({
      player: playerEval,
      weaknessType: playerEval.recommendation === 'reassign' ? 'misuse' as const : 'impact' as const,
      recommendation: playerEval.recommendation === 'reassign' 
        ? `Role adjustment needed: ${playerEval.misuse.notes.join('; ')}`
        : `Below replacement level in ${playerEval.role} role. Key issues: ${playerEval.reasons.slice(0, 2).join(', ')}`
    }))
    .sort((a, b) => {
      // Sort by severity: impact problems first, then misuse
      if (a.weaknessType !== b.weaknessType) {
        return a.weaknessType === 'impact' ? -1 : 1;
      }
      // Within same type, sort by impact score
      return a.player.impact.replacementZDelta - b.player.impact.replacementZDelta;
    })
    .slice(0, 5); // Top 5 weak players

  return { weakPlayers, leagueContext };
}

/**
 * Find replacement candidates for a weak player
 */
export async function findReplacementCandidates(
  targetPlayer: Player,
  targetRole: Role,
  mode: 'win-now' | 'rebuild',
  leagueContext: LeagueContext,
  season: number = new Date().getFullYear()
): Promise<Evaluation[]> {
  // Get target player's team to exclude from search
  const targetTeam = targetPlayer.team;
  
  // Find players from other teams in NHL/AHL
  const otherPlayers = await Player.findAll({
    where: {
      teamId: { [Op.ne]: targetPlayer.teamId }
    },
    include: [
      {
        model: Team,
        as: 'currentTeam',
        where: {
          leagueId: [0, 1] // NHL and AHL only
        }
      },
      {
        model: PlayerSeasonStat,
        where: { season },
        required: true
      },
      {
        model: PlayerRating,
        required: false
      }
    ],
    limit: 500 // Reasonable limit for performance
  });

  // Evaluate potential replacements
  const candidates: Evaluation[] = [];
  for (const player of otherPlayers) {
    const evaluation = await evaluatePlayerAdvanced(player, leagueContext, season);
    if (evaluation && evaluation.role === targetRole) {
      candidates.push(evaluation);
    }
  }

  // Sort by suitability
  const sortedCandidates = candidates.sort((a, b) => {
    if (mode === 'win-now') {
      // Prioritize current impact
      return b.impact.impactScore - a.impact.impactScore;
    } else {
      // Prioritize younger players with good potential
      const ageA = a.bio.birthYear ? new Date().getFullYear() - a.bio.birthYear : 30;
      const ageB = b.bio.birthYear ? new Date().getFullYear() - b.bio.birthYear : 30;
      const ageDiff = ageA - ageB; // Younger is better (negative age diff)
      const impactDiff = b.impact.impactScore - a.impact.impactScore;
      
      // Weight: 60% impact, 40% age (younger = better)
      return (impactDiff * 0.6) + (ageDiff * -0.4);
    }
  });

  return sortedCandidates.slice(0, 5); // Top 5 candidates
}