/* The routes Vercel BotID protects (path + method). Shared by the browser
 * setup (instrumentation-client.ts) and the server check (botCheck.ts); kept
 * in its own file so the browser never loads server code. */
export const BOTID_ROUTES = [
  { path: '/api/contact/send', method: 'POST' },
  { path: '/api/newsletter/subscribe', method: 'POST' },
  { path: '/api/activities/respond', method: 'POST' },
  { path: '/api/verify-recaptcha', method: 'POST' },
] as const;
