import { sequelize } from '../db.js';

async function revertFieldNames() {
  console.log('Reverting database field names back to originals...');
  
  try {
    // Drop the new columns and recreate with old names
    await sequelize.query('DROP TABLE IF EXISTS player_season_stats CASCADE');
    await sequelize.query('DROP TABLE IF EXISTS player_ratings CASCADE');
    
    console.log('Dropped tables, will be recreated on next sync');
    
  } catch (error) {
    console.error('Error reverting field names:', error);
  }
}

async function main() {
  try {
    await revertFieldNames();
  } catch (error) {
    console.error('Revert failed:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

main();