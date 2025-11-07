import { sequelize } from '../db.js';

await sequelize.sync({ force: true });

console.log('Database tables created. Ready for real data import.');
process.exit(0);
