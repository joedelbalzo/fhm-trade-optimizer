// server/src/models/TeamLine.ts

import {
  Model, InferAttributes, InferCreationAttributes, CreationOptional,
  DataTypes, ForeignKey, Sequelize
} from 'sequelize';
import type { Team } from './Team.js';
import type { Player } from './Player.js';

export class TeamLine
  extends Model<InferAttributes<TeamLine>, InferCreationAttributes<TeamLine>> {
  declare id: CreationOptional<number>;
  declare teamId: ForeignKey<Team['teamId']>;
  declare situation: string; // 'ES_L1', 'ES_L2', 'PP5on4_L1', 'PK4on5_L1', etc.
  declare position: string;  // 'LW', 'C', 'RW', 'LD', 'RD', 'F1', 'F2', 'G'
  declare playerId: ForeignKey<Player['playerId']> | null;
  declare lineOrder: number; // Order within the situation (1-4 for lines, 1-5 for shootout)
}

export function initTeamLine(sequelize: Sequelize) {
  TeamLine.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      teamId: { type: DataTypes.INTEGER, allowNull: false },
      situation: { type: DataTypes.STRING(50), allowNull: false },
      position: { type: DataTypes.STRING(10), allowNull: false },
      playerId: { type: DataTypes.INTEGER, allowNull: true },
      lineOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
    },
    {
      sequelize,
      tableName: 'team_lines',
      modelName: 'TeamLine',
      timestamps: true,
      indexes: [
        { fields: ['teamId'] },
        { fields: ['playerId'] },
        { fields: ['teamId', 'situation', 'position'] }
      ]
    }
  );
  return TeamLine;
}
