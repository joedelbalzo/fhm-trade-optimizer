// server/src/models/index.ts


import { sequelize } from '../db.js';
import { initTeam, Team } from './Team.js';
import { initPlayer, Player } from './Player.js';
import { initPlayerSeasonStat, PlayerSeasonStat } from './PlayerSeasonStat.js';
import { initPlayerRating, PlayerRating } from './PlayerRating.js';
import { initPlayerContract, PlayerContract } from './PlayerContract.js';
import { initPlayerGameStat, PlayerGameStat } from './PlayerGameStat.js';
import { initTeamLine, TeamLine } from './TeamLine.js';
import { initStaff, Staff } from './Staff.js';

initTeam(sequelize);
initPlayer(sequelize);
initPlayerSeasonStat(sequelize);
initPlayerRating(sequelize);
initPlayerContract(sequelize);
initPlayerGameStat(sequelize);
initTeamLine(sequelize);
initStaff(sequelize);

// associations
Team.hasMany(Player, { foreignKey: 'teamId', sourceKey: 'teamId', constraints: false });
Player.belongsTo(Team, { as: 'team', foreignKey: 'teamId', targetKey: 'teamId', constraints: false });

Player.hasMany(PlayerSeasonStat, { as: 'seasonStats', foreignKey: 'playerId', sourceKey: 'playerId' });
PlayerSeasonStat.belongsTo(Player, { foreignKey: 'playerId', targetKey: 'playerId' });

Player.hasOne(PlayerRating, { as: 'ratings', foreignKey: 'playerId', sourceKey: 'playerId' });
PlayerRating.belongsTo(Player, { foreignKey: 'playerId', targetKey: 'playerId' });

Player.hasOne(PlayerContract, { as: 'contract', foreignKey: 'playerId', sourceKey: 'playerId' });
PlayerContract.belongsTo(Player, { foreignKey: 'playerId', targetKey: 'playerId' });

Player.hasMany(PlayerGameStat, { as: 'gameStats', foreignKey: 'playerId', sourceKey: 'playerId' });
PlayerGameStat.belongsTo(Player, { foreignKey: 'playerId', targetKey: 'playerId' });

Team.hasMany(PlayerSeasonStat, { foreignKey: 'teamId', sourceKey: 'teamId', constraints: false });
PlayerSeasonStat.belongsTo(Team, { foreignKey: 'teamId', targetKey: 'teamId', constraints: false });

Team.hasMany(PlayerContract, { foreignKey: 'teamId', sourceKey: 'teamId', constraints: false });
PlayerContract.belongsTo(Team, { foreignKey: 'teamId', targetKey: 'teamId', constraints: false });

Team.hasMany(PlayerGameStat, { foreignKey: 'teamId', sourceKey: 'teamId', constraints: false });
PlayerGameStat.belongsTo(Team, { foreignKey: 'teamId', targetKey: 'teamId', constraints: false });

Team.hasMany(TeamLine, { as: 'lines', foreignKey: 'teamId', sourceKey: 'teamId', constraints: false });
TeamLine.belongsTo(Team, { foreignKey: 'teamId', targetKey: 'teamId', constraints: false });

TeamLine.belongsTo(Player, { as: 'player', foreignKey: 'playerId', targetKey: 'playerId', constraints: false });

Team.hasMany(Staff, { as: 'staff', foreignKey: 'teamId', sourceKey: 'teamId', constraints: false });
Staff.belongsTo(Team, { foreignKey: 'teamId', targetKey: 'teamId', constraints: false });

export { Team, Player, PlayerSeasonStat, PlayerRating, PlayerContract, PlayerGameStat, TeamLine, Staff };
export async function syncModels() {
  await sequelize.sync();
}
