import express from 'express';
import cors from 'cors';
import restRouter from './rest/index.js';
import aiRouter from './ai/routes.js';
import { errorHandler } from './middleware/auth.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', restRouter);
app.use('/api/ai', aiRouter);

app.use(errorHandler);

export default app;
