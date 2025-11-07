import { sequelize } from '../db.js';

async function debugStats() {
  try {
    // Check raw database
    const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM player_season_stats');
    console.log('Total stats records:', (countResult as any)[0].count);
    
    const [seasonResult] = await sequelize.query('SELECT DISTINCT season FROM player_season_stats ORDER BY season');
    console.log('Available seasons:', seasonResult.map((r: any) => r.season));
    
    // Check if we have 2025 data
    const [count2025] = await sequelize.query('SELECT COUNT(*) as count FROM player_season_stats WHERE season = 2025');
    console.log('2025 season records:', (count2025 as any)[0].count);
    
    // Sample a few records
    const [sample] = await sequelize.query('SELECT * FROM player_season_stats LIMIT 3');
    console.log('Sample records:', sample);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

debugStats();