// server/src/models/Staff.ts

import {
  Model, InferAttributes, InferCreationAttributes, CreationOptional,
  DataTypes, ForeignKey, Sequelize
} from 'sequelize';
import type { Team } from './Team.js';

export class Staff
  extends Model<InferAttributes<Staff>, InferCreationAttributes<Staff>> {
  declare id: CreationOptional<number>;
  declare staffId: number;
  declare teamId: ForeignKey<Team['teamId']> | null;
  declare firstName: string;
  declare lastName: string;
  declare nickName: string | null;
  declare dateOfBirth: Date | null;
  declare birthCity: string | null;
  declare birthState: string | null;
  declare nationalityOne: string | null;
  declare nationalityTwo: string | null;
  declare nationalityThree: string | null;
  declare retired: boolean;

  // Staff Abilities (0-20 scale typically)
  declare executive: number | null;
  declare manager: number | null;
  declare coach: number | null;
  declare scout: number | null;
  declare trainer: number | null;

  // Preferences
  declare offensivePreference: number | null;
  declare physicalPreference: number | null;
  declare lineMatching: number | null;
  declare goalieHandling: number | null;
  declare favorVeterans: number | null;
  declare innovation: number | null;
  declare loyalty: number | null;

  // Coaching Skills
  declare coachingGoaltending: number | null;
  declare coachingDefense: number | null;
  declare coachingForwards: number | null;
  declare coachingProspects: number | null;
  declare defensiveSkills: number | null;
  declare offensiveSkills: number | null;
  declare physicalTraining: number | null;
  declare playerManagement: number | null;
  declare motivation: number | null;
  declare discipline: number | null;

  // GM/Executive Skills
  declare negotiating: number | null;
  declare selfPreservation: number | null;
  declare tactics: number | null;
  declare ingameTactics: number | null;

  // Other Skills
  declare trainerSkill: number | null;
  declare evaluateAbilities: number | null;
  declare evaluatePotential: number | null;
}

export function initStaff(sequelize: Sequelize) {
  Staff.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      staffId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
      teamId: { type: DataTypes.INTEGER, allowNull: true },
      firstName: { type: DataTypes.STRING(100), allowNull: false },
      lastName: { type: DataTypes.STRING(100), allowNull: false },
      nickName: { type: DataTypes.STRING(100), allowNull: true },
      dateOfBirth: { type: DataTypes.DATE, allowNull: true },
      birthCity: { type: DataTypes.STRING(100), allowNull: true },
      birthState: { type: DataTypes.STRING(100), allowNull: true },
      nationalityOne: { type: DataTypes.STRING(50), allowNull: true },
      nationalityTwo: { type: DataTypes.STRING(50), allowNull: true },
      nationalityThree: { type: DataTypes.STRING(50), allowNull: true },
      retired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      executive: { type: DataTypes.INTEGER, allowNull: true },
      manager: { type: DataTypes.INTEGER, allowNull: true },
      coach: { type: DataTypes.INTEGER, allowNull: true },
      scout: { type: DataTypes.INTEGER, allowNull: true },
      trainer: { type: DataTypes.INTEGER, allowNull: true },

      offensivePreference: { type: DataTypes.INTEGER, allowNull: true },
      physicalPreference: { type: DataTypes.INTEGER, allowNull: true },
      lineMatching: { type: DataTypes.INTEGER, allowNull: true },
      goalieHandling: { type: DataTypes.INTEGER, allowNull: true },
      favorVeterans: { type: DataTypes.INTEGER, allowNull: true },
      innovation: { type: DataTypes.INTEGER, allowNull: true },
      loyalty: { type: DataTypes.INTEGER, allowNull: true },

      coachingGoaltending: { type: DataTypes.INTEGER, allowNull: true },
      coachingDefense: { type: DataTypes.INTEGER, allowNull: true },
      coachingForwards: { type: DataTypes.INTEGER, allowNull: true },
      coachingProspects: { type: DataTypes.INTEGER, allowNull: true },
      defensiveSkills: { type: DataTypes.INTEGER, allowNull: true },
      offensiveSkills: { type: DataTypes.INTEGER, allowNull: true },
      physicalTraining: { type: DataTypes.INTEGER, allowNull: true },
      playerManagement: { type: DataTypes.INTEGER, allowNull: true },
      motivation: { type: DataTypes.INTEGER, allowNull: true },
      discipline: { type: DataTypes.INTEGER, allowNull: true },

      negotiating: { type: DataTypes.INTEGER, allowNull: true },
      selfPreservation: { type: DataTypes.INTEGER, allowNull: true },
      tactics: { type: DataTypes.INTEGER, allowNull: true },
      ingameTactics: { type: DataTypes.INTEGER, allowNull: true },

      trainerSkill: { type: DataTypes.INTEGER, allowNull: true },
      evaluateAbilities: { type: DataTypes.INTEGER, allowNull: true },
      evaluatePotential: { type: DataTypes.INTEGER, allowNull: true }
    },
    {
      sequelize,
      tableName: 'staff',
      modelName: 'Staff',
      timestamps: true,
      indexes: [
        { fields: ['staffId'] },
        { fields: ['teamId'] },
        { fields: ['lastName', 'firstName'] }
      ]
    }
  );
  return Staff;
}
