/* Loads Firestore (and the app's database handle) only when a public page
 * actually needs it: a form being sent, a like, or a backup load when the
 * server couldn't include the data. Public pages arrive with their content
 * already in the HTML, so most visits never download the ~670 KB Firebase
 * toolkit at all, and pages become interactive sooner on phones.
 * Dashboards import firebase/firestore directly; they always need it. */
export async function loadFirestore() {
  const [firestore, { db }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase')]);
  return { ...firestore, db };
}
