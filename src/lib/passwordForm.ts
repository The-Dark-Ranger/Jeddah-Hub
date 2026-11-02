/* The way to the Change password form on My Profile. */

export const PASSWORD_FORM_ID = 'password';
export const PASSWORD_FORM_HREF = `/dashboard/shaper/profile#${PASSWORD_FORM_ID}`;

/** Scrolls to the form and briefly highlights it. The form only exists once
 *  the profile has loaded, so the browser's own jump to #password finds
 *  nothing when arriving from another page: My Profile calls this after
 *  loading, and links on the same page call it directly. */
export function showPasswordForm() {
  const form = document.getElementById(PASSWORD_FORM_ID);
  if (!form) return;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.setAttribute('data-highlight', 'true');
  setTimeout(() => form.removeAttribute('data-highlight'), 2200);
}
