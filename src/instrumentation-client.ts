/* Runs in the browser before the site becomes interactive. Starts Vercel
 * BotID's invisible challenge and attaches its result to requests to the
 * protected form routes (src/lib/botidRoutes.ts), which the server verifies
 * (src/lib/botCheck.ts). */
import { initBotId } from 'botid/client/core';
import { BOTID_ROUTES } from '@/lib/botidRoutes';

initBotId({ protect: BOTID_ROUTES.map(r => ({ ...r })) });
