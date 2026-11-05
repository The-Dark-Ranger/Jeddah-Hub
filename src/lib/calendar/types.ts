/* Calendar: the shape of an event on the hub calendar. One event can be a
 * single day, several days (a retreat) or a weekly series. Dates are plain
 * YYYY-MM-DD strings in Jeddah time, so an event on the 5th stays on the 5th
 * on every device. */

export type CalendarKind = 'initiative' | 'hub' | 'activity' | 'external' | 'deadline';

export const CALENDAR_KINDS: CalendarKind[] = ['initiative', 'hub', 'activity', 'external', 'deadline'];

/** How someone answered the calendar invite. */
export type InviteReply = 'yes' | 'no' | 'maybe' | 'none';

export interface CalendarPerson {
  userId: string;
  /** On the event's team, or invited to attend. */
  role: 'team' | 'guest';
  reply: InviteReply;
}

/** Where the event came from: made on the site, an invite sent to the hub's
 *  calendar address from someone's own calendar app, or a public Hub Activity. */
export type CalendarSource = 'site' | 'invite' | 'activity';

export interface CalendarEvent {
  id: string;
  title: string;
  titleAr?: string;
  kind: CalendarKind;
  initiativeId?: string;
  startDate: string;
  endDate: string;
  /** HH:MM, missing for all-day and multi-day events. */
  startTime?: string;
  endTime?: string;
  weekly?: boolean;
  /** Weeks of a series that were skipped, as YYYY-MM-DD. */
  skipDates?: string[];
  location?: string;
  locationAr?: string;
  notes?: string;
  notesAr?: string;
  people: CalendarPerson[];
  /** Rough count of guests from outside the hub. */
  outsideGuests?: number;
  source: CalendarSource;
  /** Member who added it (site) or the organiser's name (invite). */
  createdBy?: string;
  organizerName?: string;
  organizerNameAr?: string;
  /** Hub Activity slug, for the link to its public page. */
  activitySlug?: string;
}

/** One concrete appearance of an event; a weekly series has many. */
export interface Occurrence {
  event: CalendarEvent;
  key: string;
  date: string;
  endDate: string;
}

export interface Clash {
  userId: string;
  a: Occurrence;
  b: Occurrence;
}
