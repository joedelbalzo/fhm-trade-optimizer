import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { Player, PlayerSeasonStat, PlayerContract, PlayerGameStat, TeamLine } from '../models/index.js';
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

async function updatePlayers() {
  console.log('Updating player rosters...');
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

  console.log(`Updating ${playersData.length} players...`);

  await Player.bulkCreate(playersData, {
    updateOnDuplicate: ['teamId', 'franchiseId', 'firstName', 'lastName', 'nickName', 'height', 'weight', 'dateOfBirth', 'birthCity', 'birthState', 'nationalityOne', 'nationalityTwo', 'nationalityThree', 'retired', 'updatedAt']
  });

  console.log(`Updated ${playersData.length} players`);
}

async function updateCurrentSeasonStats() {
  console.log('Updating current season stats...');
  const filePath = path.join(CSV_DIR, 'player_skater_stats_rs.csv');

  if (!fs.existsSync(filePath)) {
    console.warn('player_skater_stats_rs.csv not found');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  const statsData = [];

  for (const record of records) {
    const playerId = parseInt(record.PlayerId);
    if (!playerId || playerId <= 0) continue;

    const teamId = parseInt(record.TeamId);

    statsData.push({
      playerId: playerId,
      teamId: teamId && teamId > 0 ? teamId : null,
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

  console.log(`Updating ${statsData.length} current season stats...`);

  const batchSize = 1000;
  for (let i = 0; i < statsData.length; i += batchSize) {
    const batch = statsData.slice(i, i + batchSize);
    await PlayerSeasonStat.bulkCreate(batch, {
      updateOnDuplicate: Object.keys(batch[0] || {}).filter(key => !['playerId', 'season'].includes(key))
    });
  }

  console.log(`Updated ${statsData.length} current season stats`);
}

async function updateContracts() {
  console.log('Updating contracts...');

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
      if (!playerId || playerId <= 0) continue;

      const teamId = parseInt(record.Team);
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

  console.log(`Updated ${finalContracts.length} contracts`);

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

async function updateGameStats() {
  console.log('Updating game stats (boxscores)...');
  const filePath = path.join(CSV_DIR, 'boxscore_skater_summary.csv');

  if (!fs.existsSync(filePath)) {
    console.warn('boxscore_skater_summary.csv not found');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  const gameStatsData = [];

  for (const record of records) {
    const playerId = parseInt(record.PlayerId);
    const gameId = parseInt(record['Game Id']);

    if (!playerId || playerId <= 0 || !gameId) continue;

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

  console.log(`Updating ${gameStatsData.length} game stats...`);

  const batchSize = 500;
  for (let i = 0; i < gameStatsData.length; i += batchSize) {
    const batch = gameStatsData.slice(i, i + batchSize);
    await PlayerGameStat.bulkCreate(batch, {
      updateOnDuplicate: Object.keys(batch[0] || {}).filter(key => !['gameId', 'playerId'].includes(key))
    });
  }

  console.log(`Updated ${gameStatsData.length} game stats`);
}

async function updateTeamLines() {
  console.log('Updating team lines...');
  const filePath = path.join(CSV_DIR, 'team_lines.csv');

  if (!fs.existsSync(filePath)) {
    console.warn('team_lines.csv not found');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
    relax_column_count: true
  });

  // Clear existing lines
  await TeamLine.destroy({ where: {} });

  const linesData = [];

  for (const record of records) {
    const teamId = parseInt(record.TeamId);
    if (!teamId) continue;

    const columns = Object.keys(record);

    for (const column of columns) {
      if (column === 'TeamId') continue;

      const playerId = parseInt(record[column]);
      if (!playerId || playerId <= 0) continue;

      const parts = column.split(' ');
      if (parts.length < 2) continue;

      let situation, position, lineOrder;

      // Handle special cases where the number is the last part
      if (parts[0] === 'Extra' || parts[0] === 'Shootout' || parts[0] === 'Goalie') {
        const numPart = parts[parts.length - 1];
        lineOrder = parseInt(numPart) || 1;
        situation = parts.slice(0, -1).join('_');
        position = numPart;
      } else {
        // Standard format: "ES L1 LW"
        situation = parts[0];
        const lineNum = parts[1];
        position = parts.slice(2).join(' ');
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

  console.log(`Updating ${linesData.length} line assignments...`);

  if (linesData.length > 0) {
    await TeamLine.bulkCreate(linesData);
  }

  console.log(`Updated ${linesData.length} team line assignments`);
}

async function main() {
  try {
    console.log('Starting FHM12 Quick Update...');
    console.log('Importing only frequently-changing data');
    console.log('==========================================\n');

    await sequelize.sync();
    console.log('Database synced\n');

    await updatePlayers();
    console.log('');

    await updateCurrentSeasonStats();
    console.log('');

    await updateContracts();
    console.log('');

    await updateGameStats();
    console.log('');

    await updateTeamLines();
    console.log('');

    console.log('==========================================');
    console.log('Quick update completed successfully!');
    console.log('Skipped: Teams, Player Ratings (use full import for those)');
    console.log('==========================================');

  } catch (error) {
    console.error('Quick update failed:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

main();
