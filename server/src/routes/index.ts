// server/src/routes/index.ts


import { Router } from 'express';
import health from './health.js';
import teams from './teams.js';
import players from './players.js';
import analyze from './analyze.js';
import analyzeAdvanced from './analyzeAdvanced.js';
import cupAnalysis from './cupAnalysis.js';

const api = Router();
api.use(health);
api.use(teams);
api.use(players);
api.use(analyze);
api.use(analyzeAdvanced);
api.use(cupAnalysis);

export default api;
