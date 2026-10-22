import { defineConfig, loadEnv } from 'vite';
import participantApi from './api/participant/[action].js';

function attachParticipantApi() {
  const middleware = (req, res, next) => {
    if (!req.url?.startsWith('/api/participant/')) return next();
    void participantApi(req, res);
  };
  return {
    name: 'participant-api-local',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export default defineConfig(({ mode }) => {
  // These variables remain in the Node server process. Only VITE_-prefixed
  // values are eligible for inclusion in browser bundles.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [attachParticipantApi()] };
});
