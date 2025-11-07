// server/src/index.ts

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { syncModels } from './models/index.js';
import api from './routes/index.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', api);

const PORT = Number(process.env.PORT ?? 3001);

(async () => {
  await syncModels();
  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
})();
