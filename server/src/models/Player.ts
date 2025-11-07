// server/src/models/Player.ts


import {
  Model, InferAttributes, InferCreationAttributes, CreationOptional,
  DataTypes, ForeignKey, NonAttribute, Sequelize
} from 'sequelize';
import type { Team } from './Team.js';
import type { PlayerSeasonStat } from './PlayerSeasonStat.js';

export class Player extends Model<InferAttributes<Player>, InferCreationAttributes<Player>> {
  declare id: CreationOptional<number>;
  declare playerId: number;
  declare teamId: number | null;
  declare franchiseId: number | null;
  declare firstName: string;
  declare lastName: string;
  declare nickName: string | null;
  declare height: number | null;
  declare weight: number | null;
  declare dateOfBirth: Date | null;
  declare birthCity: string | null;
  declare birthState: string | null;
  declare nationalityOne: string | null;
  declare nationalityTwo: string | null;
  declare nationalityThree: string | null;
  declare retired: boolean;
  declare position: string | null;
  declare rfaUfa: string | null;
  declare yearsLeft: number | null;
  declare capHit: number | null;

  declare team?: NonAttribute<Team | null>;
  declare seasonStats?: NonAttribute<PlayerSeasonStat[]>;
  declare ratings?: NonAttribute<any>;
  
  // Computed field for birth year
  get birthYear(): number | null {
    return this.dateOfBirth ? this.dateOfBirth.getFullYear() : null;
  }
}

export function initPlayer(sequelize: Sequelize) {
  Player.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      playerId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      teamId: { type: DataTypes.INTEGER, allowNull: true },
      franchiseId: { type: DataTypes.INTEGER, allowNull: true },
      firstName: { type: DataTypes.STRING(100), allowNull: false },
      lastName: { type: DataTypes.STRING(100), allowNull: false },
      nickName: { type: DataTypes.STRING(100), allowNull: true },
      height: { type: DataTypes.INTEGER, allowNull: true },
      weight: { type: DataTypes.INTEGER, allowNull: true },
      dateOfBirth: { type: DataTypes.DATE, allowNull: true },
      birthCity: { type: DataTypes.STRING(100), allowNull: true },
      birthState: { type: DataTypes.STRING(100), allowNull: true },
      nationalityOne: { type: DataTypes.STRING(50), allowNull: true },
      nationalityTwo: { type: DataTypes.STRING(50), allowNull: true },
      nationalityThree: { type: DataTypes.STRING(50), allowNull: true },
      retired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      position: { type: DataTypes.STRING(10), allowNull: true },
      rfaUfa: { type: DataTypes.STRING(20), allowNull: true },
      yearsLeft: { type: DataTypes.INTEGER, allowNull: true },
      capHit: { type: DataTypes.DECIMAL(10, 2), allowNull: true }
    },
    { sequelize, tableName: 'players', modelName: 'Player', timestamps: true, indexes: [{ fields: ['playerId'] }, { fields: ['lastName', 'firstName'] }] }
  );
  return Player;
}
