import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Keeps the browser on one origin; the AI key stays behind the backend.
      '/api': 'http://localhost:4000',
    },
  },
});
