// server/src/models/PlayerRating.ts


import {
  Model, InferAttributes, InferCreationAttributes, CreationOptional,
  DataTypes, ForeignKey, Sequelize
} from 'sequelize';
import type { Player } from './Player.js';

export class PlayerRating extends Model<InferAttributes<PlayerRating>, InferCreationAttributes<PlayerRating>> {
  declare id: CreationOptional<number>;
  declare playerId: ForeignKey<Player['playerId']>;

  // Position ratings
  declare goalie: number | null;
  declare leftDefense: number | null;
  declare rightDefense: number | null;
  declare leftWing: number | null;
  declare center: number | null;
  declare rightWing: number | null;

  // Mental attributes
  declare aggression: number | null;
  declare bravery: number | null;
  declare determination: number | null;
  declare teamplayer: number | null;
  declare leadership: number | null;
  declare temperament: number | null;
  declare professionalism: number | null;
  declare mentalToughness: number | null;
  declare goalieStamina: number | null;

  // Physical attributes  
  declare acceleration: number | null;
  declare agility: number | null;
  declare balance: number | null;
  declare speed: number | null;
  declare stamina: number | null;
  declare strength: number | null;

  // Skating/Offensive skills
  declare fighting: number | null;
  declare screening: number | null;
  declare gettingOpen: number | null;
  declare passing: number | null;
  declare puckHandling: number | null;
  declare shootingAccuracy: number | null;
  declare shootingRange: number | null;
  declare offensiveRead: number | null;

  // Defensive skills
  declare checking: number | null;
  declare faceoffs: number | null;
  declare hitting: number | null;
  declare positioning: number | null;
  declare shotBlocking: number | null;
  declare stickchecking: number | null;
  declare defensiveRead: number | null;

  // Goalie skills
  declare gPositioning: number | null;
  declare gPassing: number | null;
  declare gPokecheck: number | null;
  declare blocker: number | null;
  declare glove: number | null;
  declare rebound: number | null;
  declare recovery: number | null;
  declare gPuckhandling: number | null;
  declare lowShots: number | null;
  declare gSkating: number | null;
  declare reflexes: number | null;

  // Overall ratings
  declare skating: number | null;
  declare shooting: number | null;
  declare playmaking: number | null;
  declare defending: number | null;
  declare physicality: number | null;
  declare conditioning: number | null;
  declare character: number | null;
  declare hockeySense: number | null;
  declare goalieTechnique: number | null;
  declare goalieOverallPositioning: number | null;
}

export function initPlayerRating(sequelize: Sequelize) {
  PlayerRating.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      playerId: { type: DataTypes.INTEGER, allowNull: false },

      // Position ratings
      goalie: { type: DataTypes.INTEGER, allowNull: true },
      leftDefense: { type: DataTypes.INTEGER, allowNull: true },
      rightDefense: { type: DataTypes.INTEGER, allowNull: true },
      leftWing: { type: DataTypes.INTEGER, allowNull: true },
      center: { type: DataTypes.INTEGER, allowNull: true },
      rightWing: { type: DataTypes.INTEGER, allowNull: true },

      // Mental attributes
      aggression: { type: DataTypes.INTEGER, allowNull: true },
      bravery: { type: DataTypes.INTEGER, allowNull: true },
      determination: { type: DataTypes.INTEGER, allowNull: true },
      teamplayer: { type: DataTypes.INTEGER, allowNull: true },
      leadership: { type: DataTypes.INTEGER, allowNull: true },
      temperament: { type: DataTypes.INTEGER, allowNull: true },
      professionalism: { type: DataTypes.INTEGER, allowNull: true },
      mentalToughness: { type: DataTypes.INTEGER, allowNull: true },
      goalieStamina: { type: DataTypes.INTEGER, allowNull: true },

      // Physical attributes
      acceleration: { type: DataTypes.INTEGER, allowNull: true },
      agility: { type: DataTypes.INTEGER, allowNull: true },
      balance: { type: DataTypes.INTEGER, allowNull: true },
      speed: { type: DataTypes.INTEGER, allowNull: true },
      stamina: { type: DataTypes.INTEGER, allowNull: true },
      strength: { type: DataTypes.INTEGER, allowNull: true },

      // Skating/Offensive skills
      fighting: { type: DataTypes.INTEGER, allowNull: true },
      screening: { type: DataTypes.INTEGER, allowNull: true },
      gettingOpen: { type: DataTypes.INTEGER, allowNull: true },
      passing: { type: DataTypes.INTEGER, allowNull: true },
      puckHandling: { type: DataTypes.INTEGER, allowNull: true },
      shootingAccuracy: { type: DataTypes.INTEGER, allowNull: true },
      shootingRange: { type: DataTypes.INTEGER, allowNull: true },
      offensiveRead: { type: DataTypes.INTEGER, allowNull: true },

      // Defensive skills
      checking: { type: DataTypes.INTEGER, allowNull: true },
      faceoffs: { type: DataTypes.INTEGER, allowNull: true },
      hitting: { type: DataTypes.INTEGER, allowNull: true },
      positioning: { type: DataTypes.INTEGER, allowNull: true },
      shotBlocking: { type: DataTypes.INTEGER, allowNull: true },
      stickchecking: { type: DataTypes.INTEGER, allowNull: true },
      defensiveRead: { type: DataTypes.INTEGER, allowNull: true },

      // Goalie skills
      gPositioning: { type: DataTypes.INTEGER, allowNull: true },
      gPassing: { type: DataTypes.INTEGER, allowNull: true },
      gPokecheck: { type: DataTypes.INTEGER, allowNull: true },
      blocker: { type: DataTypes.INTEGER, allowNull: true },
      glove: { type: DataTypes.INTEGER, allowNull: true },
      rebound: { type: DataTypes.INTEGER, allowNull: true },
      recovery: { type: DataTypes.INTEGER, allowNull: true },
      gPuckhandling: { type: DataTypes.INTEGER, allowNull: true },
      lowShots: { type: DataTypes.INTEGER, allowNull: true },
      gSkating: { type: DataTypes.INTEGER, allowNull: true },
      reflexes: { type: DataTypes.INTEGER, allowNull: true },

      // Overall ratings
      skating: { type: DataTypes.INTEGER, allowNull: true },
      shooting: { type: DataTypes.INTEGER, allowNull: true },
      playmaking: { type: DataTypes.INTEGER, allowNull: true },
      defending: { type: DataTypes.INTEGER, allowNull: true },
      physicality: { type: DataTypes.INTEGER, allowNull: true },
      conditioning: { type: DataTypes.INTEGER, allowNull: true },
      character: { type: DataTypes.INTEGER, allowNull: true },
      hockeySense: { type: DataTypes.INTEGER, allowNull: true },
      goalieTechnique: { type: DataTypes.INTEGER, allowNull: true },
      goalieOverallPositioning: { type: DataTypes.INTEGER, allowNull: true }
    },
    { sequelize, tableName: 'player_ratings', modelName: 'PlayerRating', indexes: [{ fields: ['playerId'] }] }
  );
  return PlayerRating;
}