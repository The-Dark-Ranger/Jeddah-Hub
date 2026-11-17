/* For the parts of a dashboard page that load alongside its main list (a
 * queue of requests, people's names): a failure is logged and comes back as
 * null, so the page can say that part didn't load instead of showing it as
 * empty, while the rest of the page still works. */
import { errorCode } from './types';

export async function orNull<T>(what: string, load: Promise<T>): Promise<T | null> {
  try {
    return await load;
  } catch (err) {
    console.error(`Failed to load ${what}:`, errorCode(err));
    return null;
  }
}
