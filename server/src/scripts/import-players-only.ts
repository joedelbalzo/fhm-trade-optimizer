import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { Player } from '../models/index.js';
import { sequelize } from '../db.js';

const CSV_DIR = path.resolve(process.cwd(), '..', 'csv');

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

async function importPlayersOnly() {
  console.log('Starting players-only import...');
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
      relax_column_count: true, // Allow inconsistent column counts
      skip_records_with_error: true // Skip malformed records
    });
    
    console.log('Parsed records count:', records.length);
    console.log('First 3 records:', records.slice(0, 3));

    let imported = 0;
    for (const record of records) {
      try {
        await Player.upsert({
          playerId: parseInt(record.PlayerId)!,
          teamId: parseInt(record.TeamId),
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
        imported++;
      } catch (error) {
        console.error(`Error importing player ${record.PlayerId}:`, error);
      }
    }

    console.log(`Successfully imported ${imported} players`);
  } catch (error) {
    console.error('Error importing players:', error);
  }
}

async function main() {
  try {
    await importPlayersOnly();
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

main();