/* Vercel BotID: an invisible bot check on the public form routes, on top of
 * reCAPTCHA and the rate limits. The browser side (instrumentation-client.ts)
 * runs BotID's challenge and attaches its result to requests to the routes
 * in botidRoutes.ts; checkBotId() verifies that result here, on the server.
 *
 * BOTID_ENFORCE says whether a detected bot is refused or only logged; set
 * it to false to go back to watching if real visitors are ever refused. */
import { checkBotId } from 'botid/server';

const BOTID_ENFORCE = true;

/** True when the request should be refused as a bot. Never throws: if
 *  BotID itself can't be reached, the other checks still apply. */
export async function isBlockedBot(route: string): Promise<boolean> {
  try {
    const result = await checkBotId();
    console.info(`[botid] ${route}: ${result.isBot ? 'bot' : 'human'}${result.bypassed ? ' (bypassed)' : ''}`);
    return BOTID_ENFORCE && result.isBot;
  } catch (err) {
    console.error('[botid] check failed', err);
    return false;
  }
}
