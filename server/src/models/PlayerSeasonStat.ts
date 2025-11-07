// server/src/models/PlayerSeasonStat.ts

import {
  Model, InferAttributes, InferCreationAttributes, CreationOptional,
  DataTypes, ForeignKey, Sequelize
} from 'sequelize';
import type { Player } from './Player.js';
import type { Team } from './Team.js';

export class PlayerSeasonStat
  extends Model<InferAttributes<PlayerSeasonStat>, InferCreationAttributes<PlayerSeasonStat>> {
  declare id: CreationOptional<number>;
  declare playerId: ForeignKey<Player['playerId']>;
  declare teamId: ForeignKey<Team['teamId']> | null;
  declare franchiseId: number | null;
  declare season: number;

  // Basic stats
  declare gamesPlayed: number;
  declare goals: number;
  declare assists: number;
  declare plusMinus: number;
  declare penaltyMinutes: number;
  declare powerPlayGoals: number;
  declare powerPlayAssists: number;
  declare shortHandedGoals: number;
  declare shortHandedAssists: number;
  declare fights: number;
  declare fightsWon: number;
  declare hits: number;
  declare giveaways: number;
  declare takeaways: number;
  declare shotBlocks: number;
  declare gameRating: number;
  declare gameRatingOff: number | null;
  declare gameRatingDef: number | null;
  declare shotsOnGoal: number;
  declare timeOnIce: number | null;
  declare powerPlayTimeOnIce: number | null;
  declare shortHandedTimeOnIce: number | null;
  declare pdo: number | null;
  declare goalsFor60: number | null;
  declare goalsAgainst60: number | null;
  declare shotsFor60: number | null;
  declare shotsAgainst60: number | null;
  declare corsiFors: number | null;
  declare corsiAgainst: number | null;
  declare corsiForPercentage: number | null;
  declare corsiForPercentageRelative: number | null;
  declare fenwickFor: number | null;
  declare fenwickAgainst: number | null;
  declare fenwickForPercentage: number | null;
  declare fenwickForPercentageRelative: number | null;
  declare gameWinningGoals: number;
  declare faceoffs: number | null;
  declare faceoffWins: number | null;
}

export function initPlayerSeasonStat(sequelize: Sequelize) {
  PlayerSeasonStat.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      playerId: { type: DataTypes.INTEGER, allowNull: false },
      teamId: { type: DataTypes.INTEGER, allowNull: true },
      franchiseId: { type: DataTypes.INTEGER, allowNull: true },
      season: { type: DataTypes.INTEGER, allowNull: false },

      // Basic stats
      gamesPlayed: { type: DataTypes.INTEGER, defaultValue: 0 },
      goals: { type: DataTypes.INTEGER, defaultValue: 0 },
      assists: { type: DataTypes.INTEGER, defaultValue: 0 },
      plusMinus: { type: DataTypes.INTEGER, defaultValue: 0 },
      penaltyMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
      powerPlayGoals: { type: DataTypes.INTEGER, defaultValue: 0 },
      powerPlayAssists: { type: DataTypes.INTEGER, defaultValue: 0 },
      shortHandedGoals: { type: DataTypes.INTEGER, defaultValue: 0 },
      shortHandedAssists: { type: DataTypes.INTEGER, defaultValue: 0 },
      fights: { type: DataTypes.INTEGER, defaultValue: 0 },
      fightsWon: { type: DataTypes.INTEGER, defaultValue: 0 },
      hits: { type: DataTypes.INTEGER, defaultValue: 0 },
      giveaways: { type: DataTypes.INTEGER, defaultValue: 0 },
      takeaways: { type: DataTypes.INTEGER, defaultValue: 0 },
      shotBlocks: { type: DataTypes.INTEGER, defaultValue: 0 },
      gameRating: { type: DataTypes.INTEGER, defaultValue: 0 },
      gameRatingOff: { type: DataTypes.FLOAT, allowNull: true },
      gameRatingDef: { type: DataTypes.FLOAT, allowNull: true },
      shotsOnGoal: { type: DataTypes.INTEGER, defaultValue: 0 },
      timeOnIce: { type: DataTypes.FLOAT, allowNull: true },
      powerPlayTimeOnIce: { type: DataTypes.FLOAT, allowNull: true },
      shortHandedTimeOnIce: { type: DataTypes.FLOAT, allowNull: true },
      pdo: { type: DataTypes.FLOAT, allowNull: true },
      goalsFor60: { type: DataTypes.FLOAT, allowNull: true },
      goalsAgainst60: { type: DataTypes.FLOAT, allowNull: true },
      shotsFor60: { type: DataTypes.FLOAT, allowNull: true },
      shotsAgainst60: { type: DataTypes.FLOAT, allowNull: true },
      corsiFors: { type: DataTypes.INTEGER, allowNull: true },
      corsiAgainst: { type: DataTypes.INTEGER, allowNull: true },
      corsiForPercentage: { type: DataTypes.FLOAT, allowNull: true },
      corsiForPercentageRelative: { type: DataTypes.FLOAT, allowNull: true },
      fenwickFor: { type: DataTypes.INTEGER, allowNull: true },
      fenwickAgainst: { type: DataTypes.INTEGER, allowNull: true },
      fenwickForPercentage: { type: DataTypes.FLOAT, allowNull: true },
      fenwickForPercentageRelative: { type: DataTypes.FLOAT, allowNull: true },
      gameWinningGoals: { type: DataTypes.INTEGER, defaultValue: 0 },
      faceoffs: { type: DataTypes.INTEGER, allowNull: true },
      faceoffWins: { type: DataTypes.INTEGER, allowNull: true }
    },
    {
      sequelize,
      tableName: 'player_season_stats',
      modelName: 'PlayerSeasonStat',
      indexes: [
        { fields: ['playerId', 'season'] },
        { fields: ['teamId', 'season'] }
      ]
    }
  );
  return PlayerSeasonStat;
}
