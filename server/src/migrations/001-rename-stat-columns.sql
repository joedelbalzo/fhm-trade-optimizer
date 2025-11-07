-- Migration to rename PlayerSeasonStat columns to readable names
-- Run this before using the updated models

ALTER TABLE player_season_stats RENAME COLUMN gp TO "gamesPlayed";
ALTER TABLE player_season_stats RENAME COLUMN g TO goals;
ALTER TABLE player_season_stats RENAME COLUMN a TO assists;
ALTER TABLE player_season_stats RENAME COLUMN "gameRating" TO "gameRating";
ALTER TABLE player_season_stats RENAME COLUMN "shotsOnGoal" TO "shotsOnGoal";
ALTER TABLE player_season_stats RENAME COLUMN "timeOnIce" TO "timeOnIce";
ALTER TABLE player_season_stats RENAME COLUMN "powerPlayTimeOnIce" TO "powerPlayTimeOnIce";
ALTER TABLE player_season_stats RENAME COLUMN "shortHandedTimeOnIce" TO "shortHandedTimeOnIce";
ALTER TABLE player_season_stats RENAME COLUMN "gameWinningGoals" TO "gameWinningGoals";