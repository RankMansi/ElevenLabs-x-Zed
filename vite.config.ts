import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { createTtsMiddleware, type TtsEnv } from './vite/tts-middleware';
import { createChronosElevenlabsMiddleware } from './vite/chronos-elevenlabs-middleware';

function ttsApiPlugin(): Plugin {
  return {
    name: 'chronos-tts-api',
    configureServer(server) {
      const getEnv = (): TtsEnv => loadEnv(server.config.mode, process.cwd(), '') as TtsEnv;
      server.middlewares.use(createChronosElevenlabsMiddleware(getEnv));
      server.middlewares.use(createTtsMiddleware(getEnv));
    },
    configurePreviewServer(server) {
      const getEnv = (): TtsEnv => loadEnv(server.config.mode, process.cwd(), '') as TtsEnv;
      server.middlewares.use(createChronosElevenlabsMiddleware(getEnv));
      server.middlewares.use(createTtsMiddleware(getEnv));
    },
  };
}

export default defineConfig({
  plugins: [react(), ttsApiPlugin()],
});
