import { sequelize } from '../db.js';

async function updateFieldNames() {
  console.log('Updating database field names...');
  
  try {
    // Update PlayerSeasonStat field names
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN gp TO "gamesPlayed";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN g TO goals;
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN a TO assists;
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN pim TO "penaltyMinutes";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN "ppG" TO "powerPlayGoals";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN "ppA" TO "powerPlayAssists";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN "shG" TO "shortHandedGoals";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN "shA" TO "shortHandedAssists";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN hit TO hits;
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN "gvA" TO giveaways;
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN "tkA" TO takeaways;
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN sb TO "shotBlocks";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN gr TO "gameRating";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN sog TO "shotsOnGoal";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN toi TO "timeOnIce";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN pptoi TO "powerPlayTimeOnIce";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN shtoi TO "shortHandedTimeOnIce";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN gf60 TO "goalsFor60";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN ga60 TO "goalsAgainst60";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN sf60 TO "shotsFor60";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN sa60 TO "shotsAgainst60";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN cf TO "corsiFors";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN ca TO "corsiAgainst";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN "cfPct" TO "corsiForPercentage";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN "cfPctRel" TO "corsiForPercentageRelative";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN ff TO "fenwickFor";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN fa TO "fenwickAgainst";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN "ffPct" TO "fenwickForPercentage";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN "ffPctRel" TO "fenwickForPercentageRelative";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN gwg TO "gameWinningGoals";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN fo TO faceoffs;
    `);
    
    await sequelize.query(`
      ALTER TABLE player_season_stats 
      RENAME COLUMN fow TO "faceoffWins";
    `);
    
    // Update PlayerRating field names
    await sequelize.query(`
      ALTER TABLE player_ratings 
      RENAME COLUMN g TO goalie;
    `);
    
    await sequelize.query(`
      ALTER TABLE player_ratings 
      RENAME COLUMN ld TO "leftDefense";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_ratings 
      RENAME COLUMN rd TO "rightDefense";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_ratings 
      RENAME COLUMN lw TO "leftWing";
    `);
    
    await sequelize.query(`
      ALTER TABLE player_ratings 
      RENAME COLUMN c TO center;
    `);
    
    await sequelize.query(`
      ALTER TABLE player_ratings 
      RENAME COLUMN rw TO "rightWing";
    `);
    
    console.log('Successfully updated all field names');
  } catch (error) {
    console.error('Error updating field names:', error);
  }
}

async function main() {
  try {
    await updateFieldNames();
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

main();