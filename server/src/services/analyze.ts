// server/src/services/analyze.ts

import { Op } from 'sequelize';
import { Team, Player, PlayerSeasonStat, PlayerRating } from '../models/index.js';
import { playerValueScore, currentSeason } from './scoring.js';

type WeaknessType = 'offensive' | 'defensive' | 'physical' | 'overall_poor' | 'situational';

interface PlayerWeakness {
  type: WeaknessType;
  severity: number; // 1-5, 5 being worst
  description: string;
}

export async function getTeamPlayersByAbbrev(abbr: string): Promise<Player[]> {
  console.log('getTeamPlayersByAbbrev - looking for:', abbr);

  const team = await Team.findOne({ where: { abbr } });
  if (!team) {
    console.log('Team not found for abbr:', abbr);
    return [];
  }

  console.log('Found team:', team.name, 'with teamId:', team.teamId);
  const players = await Player.findAll({ 
    where: { 
      teamId: team.teamId,
      retired: false 
    },
    include: [{ model: Team, as: 'team' }]
  });
  console.log('Found active players for team:', players.length);

  return players;
}

export async function rankPlayers(players: Player[]) {
  const playerScores: Array<[Player, number]> = [];
  for (const player of players) {
    const score = await playerValueScore(player);
    playerScores.push([player, score]);
  }
  playerScores.sort((a, b) => a[1] - b[1]);
  return playerScores;
}

// Analyze a player's specific weaknesses to determine replacement strategy
export async function analyzePlayerWeakness(player: Player): Promise<PlayerWeakness> {
  // Get the player's ratings and recent stats
  const [ratings, recentStats] = await Promise.all([
    PlayerRating.findOne({ where: { playerId: player.playerId } }),
    PlayerSeasonStat.findAll({ 
      where: { playerId: player.playerId },
      order: [['season', 'DESC']],
      limit: 3
    })
  ]);

  if (!ratings || !recentStats.length) {
    return {
      type: 'overall_poor',
      severity: 5,
      description: 'Insufficient data to analyze player performance'
    };
  }

  // Calculate average stats from recent seasons
  const avgStats = recentStats.reduce((acc, stat) => {
    const games = Math.max(stat.gamesPlayed || 0, 1);
    return {
      pointsPerGame: acc.pointsPerGame + ((stat.goals || 0) + (stat.assists || 0)) / games,
      plusMinus: acc.plusMinus + (stat.plusMinus || 0),
      timeOnIce: acc.timeOnIce + ((stat.timeOnIce || 0) / games),
      giveaways: acc.giveaways + ((stat.giveaways || 0) / games),
      takeaways: acc.takeaways + ((stat.takeaways || 0) / games),
      hits: acc.hits + ((stat.hits || 0) / games)
    };
  }, {
    pointsPerGame: 0,
    plusMinus: 0,
    timeOnIce: 0,
    giveaways: 0,
    takeaways: 0,
    hits: 0
  });

  // Average the accumulated stats
  Object.keys(avgStats).forEach(key => {
    (avgStats as any)[key] /= recentStats.length;
  });

  // Analyze based on position and performance metrics
  const isForward = ['LW', 'C', 'RW', 'F'].includes(player.position);
  const isDefense = ['D', 'LD', 'RD'].includes(player.position);
  const isGoalie = player.position === 'G';

  // Offensive weakness analysis
  if (isForward && avgStats.pointsPerGame < 0.3) {
    return {
      type: 'offensive',
      severity: avgStats.pointsPerGame < 0.15 ? 5 : 4,
      description: `Low offensive production (${avgStats.pointsPerGame.toFixed(2)} PPG). Struggles to generate or finish scoring chances.`
    };
  }

  // Defensive weakness analysis
  if (avgStats.plusMinus < -15 && avgStats.timeOnIce > 15) {
    return {
      type: 'defensive',
      severity: avgStats.plusMinus < -25 ? 5 : 4,
      description: `Poor defensive play (${avgStats.plusMinus.toFixed(1)} +/-). Frequently on ice for goals against.`
    };
  }

  // Physical/engagement weakness
  if (isForward && avgStats.hits < 0.5 && avgStats.takeaways < 0.3) {
    return {
      type: 'physical',
      severity: 3,
      description: 'Low physical engagement. Not contributing hits or defensive takeaways.'
    };
  }

  // Situational weakness (high giveaways, low ice time despite opportunity)
  if (avgStats.giveaways > 1.0 && avgStats.takeaways < avgStats.giveaways * 0.5) {
    return {
      type: 'situational',
      severity: 3,
      description: 'Poor puck management. High giveaways relative to takeaways.'
    };
  }

  // If no specific weakness found but player is being analyzed, assume general underperformance
  return {
    type: 'overall_poor',
    severity: 2,
    description: 'General underperformance relative to role expectations.'
  };
}

// Determine what positions could help address a specific weakness
export function getRelevantPositionsForWeakness(playerPosition: string, weakness: PlayerWeakness): string[] {
  const isForward = ['LW', 'C', 'RW', 'F'].includes(playerPosition);
  const isDefense = ['D', 'LD', 'RD'].includes(playerPosition);
  const isGoalie = playerPosition === 'G';

  switch (weakness.type) {
    case 'offensive':
      if (isForward) {
        // For weak offensive forwards, look for:
        // 1. Same position upgrades
        // 2. Centers who can elevate linemates
        return playerPosition === 'C' 
          ? ['C', 'LW', 'RW'] // Centers can sometimes play wing
          : ['C', playerPosition]; // Wings need good centers
      }
      if (isDefense) {
        // For defensemen with offensive struggles, look for offensive defensemen
        return ['D', 'LD', 'RD'];
      }
      return [playerPosition];

    case 'defensive':
      if (isForward) {
        // For defensively weak forwards:
        // 1. Two-way centers who can cover
        // 2. Defensive specialists in same position
        return playerPosition === 'C'
          ? ['C'] // Centers are key to defensive structure
          : ['C', playerPosition]; // Wings benefit from defensive centers
      }
      if (isDefense) {
        // For weak defensive defensemen, need shutdown defensemen
        return ['D', 'LD', 'RD'];
      }
      return [playerPosition];

    case 'physical':
      // Physical weakness can be addressed by:
      // 1. Same position with more physicality
      // 2. Centers who can control play physically
      return isForward 
        ? ['C', playerPosition]
        : [playerPosition];

    case 'situational':
      // Situational problems (puck management, etc.) need:
      // 1. High hockey IQ players in same role
      // 2. Playmaking centers for support
      return isForward
        ? playerPosition === 'C' ? ['C'] : ['C', playerPosition]
        : [playerPosition];

    case 'overall_poor':
    default:
      // General underperformance - look for direct upgrades
      return [playerPosition];
  }
}

export async function findCandidates(target: Player, mode: 'win-now' | 'rebuild'): Promise<Player[]> {
  const baseScore = await playerValueScore(target);
  
  // Analyze what type of weakness this player has
  const weakness = await analyzePlayerWeakness(target);
  
  // Find solutions based on the weakness type and team context
  const searchPositions = getRelevantPositionsForWeakness(target.position, weakness);
  
  const others = await Player.findAll({
    where: {
      teamId: { [Op.ne]: target.teamId },
      position: { [Op.in]: searchPositions },
      retired: false
    },
    include: [{
      model: Team,
      as: 'team',
      where: {
        leagueId: [0, 1] // NHL and AHL only
      }
    }],
    limit: 2000
  });

  console.log(`Found ${others.length} potential replacements from NHL/AHL for player ${target.playerId}`);

  const scoredCandidates: Array<[Player, number]> = [];
  for (const player of others) {
    const score = await playerValueScore(player);
    // Only consider players who are meaningfully better (not just barely better)
    if (score > baseScore + 5) { // Require meaningful improvement
      scoredCandidates.push([player, score]);
    }
  }

  console.log(`Found ${scoredCandidates.length} meaningfully better players than target score ${baseScore}`);

  if (mode === 'win-now') {
    scoredCandidates.sort((a, b) => b[1] - a[1]);
  } else {
    // rebuild: prefer younger players, tiebreak by score
    scoredCandidates.sort((a, b) => {
      const birthYearA = a[0].dateOfBirth ? new Date(a[0].dateOfBirth).getFullYear() : 0;
      const birthYearB = b[0].dateOfBirth ? new Date(b[0].dateOfBirth).getFullYear() : 0;
      return (birthYearB - birthYearA) || (b[1] - a[1]);
    });
  }

  return scoredCandidates.slice(0, 3).map(([player]) => player); // Reduced to top 3
}

export async function maybeReassignNote(player: Player): Promise<string | null> {
  const season = await currentSeason();
  const stat = await PlayerSeasonStat.findOne({ where: { playerId: player.playerId, season: season } });
  if (!stat) return null;

  const points = (stat.goals ?? 0) + (stat.assists ?? 0);
  const avgTimeOnIce = (stat.timeOnIce ?? 0) / Math.max(stat.gamesPlayed, 1);

  if ((stat.assists ?? 0) > (stat.goals ?? 0) * 1.5 && points < 20) return 'Playmaker usage—pair with a finisher and give PP2 minutes.';
  if (avgTimeOnIce < 11 && points < 10) return 'Low TOI—try promoting to L3 with sheltered ozone starts.';
  if ((stat.plusMinus ?? 0) < -10 && avgTimeOnIce > 21) return 'Overmatched vs top comp—drop to 2nd/3rd pair with a defensive partner.';

  return null;
}

export async function analyze({
  mode,
  teamAbbrev,
  playerIds
}: {
  mode: 'win-now' | 'rebuild',
  teamAbbrev?: string,
  playerIds?: number[]
}) {
  const players = (playerIds?.length
    ? await Player.findAll({ 
        where: { 
          playerId: { [Op.in]: playerIds },
          retired: false
        },
        include: [{ model: Team, as: 'team' }]
      })
    : (teamAbbrev ? await getTeamPlayersByAbbrev(teamAbbrev) : [])
  );

  if (!players.length) return { weakLinks: [], replacements: [] };

  const ranked = await rankPlayers(players);
  const worstFive = ranked.slice(0, Math.min(5, ranked.length)).map(([p]) => p);

  const weakLinks: Array<{ player: any; reason: string }> = [];
  const replacements: Array<any> = [];

  for (const weakPlayer of worstFive) {
    const team = weakPlayer.team;
    const reassignmentNote = await maybeReassignNote(weakPlayer);

    weakLinks.push({
      player: {
        id: weakPlayer.playerId,
        name: `${weakPlayer.firstName} ${weakPlayer.lastName}`,
        teamAbbrev: team?.abbr ?? null
      },
      reason: reassignmentNote ?? 'Low composite score vs teammates.'
    });

    if (reassignmentNote) {
      replacements.push({ forPlayerId: weakPlayer.playerId, suggestionType: 'reassign', note: reassignmentNote });
    } else {
      const candidates = await findCandidates(weakPlayer, mode);
      if (candidates.length) {
        const topCandidate = candidates[0];
        const candidateTeam = topCandidate.team;
        replacements.push({
          forPlayerId: weakPlayer.playerId,
          suggestionType: 'replace',
          note: `Upgrade with ${topCandidate.firstName} ${topCandidate.lastName}`,
          candidate: {
            id: topCandidate.playerId,
            name: `${topCandidate.firstName} ${topCandidate.lastName}`,
            teamAbbrev: candidateTeam?.abbr ?? null
          }
        });
      } else {
        replacements.push({
          forPlayerId: weakPlayer.playerId,
          suggestionType: 'replace',
          note: 'No obvious external upgrade found—consider internal promotion.'
        });
      }
    }
  }

  return { weakLinks, replacements };
}

// Enhanced analysis with specific weakness identification
export async function analyzeWithWeaknessDetails({
  mode,
  teamAbbrev,
  playerIds
}: {
  mode: 'win-now' | 'rebuild',
  teamAbbrev?: string,
  playerIds?: number[]
}) {
  const players = (playerIds?.length
    ? await Player.findAll({ 
        where: { 
          playerId: { [Op.in]: playerIds },
          retired: false
        },
        include: [{ model: Team, as: 'team' }]
      })
    : (teamAbbrev ? await getTeamPlayersByAbbrev(teamAbbrev) : [])
  );

  if (!players.length) return { weakLinks: [], replacements: [] };

  const ranked = await rankPlayers(players);
  const worstFive = ranked.slice(0, Math.min(5, ranked.length)).map(([p]) => p);

  const weakLinks: Array<{ 
    player: any; 
    reason: string;
    weakness: PlayerWeakness;
    contextualSolution: string;
  }> = [];
  const replacements: Array<any> = [];

  for (const weakPlayer of worstFive) {
    const team = weakPlayer.team;
    const weakness = await analyzePlayerWeakness(weakPlayer);
    const reassignmentNote = await maybeReassignNote(weakPlayer);

    // Generate contextual solution based on weakness type
    let contextualSolution = '';
    switch (weakness.type) {
      case 'offensive':
        contextualSolution = weakPlayer.position === 'C' 
          ? 'Consider a playmaking center to elevate linemates, or offensive specialist'
          : 'Needs better center support or direct offensive upgrade';
        break;
      case 'defensive':
        contextualSolution = 'Requires defensive specialist or better positional player';
        break;
      case 'physical':
        contextualSolution = 'Team lacks physical presence - consider power forward or enforcer';
        break;
      case 'situational':
        contextualSolution = 'Needs high hockey IQ player with better decision making';
        break;
      default:
        contextualSolution = 'Direct positional upgrade recommended';
    }

    weakLinks.push({
      player: {
        id: weakPlayer.playerId,
        name: `${weakPlayer.firstName} ${weakPlayer.lastName}`,
        position: weakPlayer.position,
        teamAbbrev: team?.abbr ?? null
      },
      reason: weakness.description,
      weakness,
      contextualSolution
    });

    if (reassignmentNote) {
      replacements.push({ 
        forPlayerId: weakPlayer.playerId, 
        suggestionType: 'reassign', 
        note: reassignmentNote,
        weakness: weakness.type
      });
    } else {
      const candidates = await findCandidates(weakPlayer, mode);
      if (candidates.length) {
        const topCandidate = candidates[0];
        const candidateTeam = topCandidate.team;
        replacements.push({
          forPlayerId: weakPlayer.playerId,
          suggestionType: 'replace',
          note: `${contextualSolution}: ${topCandidate.firstName} ${topCandidate.lastName}`,
          candidate: {
            id: topCandidate.playerId,
            name: `${topCandidate.firstName} ${topCandidate.lastName}`,
            position: topCandidate.position,
            teamAbbrev: candidateTeam?.abbr ?? null
          },
          weakness: weakness.type,
          reasoning: `Addresses ${weakness.type} weakness: ${weakness.description}`
        });
      } else {
        replacements.push({
          forPlayerId: weakPlayer.playerId,
          suggestionType: 'replace',
          note: `${contextualSolution} - No obvious external upgrade found.`,
          weakness: weakness.type
        });
      }
    }
  }

  return { weakLinks, replacements };
}
