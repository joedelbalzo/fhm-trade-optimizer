import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { Team, Player, PlayerSeasonStat, PlayerRating, PlayerContract, PlayerGameStat, TeamLine, Staff } from '../models/index.js';
import { sequelize } from '../db.js';

const CSV_DIR = path.resolve('C:\\Users\\jdelb\\AppData\\Local\\Out of the Park Developments\\Franchise Hockey Manager 12\\saved_games\\Joe.lg\\import_export\\csv');
const CURRENT_SEASON = 2025;

function parseFloat(value: string): number | null {
  if (!value || value.trim() === '' || value === '-1') return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

function parseInt(value: string): number | null {
  if (!value || value.trim() === '' || value === '-1') return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseBoolean(value: string): boolean {
  if (!value || value.trim() === '') return false;
  return value.toLowerCase() === 'yes' || value === '1';
}

function determinePosition(record: any): string | null {
  const positions = {
    G: parseInt(record.G) || 0,
    LD: parseInt(record.LD) || 0,
    RD: parseInt(record.RD) || 0,
    LW: parseInt(record.LW) || 0,
    C: parseInt(record.C) || 0,
    RW: parseInt(record.RW) || 0
  };

  let maxPosition = '';
  let maxValue = 0;

  for (const [pos, value] of Object.entries(positions)) {
    if (value > maxValue) {
      maxValue = value;
      maxPosition = pos;
    }
  }

  if (positions.G >= 15) return 'G';
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
  const records = parse(content, {
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

  if (!fs.existsSync(filePath)) {
    console.error('player_master.csv not found!');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
    relax_column_count: true,
    skip_records_with_error: true
  });

  const playersData = [];
  let skipped = 0;

  for (const record of records) {
    const playerId = parseInt(record.PlayerId);
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

  await Player.bulkCreate(playersData, {
    updateOnDuplicate: ['teamId', 'franchiseId', 'firstName', 'lastName', 'nickName', 'height', 'weight', 'dateOfBirth', 'birthCity', 'birthState', 'nationalityOne', 'nationalityTwo', 'nationalityThree', 'retired', 'updatedAt']
  });

  console.log(`Imported ${playersData.length} players`);
}

async function importPlayerRatings() {
  console.log('Importing player ratings...');
  const filePath = path.join(CSV_DIR, 'player_ratings.csv');

  if (!fs.existsSync(filePath)) {
    console.warn('player_ratings.csv not found, skipping ratings import');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  const ratingsData = [];
  const positionUpdates = [];
  let skipped = 0;

  for (const record of records) {
    const playerId = parseInt(record.PlayerId);
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

    const position = determinePosition(record);
    if (position) {
      positionUpdates.push({ playerId, position });
    }
  }

  console.log(`Skipped ${skipped} invalid records, importing ${ratingsData.length} player ratings...`);

  await PlayerRating.bulkCreate(ratingsData, {
    updateOnDuplicate: Object.keys(ratingsData[0] || {}).filter(key => key !== 'playerId')
  });

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
  console.log('Importing player regular season stats...');
  const filePath = path.join(CSV_DIR, 'player_skater_stats_rs.csv');

  const validTeams = await Team.findAll({ attributes: ['teamId'] });
  const validTeamIds = new Set(validTeams.map(t => t.teamId));

  if (!fs.existsSync(filePath)) {
    console.warn('player_skater_stats_rs.csv not found, skipping stats import');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  const validRecords = records.filter((r: any) => r.PlayerId && r.PlayerId.trim() !== '');
  console.log(`Found ${validRecords.length} valid stat records`);

  const statsData = [];
  let skipped = 0;

  for (const record of validRecords) {
    const playerId = parseInt(record.PlayerId);
    if (!playerId || playerId <= 0) {
      skipped++;
      continue;
    }

    const teamId = parseInt(record.TeamId);
    const validTeamId = teamId && validTeamIds.has(teamId) ? teamId : null;

    statsData.push({
      playerId: playerId,
      teamId: validTeamId,
      franchiseId: parseInt(record.FranchiseId),
      season: CURRENT_SEASON,
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
      fightsWon: parseInt(record.Fights_Won) || 0,
      hits: parseInt(record.HIT) || 0,
      giveaways: parseInt(record.GvA) || 0,
      takeaways: parseInt(record.TkA) || 0,
      shotBlocks: parseInt(record.SB) || 0,
      gameRating: parseInt(record.GR) || 0,
      gameRatingOff: parseFloat(record['Game Rating Off']),
      gameRatingDef: parseFloat(record['Game Rating Def']),
      shotsOnGoal: parseInt(record.SOG) || 0,
      timeOnIce: parseFloat(record.TOI),
      powerPlayTimeOnIce: parseFloat(record.PPTOI),
      shortHandedTimeOnIce: parseFloat(record.SHTOI),
      pdo: parseFloat(record.PDO),
      goalsFor60: parseFloat(record['GF/60']),
      goalsAgainst60: parseFloat(record['GA/60']),
      shotsFor60: parseFloat(record['SF/60']),
      shotsAgainst60: parseFloat(record['SA/60']),
      corsiFors: parseInt(record.CF),
      corsiAgainst: parseInt(record.CA),
      corsiForPercentage: parseFloat(record['CF%']),
      corsiForPercentageRelative: parseFloat(record['CF% rel']),
      fenwickFor: parseInt(record.FF),
      fenwickAgainst: parseInt(record.FA),
      fenwickForPercentage: parseFloat(record['FF%']),
      fenwickForPercentageRelative: parseFloat(record['FF% rel']),
      gameWinningGoals: parseInt(record.GWG) || 0,
      faceoffs: parseInt(record.FO),
      faceoffWins: parseInt(record.FOW)
    });
  }

  console.log(`Importing ${statsData.length} player season stats...`);

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

async function importContracts() {
  console.log('Importing player contracts...');

  // Helper function to parse a contract file
  function parseContractFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      relax_column_count: true,
      skip_records_with_error: true,
      relax_quotes: true
    });

    const contractsData = [];

    for (const record of records) {
      const playerId = parseInt(record.PlayerId);
      if (!playerId || playerId <= 0) {
        continue;
      }

      const teamId = parseInt(record.Team);

      // Parse year-by-year salaries
      const majorSalaries: Record<string, number> = {};
      const minorSalaries: Record<string, number> = {};

      for (let year = 2025; year <= 2038; year++) {
        const majorKey = `Major ${year}`;
        const minorKey = `Minor ${year}`;

        const majorVal = parseInt(record[majorKey]);
        const minorVal = parseInt(record[minorKey]);

        if (majorVal && majorVal > 0) {
          majorSalaries[year.toString()] = majorVal;
        }
        if (minorVal && minorVal > 0) {
          minorSalaries[year.toString()] = minorVal;
        }
      }

      // Calculate cap hit as average of all non-zero major league salaries
      const salaryValues = Object.values(majorSalaries);
      const calculatedCapHit = salaryValues.length > 0
        ? salaryValues.reduce((sum, val) => sum + val, 0) / salaryValues.length
        : parseInt(record['Average Salary']) || 0;

      contractsData.push({
        playerId: playerId,
        teamId: teamId && teamId > 0 ? teamId : null,
        ntc: parseBoolean(record.NTC),
        nmc: parseBoolean(record.NMC),
        elc: parseBoolean(record.ELC),
        ufa: parseBoolean(record.UFA),
        scholarship: record.Scholarship === '-' ? false : parseBoolean(record.Scholarship),
        averageSalary: calculatedCapHit,
        majorLeagueSalaries: majorSalaries,
        minorLeagueSalaries: minorSalaries
      });
    }

    return contractsData;
  }

  // Import original contracts
  const originalPath = path.join(CSV_DIR, 'player_contract.csv');
  const originalContracts = parseContractFile(originalPath);
  console.log(`Parsed ${originalContracts.length} original contracts`);

  // Import renewed contracts (overwrites if averageSalary > 0)
  const renewedPath = path.join(CSV_DIR, 'player_contract_renewed.csv');
  const renewedContracts = parseContractFile(renewedPath);
  console.log(`Parsed ${renewedContracts.length} renewed contracts`);

  // Merge: renewed overwrites original, but only if averageSalary > 0
  const contractsMap = new Map();

  // Add original contracts first
  for (const contract of originalContracts) {
    contractsMap.set(contract.playerId, contract);
  }

  // Overwrite with renewed contracts (only if non-zero)
  let renewedApplied = 0;
  for (const contract of renewedContracts) {
    if (contract.averageSalary > 0) {
      contractsMap.set(contract.playerId, contract);
      renewedApplied++;
    }
  }

  const finalContracts = Array.from(contractsMap.values());
  console.log(`Final: ${finalContracts.length} contracts (${renewedApplied} renewed contracts applied)`);

  await PlayerContract.bulkCreate(finalContracts, {
    updateOnDuplicate: ['teamId', 'ntc', 'nmc', 'elc', 'ufa', 'scholarship', 'averageSalary', 'majorLeagueSalaries', 'minorLeagueSalaries', 'updatedAt']
  });

  console.log(`Imported ${finalContracts.length} contracts`);

  // Sync capHit to Player table (convert to millions)
  console.log('Syncing capHit to Player table...');
  await sequelize.query(`
    UPDATE players p
    SET "capHit" = pc."averageSalary" / 1000000.0
    FROM player_contracts pc
    WHERE p."playerId" = pc."playerId"
  `);
  console.log('CapHit synced to Player table');
}

async function importGameStats() {
  console.log('Importing player game stats (boxscores)...');
  const filePath = path.join(CSV_DIR, 'boxscore_skater_summary.csv');

  if (!fs.existsSync(filePath)) {
    console.warn('boxscore_skater_summary.csv not found, skipping game stats import');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  console.log(`Found ${records.length} game stat records`);

  const gameStatsData = [];
  let skipped = 0;

  for (const record of records) {
    const playerId = parseInt(record.PlayerId);
    const gameId = parseInt(record['Game Id']);

    if (!playerId || playerId <= 0 || !gameId) {
      skipped++;
      continue;
    }

    gameStatsData.push({
      gameId: gameId,
      playerId: playerId,
      teamId: parseInt(record.TeamId)!,
      gameRating: parseFloat(record['Game Rating']),
      gameRatingOff: parseFloat(record['Game Rating Off']),
      gameRatingDef: parseFloat(record['Game Rating Def']),
      goals: parseInt(record.G) || 0,
      assists: parseInt(record.A) || 0,
      plusMinus: parseInt(record['+/-']) || 0,
      shotsOnGoal: parseInt(record.SOG) || 0,
      missedShots: parseInt(record.MS) || 0,
      blockedShots: parseInt(record.BS) || 0,
      penaltyMinutes: parseInt(record.PIM) || 0,
      hits: parseInt(record.HT) || 0,
      takeaways: parseInt(record.TK) || 0,
      giveaways: parseInt(record.GV) || 0,
      shifts: parseInt(record.SHF),
      timeOnIce: parseFloat(record.TOT),
      powerPlayTime: parseFloat(record.PP),
      shortHandedTime: parseFloat(record.SH),
      evenStrengthTime: parseFloat(record.EV),
      faceoffWins: parseInt(record.FOW),
      faceoffLosses: parseInt(record.FOL),
      faceoffPercentage: parseFloat(record['FO%']),
      teamShotsOnWhenOn: parseInt(record['Team Shots on']),
      teamShotsAgainstWhenOn: parseInt(record['Team Shots Against on']),
      teamShotsMissedWhenOn: parseInt(record['Team Shots Missed on']),
      teamShotsMissedAgainstWhenOn: parseInt(record['Team Shots Missed Against on']),
      teamShotsBlockedWhenOn: parseInt(record['Team Shots Blocked on']),
      teamShotsBlockedAgainstWhenOn: parseInt(record['Team Shots Blocked Against on']),
      teamGoalsWhenOn: parseInt(record['Team Goals on']),
      teamGoalsAgainstWhenOn: parseInt(record['Team Goal Against on']),
      teamShotsOnWhenOff: parseInt(record['Team Shots off']),
      teamShotsAgainstWhenOff: parseInt(record['Team Shots Against off']),
      teamShotsMissedWhenOff: parseInt(record['Team Shots Missed off']),
      teamShotsMissedAgainstWhenOff: parseInt(record['Team Shots Missed Against off']),
      teamShotsBlockedWhenOff: parseInt(record['Team Shots Blocked off']),
      teamShotsBlockedAgainstWhenOff: parseInt(record['Team Shots Blocked Against off']),
      teamGoalsWhenOff: parseInt(record['Team Goals off']),
      teamGoalsAgainstWhenOff: parseInt(record['Team Goal Against off']),
      ozStarts: parseInt(record['OZ Starts']),
      nzStarts: parseInt(record['NZ Starts']),
      dzStarts: parseInt(record['DZ Starts']),
      teamOzStarts: parseInt(record['Team OZ Starts']),
      teamNzStarts: parseInt(record['Team NZ Starts']),
      teamDzStarts: parseInt(record['Team DZ Starts']),
      sq0: parseInt(record.SQ0),
      sq1: parseInt(record.SQ1),
      sq2: parseInt(record.SQ2),
      sq3: parseInt(record.SQ3),
      sq4: parseInt(record.SQ4)
    });
  }

  console.log(`Importing ${gameStatsData.length} game stats (this may take a while)...`);

  const batchSize = 500;
  for (let i = 0; i < gameStatsData.length; i += batchSize) {
    const batch = gameStatsData.slice(i, i + batchSize);
    console.log(`Importing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gameStatsData.length / batchSize)}`);

    await PlayerGameStat.bulkCreate(batch, {
      updateOnDuplicate: Object.keys(batch[0] || {}).filter(key => !['gameId', 'playerId'].includes(key))
    });
  }

  console.log(`Imported ${gameStatsData.length} game stats`);
}

async function importTeamLines() {
  console.log('Importing team lines...');
  const filePath = path.join(CSV_DIR, 'team_lines.csv');

  if (!fs.existsSync(filePath)) {
    console.warn('team_lines.csv not found, skipping lines import');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
    relax_column_count: true
  });

  console.log(`Found ${records.length} team line configurations`);

  // Clear existing lines
  await TeamLine.destroy({ where: {} });

  const linesData = [];

  for (const record of records) {
    const teamId = parseInt(record.TeamId);
    if (!teamId) continue;

    // Parse each line position from the CSV
    // The CSV has columns like "ES L1 LW", "ES L1 C", etc.
    const columns = Object.keys(record);

    for (const column of columns) {
      if (column === 'TeamId') continue;

      const playerId = parseInt(record[column]);
      if (!playerId || playerId <= 0) continue;

      // Parse the column name to get situation, line, and position
      // Examples: "ES L1 LW", "PP5on4 L1 C", "PK4on5 L1 F1"
      // Special cases: "Extra Attacker 1", "Shootout 1", "Goalie 1"
      const parts = column.split(' ');
      if (parts.length < 2) continue;

      let situation, position, lineOrder;

      // Handle special cases where the number is the last part
      if (parts[0] === 'Extra' || parts[0] === 'Shootout' || parts[0] === 'Goalie') {
        // "Extra Attacker 1" -> situation: "Extra_Attacker", position: "1", lineOrder: 1
        // "Shootout 1" -> situation: "Shootout_1", position: "", lineOrder: 1
        // "Goalie 1" -> situation: "Goalie_1", position: "", lineOrder: 1
        const numPart = parts[parts.length - 1];
        lineOrder = parseInt(numPart) || 1;
        situation = parts.slice(0, -1).join('_');
        position = numPart;
      } else {
        // Standard format: "ES L1 LW"
        situation = parts[0]; // e.g., "ES", "PP5on4", "PK4on5"
        const lineNum = parts[1]; // e.g., "L1", "L2"
        position = parts.slice(2).join(' '); // e.g., "LW", "C", "RW", "LD", "RD", "F1"
        lineOrder = lineNum ? parseInt(lineNum.replace('L', '')) : 1;
        situation = `${situation}_${lineNum}`;
      }

      linesData.push({
        teamId: teamId,
        situation: situation,
        position: position,
        playerId: playerId,
        lineOrder: lineOrder
      });
    }
  }

  console.log(`Importing ${linesData.length} line assignments...`);

  if (linesData.length > 0) {
    await TeamLine.bulkCreate(linesData);
  }

  console.log(`Imported ${linesData.length} team line assignments`);
}

async function importStaff() {
  console.log('Importing staff...');
  const masterPath = path.join(CSV_DIR, 'staff_master.csv');
  const ratingsPath = path.join(CSV_DIR, 'staff_ratings.csv');

  if (!fs.existsSync(masterPath) || !fs.existsSync(ratingsPath)) {
    console.warn('Staff CSV files not found, skipping staff import');
    return;
  }

  const masterContent = fs.readFileSync(masterPath, 'utf-8');
  const ratingsContent = fs.readFileSync(ratingsPath, 'utf-8');

  const masterRecords = parse(masterContent, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  const ratingsRecords = parse(ratingsContent, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
    relax_column_count: true
  });

  // Create a map of ratings by staffId
  const ratingsMap = new Map();
  for (const rating of ratingsRecords) {
    const staffId = parseInt(rating.StaffId);
    if (staffId) {
      ratingsMap.set(staffId, rating);
    }
  }

  const staffData = [];
  let skipped = 0;

  for (const master of masterRecords) {
    const staffId = parseInt(master.StaffId);
    if (!staffId || staffId <= 0) {
      skipped++;
      continue;
    }

    const ratings = ratingsMap.get(staffId);
    const teamId = parseInt(master.TeamId);

    staffData.push({
      staffId: staffId,
      teamId: teamId && teamId > 0 ? teamId : null,
      firstName: master['First Name'],
      lastName: master['Last Name'],
      nickName: master['Nick Name'] || null,
      dateOfBirth: parseDate(master['Date Of Birth']),
      birthCity: master.Birthcity,
      birthState: master.Birthstate,
      nationalityOne: master.Nationality_One,
      nationalityTwo: master.Nationality_Two || null,
      nationalityThree: master.Nationality_Three || null,
      retired: master.Retired === '1',

      // Ratings (if available)
      executive: ratings ? parseInt(ratings.Executive) : null,
      manager: ratings ? parseInt(ratings.Manager) : null,
      coach: ratings ? parseInt(ratings.Coach) : null,
      scout: ratings ? parseInt(ratings.Scout) : null,
      trainer: ratings ? parseInt(ratings.Trainer) : null,
      offensivePreference: ratings ? parseInt(ratings['Off Pref']) : null,
      physicalPreference: ratings ? parseInt(ratings['Phy Pref']) : null,
      lineMatching: ratings ? parseInt(ratings['Line Matching']) : null,
      goalieHandling: ratings ? parseInt(ratings['Goalie Handling']) : null,
      favorVeterans: ratings ? parseInt(ratings['Favor Veterans']) : null,
      innovation: ratings ? parseInt(ratings.Innovation) : null,
      loyalty: ratings ? parseInt(ratings.Loyalty) : null,
      coachingGoaltending: ratings ? parseInt(ratings['Coaching G']) : null,
      coachingDefense: ratings ? parseInt(ratings['Coaching Defense']) : null,
      coachingForwards: ratings ? parseInt(ratings['Coaching Forwards']) : null,
      coachingProspects: ratings ? parseInt(ratings['Coaching Prospects']) : null,
      defensiveSkills: ratings ? parseInt(ratings['Def Skills']) : null,
      offensiveSkills: ratings ? parseInt(ratings['Off Skills']) : null,
      physicalTraining: ratings ? parseInt(ratings['Phy Training']) : null,
      playerManagement: ratings ? parseInt(ratings['Player Management']) : null,
      motivation: ratings ? parseInt(ratings.Motivation) : null,
      discipline: ratings ? parseInt(ratings.Discipline) : null,
      negotiating: ratings ? parseInt(ratings.Negotiating) : null,
      selfPreservation: ratings ? parseInt(ratings['Self-Preservation']) : null,
      tactics: ratings ? parseInt(ratings.Tactics) : null,
      ingameTactics: ratings ? parseInt(ratings['Ingame Tactics']) : null,
      trainerSkill: ratings ? parseInt(ratings['Trainer Skill']) : null,
      evaluateAbilities: ratings ? parseInt(ratings['Evaluate Abilities']) : null,
      evaluatePotential: ratings ? parseInt(ratings['Evaluate Potential']) : null
    });
  }

  console.log(`Importing ${staffData.length} staff members...`);

  await Staff.bulkCreate(staffData, {
    updateOnDuplicate: Object.keys(staffData[0] || {}).filter(key => key !== 'staffId')
  });

  console.log(`Imported ${staffData.length} staff members`);
}

async function main() {
  try {
    // Get resume checkpoint from command line: npm run import-fhm12 -- teams
    const resumeFrom = process.argv[2];
    let shouldSkip = !!resumeFrom;

    console.log('Starting FHM12 data import from:', CSV_DIR);
    console.log('==========================================\n');

    // Only drop tables on fresh run, not resume
    if (!resumeFrom) {
      console.log('Fresh import - dropping and recreating all tables...');
      await sequelize.sync({ force: true });
      console.log('Database cleared and recreated\n');
    } else {
      console.log(`RESUMING from checkpoint: ${resumeFrom}\n`);
      await sequelize.sync();
    }

    // Teams
    if (shouldSkip && resumeFrom === 'teams') shouldSkip = false;
    if (!shouldSkip) {
      await importTeams();
      console.log('✓ CHECKPOINT: teams\n');
    } else {
      console.log('⏭  SKIPPING: teams\n');
    }

    // Players
    if (shouldSkip && resumeFrom === 'players') shouldSkip = false;
    if (!shouldSkip) {
      await importPlayers();
      console.log('✓ CHECKPOINT: players\n');
    } else {
      console.log('⏭  SKIPPING: players\n');
    }

    // Ratings
    if (shouldSkip && resumeFrom === 'ratings') shouldSkip = false;
    if (!shouldSkip) {
      await importPlayerRatings();
      console.log('✓ CHECKPOINT: ratings\n');
    } else {
      console.log('⏭  SKIPPING: ratings\n');
    }

    // Stats
    if (shouldSkip && resumeFrom === 'stats') shouldSkip = false;
    if (!shouldSkip) {
      await importPlayerStats();
      console.log('✓ CHECKPOINT: stats\n');
    } else {
      console.log('⏭  SKIPPING: stats\n');
    }

    // Contracts
    if (shouldSkip && resumeFrom === 'contracts') shouldSkip = false;
    if (!shouldSkip) {
      await importContracts();
      console.log('✓ CHECKPOINT: contracts\n');
    } else {
      console.log('⏭  SKIPPING: contracts\n');
    }

    // Game Stats
    if (shouldSkip && resumeFrom === 'gamestats') shouldSkip = false;
    if (!shouldSkip) {
      await importGameStats();
      console.log('✓ CHECKPOINT: gamestats\n');
    } else {
      console.log('⏭  SKIPPING: gamestats\n');
    }

    // Team Lines
    if (shouldSkip && resumeFrom === 'lines') shouldSkip = false;
    if (!shouldSkip) {
      await importTeamLines();
      console.log('✓ CHECKPOINT: lines\n');
    } else {
      console.log('⏭  SKIPPING: lines\n');
    }

    // Staff
    if (shouldSkip && resumeFrom === 'staff') shouldSkip = false;
    if (!shouldSkip) {
      await importStaff();
      console.log('✓ CHECKPOINT: staff\n');
    } else {
      console.log('⏭  SKIPPING: staff\n');
    }

    console.log('==========================================');
    console.log('FHM12 data import completed successfully!');
    console.log('==========================================');

  } catch (error) {
    console.error('\n==========================================');
    console.error('IMPORT FAILED!');
    console.error('==========================================');
    console.error('Error:', error);
    console.error('\nTo resume, look for the last ✓ CHECKPOINT above');
    console.error('Then run: npm run import-fhm12 -- <checkpoint>');
    console.error('Example: npm run import-fhm12 -- contracts\n');
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

main();
