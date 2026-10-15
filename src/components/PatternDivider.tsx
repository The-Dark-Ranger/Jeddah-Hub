/** Thin band of the Hijazi pattern used to separate page sections. It is a
 *  CSS mask over the theme colour (see .pattern-divider in globals.css), so
 *  it adapts to light and dark mode and repeats seamlessly at any width. */
export default function PatternDivider() {
  return <div className="pattern-divider" aria-hidden="true" />;
}
