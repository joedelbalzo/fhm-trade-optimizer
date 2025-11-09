// Quick diagnostic to check what data exists for Cup winners
import { sequelize } from '../db.js';
import { Player, PlayerSeasonStat, Team } from '../models/index.js';

async function checkData() {
  try {
    await sequelize.authenticate();
    console.log('Database connected\n');

    // Check total records
    const teamCount = await Team.count();
    const playerCount = await Player.count();
    const statCount = await PlayerSeasonStat.count();

    console.log('=== DATABASE COUNTS ===');
    console.log(`Teams: ${teamCount}`);
    console.log(`Players: ${playerCount}`);
    console.log(`Season Stats: ${statCount}\n`);

    // Check teams
    console.log('=== ALL TEAMS ===');
    const teams = await Team.findAll({
      attributes: ['teamId', 'name', 'abbr'],
      order: [['abbr', 'ASC']]
    });
    teams.forEach(t => {
      console.log(`  ${t.abbr.padEnd(5)} - ${t.name} (ID: ${t.teamId})`);
    });

    // Check what seasons exist in PlayerSeasonStat
    console.log('\n=== SEASONS IN DATABASE ===');
    const seasons = await sequelize.query(
      'SELECT DISTINCT season FROM player_season_stats ORDER BY season DESC',
      { type: sequelize.QueryTypes.SELECT }
    ) as any[];

    console.log('Distinct seasons found:');
    seasons.forEach((s: any) => {
      console.log(`  ${s.season}`);
    });

    // Check a sample of season stats
    console.log('\n=== SAMPLE SEASON STATS ===');
    const sampleStats = await PlayerSeasonStat.findAll({
      limit: 5,
      attributes: ['playerId', 'season', 'teamId', 'gamesPlayed', 'goals', 'assists'],
      include: [{
        model: Player,
        as: 'player',
        attributes: ['firstName', 'lastName', 'position']
      }]
    });

    sampleStats.forEach((s: any) => {
      console.log(`  ${s.player?.firstName} ${s.player?.lastName} - Season: ${s.season}, Team: ${s.teamId}, GP: ${s.gamesPlayed}`);
    });

    // Try to find FLA (2024 Cup winners) specifically
    console.log('\n=== CHECKING 2024 FLORIDA PANTHERS ===');
    const flaTeam = await Team.findOne({ where: { abbr: 'FLA' } });
    if (flaTeam) {
      console.log(`Found team: ${flaTeam.name} (ID: ${flaTeam.teamId})`);

      // Try different season formats
      const formats = [2024, '2024', '2023-24', 2023];
      for (const format of formats) {
        const count = await PlayerSeasonStat.count({
          where: {
            teamId: flaTeam.teamId,
            season: format
          }
        });
        console.log(`  Season "${format}": ${count} player records`);
      }
    } else {
      console.log('FLA team not found!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkData();
