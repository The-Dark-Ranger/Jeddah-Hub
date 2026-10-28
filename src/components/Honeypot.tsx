/* A form field people never see and bots tend to fill in. A filled value
 * means the form was sent by a bot (the server ignores it: lib/formGuard.ts).
 * Clipped in place rather than pushed off-screen: an off-screen offset
 * becomes scrollable space in Arabic (right-to-left). */
export default function Honeypot({ id, value, onChange }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', opacity: 0, pointerEvents: 'none' }}>
      <label htmlFor={id}>Website</label>
      <input id={id} name="website" type="text" tabIndex={-1} autoComplete="off"
        value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
