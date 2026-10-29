import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { isDatabaseReady } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import apiRouter from './routes/index.js';

const app = express();

app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Import-Token'],
  }),
);
app.use(express.json({ limit: '16kb' }));
app.use('/api', apiRouter({ isDatabaseReady }));
app.use(notFound);
app.use(errorHandler);

export default app;
