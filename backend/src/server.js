import app from './app.js';
import { config, aiEnabled } from './config.js';

app.listen(config.port, () => {
  console.log(`HR backend listening on http://localhost:${config.port}`);
  console.log(`AI Assistant: ${aiEnabled() ? `enabled (${config.ai.model})` : 'DISABLED - set AI_API_KEY in .env'}`);
});
