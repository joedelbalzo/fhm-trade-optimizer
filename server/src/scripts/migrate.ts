// server/src/scripts/migrate.ts
import { sequelize } from "../db";
import { Player } from "../models/Player"; // example model

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log("Connected to Postgres ✅");

    await sequelize.sync({ alter: true }); // or { force: true } to reset tables
    console.log("Database migrated ✅");
  } catch (err) {
    console.error("Migration failed ❌", err);
  } finally {
    await sequelize.close();
  }
}

migrate();
