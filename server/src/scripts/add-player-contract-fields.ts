import { sequelize } from '../db.js';

async function addPlayerContractFields() {
  console.log('Adding contract and position fields to players table...');
  
  try {
    await sequelize.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS position VARCHAR(10),
      ADD COLUMN IF NOT EXISTS "rfaUfa" VARCHAR(20),
      ADD COLUMN IF NOT EXISTS "yearsLeft" INTEGER,
      ADD COLUMN IF NOT EXISTS "capHit" DECIMAL(10,2);
    `);
    
    console.log('Successfully added contract fields to players table');
  } catch (error) {
    console.error('Error adding contract fields:', error);
  }
}

async function main() {
  try {
    await addPlayerContractFields();
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

main();