/**
 * Netlify Server entry. Runs the same Express app as `npm start` (including the
 * live-voice WebSocket). Netlify serves the built front end from dist/ on its
 * CDN and sends /api/* here. The app listens on process.env.PORT itself.
 * See README "Deploying to Netlify".
 */
process.env.NODE_ENV ||= 'production';

await import('../../server.ts');

export const config = {
  path: '/api/*',
};
