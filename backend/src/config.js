import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',

  // AI Assistant (M8). The key is read here and never leaves the backend.
  // Groq exposes an OpenAI-compatible API, so we talk to it with the `openai`
  // SDK pointed at Groq's base URL.
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    baseUrl: process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
    model: process.env.AI_MODEL || 'openai/gpt-oss-120b',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 15000,
    rateLimitPerHour: Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 20,
  },
};

export const aiEnabled = () => Boolean(config.ai.apiKey);
