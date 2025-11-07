import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PlayerSeasonStat } from '../models/index.js';
import { sequelize } from '../db.js';

const CSV_DIR = path.resolve(process.cwd(), '..', 'csv');

interface CareerStatCsvRow {
  PlayerId: string;
  Year: string;
  'Team Id': string;
  'League Id': string;
  GP: string;
  G: string;
  A: string;
  PIM: string;
  '+/-': string;
  'PP G': string;
  'PP A': string;
  'SH G': string;
  'SH A': string;
  GR: string;
  GWG: string;
  SOG: string;
  FO: string;
  'FO W': string;
  HIT: string;
  GvA: string;
  TkA: string;
  SB: string;
  TOI: string;
  PPTOI: string;
  SHTOI: string;
  Fights: string;
  'Fights Won': string;
}

function parseInt(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

function parseFloat(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

async function importCareerStats() {
  console.log('Starting career stats import...');
  const filePath = path.join(CSV_DIR, 'player_skater_career_stats_rs.csv');
  
  if (!fs.existsSync(filePath)) {
    console.error('player_skater_career_stats_rs.csv not found!');
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log('File content length:', content.length);
    
    const records: CareerStatCsvRow[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      relax_column_count: true,
      skip_records_with_error: true
    });
    
    console.log('Parsed records count:', records.length);
    
    // Only import recent stats (2020 and later) to focus on current performance
    const recentRecords = records.filter(r => parseInt(r.Year) && parseInt(r.Year)! >= 2020);
    console.log('Recent records (2020+):', recentRecords.length);

    let imported = 0;
    for (const record of recentRecords) {
      try {
        if (!record.PlayerId || !record.Year) continue;
        
        await PlayerSeasonStat.upsert({
          playerId: parseInt(record.PlayerId)!,
          teamId: parseInt(record['Team Id']),
          franchiseId: null, // Not in career stats
          season: parseInt(record.Year)!,
          gp: parseInt(record.GP) || 0,
          g: parseInt(record.G) || 0,
          a: parseInt(record.A) || 0,
          plusMinus: parseInt(record['+/-']) || 0,
          pim: parseInt(record.PIM) || 0,
          ppG: parseInt(record['PP G']) || 0,
          ppA: parseInt(record['PP A']) || 0,
          shG: parseInt(record['SH G']) || 0,
          shA: parseInt(record['SH A']) || 0,
          fights: parseInt(record.Fights) || 0,
          fightsWon: parseInt(record['Fights Won']) || 0,
          hit: parseInt(record.HIT) || 0,
          gvA: parseInt(record.GvA) || 0,
          tkA: parseInt(record.TkA) || 0,
          sb: parseInt(record.SB) || 0,
          gr: parseInt(record.GR) || 0,
          gameRatingOff: null, // Not in career stats
          gameRatingDef: null, // Not in career stats  
          sog: parseInt(record.SOG) || 0,
          toi: parseFloat(record.TOI),
          pptoi: parseFloat(record.PPTOI),
          shtoi: parseFloat(record.SHTOI),
          pdo: null, // Not in career stats
          gf60: null, // Not in career stats
          ga60: null, // Not in career stats
          sf60: null, // Not in career stats
          sa60: null, // Not in career stats
          cf: null, // Not in career stats
          ca: null, // Not in career stats
          cfPct: null, // Not in career stats
          cfPctRel: null, // Not in career stats
          ff: null, // Not in career stats
          fa: null, // Not in career stats
          ffPct: null, // Not in career stats
          ffPctRel: null, // Not in career stats
          gwg: parseInt(record.GWG) || 0,
          fo: parseInt(record.FO),
          fow: parseInt(record['FO W'])
        });
        imported++;
      } catch (error) {
        console.error(`Error importing stat for player ${record.PlayerId}:`, error);
      }
    }

    console.log(`Successfully imported ${imported} career stat records`);
  } catch (error) {
    console.error('Error importing career stats:', error);
  }
}

async function main() {
  try {
    await importCareerStats();
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

main();