// server/src/models/PlayerGameStat.ts

import {
  Model, InferAttributes, InferCreationAttributes, CreationOptional,
  DataTypes, ForeignKey, Sequelize
} from 'sequelize';
import type { Player } from './Player.js';
import type { Team } from './Team.js';

export class PlayerGameStat
  extends Model<InferAttributes<PlayerGameStat>, InferCreationAttributes<PlayerGameStat>> {
  declare id: CreationOptional<number>;
  declare gameId: number;
  declare playerId: ForeignKey<Player['playerId']>;
  declare teamId: ForeignKey<Team['teamId']>;

  // Game ratings
  declare gameRating: number | null;
  declare gameRatingOff: number | null;
  declare gameRatingDef: number | null;

  // Basic stats
  declare goals: number;
  declare assists: number;
  declare plusMinus: number;
  declare shotsOnGoal: number;
  declare missedShots: number;
  declare blockedShots: number;
  declare penaltyMinutes: number;
  declare hits: number;
  declare takeaways: number;
  declare giveaways: number;

  // Shifts and ice time
  declare shifts: number | null;
  declare timeOnIce: number | null;
  declare powerPlayTime: number | null;
  declare shortHandedTime: number | null;
  declare evenStrengthTime: number | null;

  // Faceoffs
  declare faceoffWins: number | null;
  declare faceoffLosses: number | null;
  declare faceoffPercentage: number | null;

  // On-ice team stats (when player is ON the ice)
  declare teamShotsOnWhenOn: number | null;
  declare teamShotsAgainstWhenOn: number | null;
  declare teamShotsMissedWhenOn: number | null;
  declare teamShotsMissedAgainstWhenOn: number | null;
  declare teamShotsBlockedWhenOn: number | null;
  declare teamShotsBlockedAgainstWhenOn: number | null;
  declare teamGoalsWhenOn: number | null;
  declare teamGoalsAgainstWhenOn: number | null;

  // Off-ice team stats (when player is OFF the ice)
  declare teamShotsOnWhenOff: number | null;
  declare teamShotsAgainstWhenOff: number | null;
  declare teamShotsMissedWhenOff: number | null;
  declare teamShotsMissedAgainstWhenOff: number | null;
  declare teamShotsBlockedWhenOff: number | null;
  declare teamShotsBlockedAgainstWhenOff: number | null;
  declare teamGoalsWhenOff: number | null;
  declare teamGoalsAgainstWhenOff: number | null;

  // Zone starts
  declare ozStarts: number | null;
  declare nzStarts: number | null;
  declare dzStarts: number | null;
  declare teamOzStarts: number | null;
  declare teamNzStarts: number | null;
  declare teamDzStarts: number | null;

  // Shot quality (SQ0-SQ4 buckets)
  declare sq0: number | null;
  declare sq1: number | null;
  declare sq2: number | null;
  declare sq3: number | null;
  declare sq4: number | null;
}

export function initPlayerGameStat(sequelize: Sequelize) {
  PlayerGameStat.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      gameId: { type: DataTypes.INTEGER, allowNull: false },
      playerId: { type: DataTypes.INTEGER, allowNull: false },
      teamId: { type: DataTypes.INTEGER, allowNull: false },

      gameRating: { type: DataTypes.FLOAT, allowNull: true },
      gameRatingOff: { type: DataTypes.FLOAT, allowNull: true },
      gameRatingDef: { type: DataTypes.FLOAT, allowNull: true },

      goals: { type: DataTypes.INTEGER, defaultValue: 0 },
      assists: { type: DataTypes.INTEGER, defaultValue: 0 },
      plusMinus: { type: DataTypes.INTEGER, defaultValue: 0 },
      shotsOnGoal: { type: DataTypes.INTEGER, defaultValue: 0 },
      missedShots: { type: DataTypes.INTEGER, defaultValue: 0 },
      blockedShots: { type: DataTypes.INTEGER, defaultValue: 0 },
      penaltyMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
      hits: { type: DataTypes.INTEGER, defaultValue: 0 },
      takeaways: { type: DataTypes.INTEGER, defaultValue: 0 },
      giveaways: { type: DataTypes.INTEGER, defaultValue: 0 },

      shifts: { type: DataTypes.INTEGER, allowNull: true },
      timeOnIce: { type: DataTypes.FLOAT, allowNull: true },
      powerPlayTime: { type: DataTypes.FLOAT, allowNull: true },
      shortHandedTime: { type: DataTypes.FLOAT, allowNull: true },
      evenStrengthTime: { type: DataTypes.FLOAT, allowNull: true },

      faceoffWins: { type: DataTypes.INTEGER, allowNull: true },
      faceoffLosses: { type: DataTypes.INTEGER, allowNull: true },
      faceoffPercentage: { type: DataTypes.FLOAT, allowNull: true },

      teamShotsOnWhenOn: { type: DataTypes.INTEGER, allowNull: true },
      teamShotsAgainstWhenOn: { type: DataTypes.INTEGER, allowNull: true },
      teamShotsMissedWhenOn: { type: DataTypes.INTEGER, allowNull: true },
      teamShotsMissedAgainstWhenOn: { type: DataTypes.INTEGER, allowNull: true },
      teamShotsBlockedWhenOn: { type: DataTypes.INTEGER, allowNull: true },
      teamShotsBlockedAgainstWhenOn: { type: DataTypes.INTEGER, allowNull: true },
      teamGoalsWhenOn: { type: DataTypes.INTEGER, allowNull: true },
      teamGoalsAgainstWhenOn: { type: DataTypes.INTEGER, allowNull: true },

      teamShotsOnWhenOff: { type: DataTypes.INTEGER, allowNull: true },
      teamShotsAgainstWhenOff: { type: DataTypes.INTEGER, allowNull: true },
      teamShotsMissedWhenOff: { type: DataTypes.INTEGER, allowNull: true },
      teamShotsMissedAgainstWhenOff: { type: DataTypes.INTEGER, allowNull: true },
      teamShotsBlockedWhenOff: { type: DataTypes.INTEGER, allowNull: true },
      teamShotsBlockedAgainstWhenOff: { type: DataTypes.INTEGER, allowNull: true },
      teamGoalsWhenOff: { type: DataTypes.INTEGER, allowNull: true },
      teamGoalsAgainstWhenOff: { type: DataTypes.INTEGER, allowNull: true },

      ozStarts: { type: DataTypes.INTEGER, allowNull: true },
      nzStarts: { type: DataTypes.INTEGER, allowNull: true },
      dzStarts: { type: DataTypes.INTEGER, allowNull: true },
      teamOzStarts: { type: DataTypes.INTEGER, allowNull: true },
      teamNzStarts: { type: DataTypes.INTEGER, allowNull: true },
      teamDzStarts: { type: DataTypes.INTEGER, allowNull: true },

      sq0: { type: DataTypes.INTEGER, allowNull: true },
      sq1: { type: DataTypes.INTEGER, allowNull: true },
      sq2: { type: DataTypes.INTEGER, allowNull: true },
      sq3: { type: DataTypes.INTEGER, allowNull: true },
      sq4: { type: DataTypes.INTEGER, allowNull: true }
    },
    {
      sequelize,
      tableName: 'player_game_stats',
      modelName: 'PlayerGameStat',
      timestamps: true,
      indexes: [
        { fields: ['gameId', 'playerId'], unique: true },
        { fields: ['playerId'] },
        { fields: ['teamId'] },
        { fields: ['gameId'] }
      ]
    }
  );
  return PlayerGameStat;
}
