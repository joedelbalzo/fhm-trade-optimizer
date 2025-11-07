// server/src/models/PlayerContract.ts

import {
  Model, InferAttributes, InferCreationAttributes, CreationOptional,
  DataTypes, ForeignKey, Sequelize
} from 'sequelize';
import type { Player } from './Player.js';
import type { Team } from './Team.js';

export class PlayerContract
  extends Model<InferAttributes<PlayerContract>, InferCreationAttributes<PlayerContract>> {
  declare id: CreationOptional<number>;
  declare playerId: ForeignKey<Player['playerId']>;
  declare teamId: ForeignKey<Team['teamId']> | null;

  // Contract clauses
  declare ntc: boolean;
  declare nmc: boolean;
  declare elc: boolean;
  declare ufa: boolean;
  declare scholarship: boolean;
  declare averageSalary: number;

  // Year-by-year salaries (stored as JSON for flexibility)
  // Format: { "2025": 5000000, "2026": 5500000, ... }
  declare majorLeagueSalaries: Record<string, number>;
  declare minorLeagueSalaries: Record<string, number>;
}

export function initPlayerContract(sequelize: Sequelize) {
  PlayerContract.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      playerId: { type: DataTypes.INTEGER, allowNull: false },
      teamId: { type: DataTypes.INTEGER, allowNull: true },

      ntc: { type: DataTypes.BOOLEAN, defaultValue: false },
      nmc: { type: DataTypes.BOOLEAN, defaultValue: false },
      elc: { type: DataTypes.BOOLEAN, defaultValue: false },
      ufa: { type: DataTypes.BOOLEAN, defaultValue: false },
      scholarship: { type: DataTypes.BOOLEAN, defaultValue: false },
      averageSalary: { type: DataTypes.INTEGER, defaultValue: 0 },

      majorLeagueSalaries: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
      },
      minorLeagueSalaries: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
      }
    },
    {
      sequelize,
      tableName: 'player_contracts',
      modelName: 'PlayerContract',
      timestamps: true,
      indexes: [
        { fields: ['playerId'], unique: true },
        { fields: ['teamId'] },
        { fields: ['averageSalary'] }
      ]
    }
  );
  return PlayerContract;
}
