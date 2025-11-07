// server/src/models/Team.ts


import {
  Model, InferAttributes, InferCreationAttributes, CreationOptional,
  DataTypes, NonAttribute, Sequelize
} from 'sequelize';
import type { Player } from './Player.js';

export class Team extends Model<InferAttributes<Team>, InferCreationAttributes<Team>> {
  declare id: CreationOptional<number>;
  declare teamId: number;
  declare leagueId: number | null;
  declare name: string;
  declare nickname: string | null;
  declare abbr: string;
  declare primaryColor: string | null;
  declare secondaryColor: string | null;
  declare textColor: string | null;
  declare conferenceId: number | null;
  declare divisionId: number | null;

  declare players?: NonAttribute<Player[]>;
}

export function initTeam(sequelize: Sequelize) {
  Team.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      teamId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      leagueId: { type: DataTypes.INTEGER, allowNull: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      nickname: { type: DataTypes.STRING(100), allowNull: true },
      abbr: { type: DataTypes.STRING(10), allowNull: false },
      primaryColor: { type: DataTypes.STRING(10), allowNull: true },
      secondaryColor: { type: DataTypes.STRING(10), allowNull: true },
      textColor: { type: DataTypes.STRING(10), allowNull: true },
      conferenceId: { type: DataTypes.INTEGER, allowNull: true },
      divisionId: { type: DataTypes.INTEGER, allowNull: true }
    },
    { sequelize, tableName: 'teams', modelName: 'Team', indexes: [{ fields: ['teamId'] }, { fields: ['abbr'] }] }
  );
  return Team;
}
