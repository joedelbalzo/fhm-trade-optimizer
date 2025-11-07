import { sequelize } from '../db.js';

async function checkTVR() {
  try {
    const result = await sequelize.query(
      `SELECT "playerId", "firstName", "lastName", "dateOfBirth", "teamId", "capHit"
       FROM players
       WHERE "playerId" = 3326`,
      { type: sequelize.QueryTypes.SELECT }
    );

    console.log('Trevor van Riemsdyk in database:');
    console.log(JSON.stringify(result, null, 2));

    // Also check the max season
    const seasonResult = await sequelize.query(
      'SELECT MAX(season) as latest_season FROM player_season_stats',
      { type: sequelize.QueryTypes.SELECT }
    );

    console.log('\nCurrent season in database:');
    console.log(JSON.stringify(seasonResult, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkTVR();
