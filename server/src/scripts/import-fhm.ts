import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { Team, Player, PlayerSeasonStat, PlayerRating } from '../models/index.js';
import { sequelize } from '../db.js';

const CSV_DIR = path.resolve('C:\\Users\\jdelb\\AppData\\Local\\Out of the Park Developments\\Franchise Hockey Manager 12\\saved_games\\Joe.lg\\import_export\\csv');
const CURRENT_SEASON = 2025;

interface TeamCsvRow {
  TeamId: string;
  LeagueId: string;
  Name: string;
  Nickname: string;
  Abbr: string;
  'Primary Color': string;
  'Secondary Color': string;
  'Text Color': string;
  'Conference Id': string;
  'Division Id': string;
}

interface PlayerCsvRow {
  PlayerId: string;
  TeamId: string;
  FranchiseId: string;
  'First Name': string;
  'Last Name': string;
  'Nick Name': string;
  Height: string;
  Weight: string;
  'Date Of Birth': string;
  Birthcity: string;
  Birthstate: string;
  Nationality_One: string;
  Nationality_Two: string;
  Nationality_Three: string;
  Retired: string;
}

interface PlayerRatingCsvRow {
  PlayerId: string;
  G: string;
  LD: string;
  RD: string;
  LW: string;
  C: string;
  RW: string;
  Aggression: string;
  Bravery: string;
  Determination: string;
  Teamplayer: string;
  Leadership: string;
  Temperament: string;
  Professionalism: string;
  'Mental Toughness': string;
  'Goalie Stamina': string;
  Acceleration: string;
  Agility: string;
  Balance: string;
  Speed: string;
  Stamina: string;
  Strength: string;
  Fighting: string;
  Screening: string;
  'Getting Open': string;
  Passing: string;
  'Puck Handling': string;
  'Shooting Accuracy': string;
  'Shooting Range': string;
  'Offensive Read': string;
  Checking: string;
  Faceoffs: string;
  Hitting: string;
  Positioning: string;
  'Shot Blocking': string;
  Stickchecking: string;
  'Defensive Read': string;
  'G Positioning': string;
  'G Passing': string;
  'G Pokecheck': string;
  Blocker: string;
  Glove: string;
  Rebound: string;
  Recovery: string;
  'G Puckhandling': string;
  'Low Shots': string;
  'G Skating': string;
  Reflexes: string;
  Skating: string;
  Shooting: string;
  Playmaking: string;
  Defending: string;
  Physicality: string;
  Conditioning: string;
  Character: string;
  'Hockey Sense': string;
  'Goalie Technique': string;
  'Goalie Overall Positioning': string;
}

interface PlayerStatCsvRow {
  PlayerId: string;
  Year: string;
  'Team Id': string;
  'League Id': string;
  GP: string;
  G: string;
  A: string;
  '+/-': string;
  PIM: string;
  'PP G': string;
  'PP A': string;
  'SH G': string;
  'SH A': string;
  Fights: string;
  Fights_Won: string;
  HIT: string;
  GvA: string;
  TkA: string;
  SB: string;
  GR: string;
  'Game Rating Off': string;
  'Game Rating Def': string;
  SOG: string;
  TOI: string;
  PPTOI: string;
  SHTOI: string;
  PDO: string;
  'GF/60': string;
  'GA/60': string;
  'SF/60': string;
  'SA/60': string;
  CF: string;
  CA: string;
  'CF%': string;
  'CF% rel': string;
  FF: string;
  FA: string;
  'FF%': string;
  'FF% rel': string;
  GWG: string;
  FO: string;
  FOW: string;
}

function parseFloat(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

function parseInt(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function determinePosition(record: PlayerRatingCsvRow): string | null {
  const positions = {
    G: parseInt(record.G) || 0,
    LD: parseInt(record.LD) || 0,
    RD: parseInt(record.RD) || 0,
    LW: parseInt(record.LW) || 0,
    C: parseInt(record.C) || 0,
    RW: parseInt(record.RW) || 0
  };
  
  // Find the highest rated position
  let maxPosition = '';
  let maxValue = 0;
  
  for (const [pos, value] of Object.entries(positions)) {
    if (value > maxValue) {
      maxValue = value;
      maxPosition = pos;
    }
  }
  
  // If goalie rating is high (15+), they're definitely a goalie
  if (positions.G >= 15) return 'G';
  
  // For skaters, combine defense positions
  if (maxPosition === 'LD' || maxPosition === 'RD') return 'D';
  
  return maxPosition || null;
}

async function importTeams() {
  console.log('Importing teams...');
  const filePath = path.join(CSV_DIR, 'team_data.csv');
  
  if (!fs.existsSync(filePath)) {
    console.warn('team_data.csv not found, skipping teams import');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records: TeamCsvRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  for (const record of records) {
    await Team.upsert({
      teamId: parseInt(record.TeamId)!,
      leagueId: parseInt(record.LeagueId),
      name: record.Name,
      nickname: record.Nickname,
      abbr: record.Abbr,
      primaryColor: record['Primary Color'],
      secondaryColor: record['Secondary Color'],
      textColor: record['Text Color'],
      conferenceId: parseInt(record['Conference Id']),
      divisionId: parseInt(record['Division Id'])
    });
  }

  console.log(`Imported ${records.length} teams`);
}

async function importPlayers() {
  console.log('Importing players...');
  const filePath = path.join(CSV_DIR, 'player_master.csv');
  
  console.log('Looking for player_master.csv at:', filePath);
  console.log('File exists?', fs.existsSync(filePath));
  
  if (!fs.existsSync(filePath)) {
    console.error('player_master.csv not found!');
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log('File content length:', content.length);
    
    const records: PlayerCsvRow[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      relax_column_count: true,
      skip_records_with_error: true
    });
    
    console.log('Parsed records count:', records.length);

    // Prepare bulk data
    const playersData = [];
    let skipped = 0;
    
    for (const record of records) {
      const playerId = parseInt(record.PlayerId);
      // Skip invalid player IDs (0 or null)
      if (!playerId || playerId <= 0) {
        skipped++;
        continue;
      }
      
      const teamId = parseInt(record.TeamId);
      playersData.push({
        playerId: playerId,
        teamId: teamId && teamId > 0 ? teamId : null,
        franchiseId: parseInt(record.FranchiseId),
        firstName: record['First Name'],
        lastName: record['Last Name'],
        nickName: record['Nick Name'] || null,
        height: parseInt(record.Height),
        weight: parseInt(record.Weight),
        dateOfBirth: parseDate(record['Date Of Birth']),
        birthCity: record.Birthcity,
        birthState: record.Birthstate,
        nationalityOne: record.Nationality_One,
        nationalityTwo: record.Nationality_Two || null,
        nationalityThree: record.Nationality_Three || null,
        retired: record.Retired === '1'
      });
    }

    console.log(`Skipped ${skipped} invalid records, importing ${playersData.length} players...`);
    
    // Use bulkCreate with updateOnDuplicate for better performance
    await Player.bulkCreate(playersData, {
      updateOnDuplicate: ['teamId', 'franchiseId', 'firstName', 'lastName', 'nickName', 'height', 'weight', 'dateOfBirth', 'birthCity', 'birthState', 'nationalityOne', 'nationalityTwo', 'nationalityThree', 'retired', 'updatedAt']
    });

    console.log(`Imported ${playersData.length} players`);
  } catch (error) {
    console.error('Error importing players:', error);
  }
}

async function importPlayerRatings() {
  console.log('Importing player ratings...');
  const filePath = path.join(CSV_DIR, 'player_ratings.csv');
  
  if (!fs.existsSync(filePath)) {
    console.warn('player_ratings.csv not found, skipping ratings import');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records: PlayerRatingCsvRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  // Prepare bulk data
  const ratingsData = [];
  const positionUpdates = [];
  let skipped = 0;
  
  for (const record of records) {
    const playerId = parseInt(record.PlayerId);
    // Skip invalid player IDs (0 or null)
    if (!playerId || playerId <= 0) {
      skipped++;
      continue;
    }
    
    ratingsData.push({
      playerId: playerId,
      goalie: parseInt(record.G),
      leftDefense: parseInt(record.LD),
      rightDefense: parseInt(record.RD),
      leftWing: parseInt(record.LW),
      center: parseInt(record.C),
      rightWing: parseInt(record.RW),
      aggression: parseInt(record.Aggression),
      bravery: parseInt(record.Bravery),
      determination: parseInt(record.Determination),
      teamplayer: parseInt(record.Teamplayer),
      leadership: parseInt(record.Leadership),
      temperament: parseInt(record.Temperament),
      professionalism: parseInt(record.Professionalism),
      mentalToughness: parseInt(record['Mental Toughness']),
      goalieStamina: parseInt(record['Goalie Stamina']),
      acceleration: parseInt(record.Acceleration),
      agility: parseInt(record.Agility),
      balance: parseInt(record.Balance),
      speed: parseInt(record.Speed),
      stamina: parseInt(record.Stamina),
      strength: parseInt(record.Strength),
      fighting: parseInt(record.Fighting),
      screening: parseInt(record.Screening),
      gettingOpen: parseInt(record['Getting Open']),
      passing: parseInt(record.Passing),
      puckHandling: parseInt(record['Puck Handling']),
      shootingAccuracy: parseInt(record['Shooting Accuracy']),
      shootingRange: parseInt(record['Shooting Range']),
      offensiveRead: parseInt(record['Offensive Read']),
      checking: parseInt(record.Checking),
      faceoffs: parseInt(record.Faceoffs),
      hitting: parseInt(record.Hitting),
      positioning: parseInt(record.Positioning),
      shotBlocking: parseInt(record['Shot Blocking']),
      stickchecking: parseInt(record.Stickchecking),
      defensiveRead: parseInt(record['Defensive Read']),
      gPositioning: parseInt(record['G Positioning']),
      gPassing: parseInt(record['G Passing']),
      gPokecheck: parseInt(record['G Pokecheck']),
      blocker: parseInt(record.Blocker),
      glove: parseInt(record.Glove),
      rebound: parseInt(record.Rebound),
      recovery: parseInt(record.Recovery),
      gPuckhandling: parseInt(record['G Puckhandling']),
      lowShots: parseInt(record['Low Shots']),
      gSkating: parseInt(record['G Skating']),
      reflexes: parseInt(record.Reflexes),
      skating: parseInt(record.Skating),
      shooting: parseInt(record.Shooting),
      playmaking: parseInt(record.Playmaking),
      defending: parseInt(record.Defending),
      physicality: parseInt(record.Physicality),
      conditioning: parseInt(record.Conditioning),
      character: parseInt(record.Character),
      hockeySense: parseInt(record['Hockey Sense']),
      goalieTechnique: parseInt(record['Goalie Technique']),
      goalieOverallPositioning: parseInt(record['Goalie Overall Positioning'])
    });
    
    // Collect position updates
    const position = determinePosition(record);
    if (position) {
      positionUpdates.push({ playerId, position });
    }
  }

  console.log(`Skipped ${skipped} invalid records, importing ${ratingsData.length} player ratings...`);
  
  // Bulk create ratings
  await PlayerRating.bulkCreate(ratingsData, {
    updateOnDuplicate: Object.keys(ratingsData[0] || {}).filter(key => key !== 'playerId')
  });
  
  // Bulk update positions in batches
  console.log(`Updating positions for ${positionUpdates.length} players...`);
  for (const update of positionUpdates) {
    await Player.update(
      { position: update.position },
      { where: { playerId: update.playerId } }
    );
  }

  console.log(`Imported ${ratingsData.length} player ratings`);
}

async function importPlayerStats() {
  console.log('Importing player regular season career stats...');
  const filePath = path.join(CSV_DIR, 'player_skater_career_stats_rs.csv');
  
  // Get all valid team IDs from database
  console.log('Loading valid team IDs...');
  const validTeams = await Team.findAll({ attributes: ['teamId'] });
  const validTeamIds = new Set(validTeams.map(t => t.teamId));
  console.log(`Found ${validTeamIds.size} valid team IDs`);
  
  if (!fs.existsSync(filePath)) {
    console.warn('player_skater_career_stats_rs.csv not found, skipping stats import');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records: PlayerStatCsvRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  // Filter out empty rows (the CSV seems to have empty rows)
  const validRecords = records.filter(r => r.PlayerId && r.PlayerId.trim() !== '');
  console.log(`Found ${validRecords.length} valid stat records`);

  // Prepare bulk data
  const statsData = [];
  let skipped = 0;
  let invalidTeams = 0;
  
  for (const record of validRecords) {
    const playerId = parseInt(record.PlayerId);
    // Skip invalid player IDs (0 or null)
    if (!playerId || playerId <= 0) {
      skipped++;
      continue;
    }
    
    const teamId = parseInt(record['Team Id']);
    // Allow null team IDs - only use teamId if it exists in our teams table, otherwise null
    const validTeamId = teamId && validTeamIds.has(teamId) ? teamId : null;
    if (teamId && !validTeamId) {
      invalidTeams++;
    }
    
    statsData.push({
      playerId: playerId,
      teamId: validTeamId,
      franchiseId: parseInt(record['League Id']),
      season: parseInt(record.Year) || CURRENT_SEASON,
      gamesPlayed: parseInt(record.GP) || 0,
      goals: parseInt(record.G) || 0,
      assists: parseInt(record.A) || 0,
      plusMinus: parseInt(record['+/-']) || 0,
      penaltyMinutes: parseInt(record.PIM) || 0,
      powerPlayGoals: parseInt(record['PP G']) || 0,
      powerPlayAssists: parseInt(record['PP A']) || 0,
      shortHandedGoals: parseInt(record['SH G']) || 0,
      shortHandedAssists: parseInt(record['SH A']) || 0,
      fights: parseInt(record.Fights) || 0,
      fightsWon: parseInt(record['Fights Won']) || 0,
      hits: parseInt(record.HIT) || 0,
      giveaways: parseInt(record.GvA) || 0,
      takeaways: parseInt(record.TkA) || 0,
      shotBlocks: parseInt(record.SB) || 0,
      gameRating: parseInt(record.GR) || 0,
      shotsOnGoal: parseInt(record.SOG) || 0,
      timeOnIce: parseFloat(record.TOI),
      powerPlayTimeOnIce: parseFloat(record.PPTOI),
      shortHandedTimeOnIce: parseFloat(record.SHTOI),
      gameWinningGoals: parseInt(record.GWG) || 0,
      faceoffs: parseInt(record.FO),
      faceoffWins: parseInt(record['FO W'])
    });
  }

  console.log(`Skipped ${skipped} invalid player IDs, ${invalidTeams} historical team references nullified`);
  console.log(`Importing ${statsData.length} player season stats...`);
  
  // Bulk create stats in batches to handle large datasets
  const batchSize = 1000;
  for (let i = 0; i < statsData.length; i += batchSize) {
    const batch = statsData.slice(i, i + batchSize);
    console.log(`Importing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(statsData.length / batchSize)}`);
    
    await PlayerSeasonStat.bulkCreate(batch, {
      updateOnDuplicate: Object.keys(batch[0] || {}).filter(key => !['playerId', 'season'].includes(key))
    });
  }

  console.log(`Imported ${statsData.length} player season stats`);
}

async function main() {
  try {
    console.log('Starting FHM9 data import...');
    
    // Sync database first (without dropping tables)
    await sequelize.sync();
    console.log('Database synced');
    
    // Import in order (teams first, then players, then ratings/stats)
    await importTeams();
    await importPlayers();
    await importPlayerRatings();
    await importPlayerStats();
    
    console.log('FHM9 data import completed successfully!');
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

main();