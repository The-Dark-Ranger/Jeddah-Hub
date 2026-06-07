'use client';

export default function Logo({ className }: { className?: string }) {
  return (
    <span className={className} aria-label="Jeddah Hub">
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <circle cx="15" cy="15" r="12.5" stroke="#2563eb" strokeWidth="1.8"/>
        <ellipse cx="15" cy="15" rx="5.5" ry="12.5" stroke="#2563eb" strokeWidth="1.4"/>
        <line x1="2.5" y1="15" x2="27.5" y2="15" stroke="#2563eb" strokeWidth="1.4"/>
        <path d="M4 10 Q15 8 26 10" stroke="#2563eb" strokeWidth="1" fill="none"/>
        <path d="M4 20 Q15 22 26 20" stroke="#2563eb" strokeWidth="1" fill="none"/>
      </svg>
      <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', lineHeight: 1 }}>
        <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.02em' }}>Jeddah Hub</span>
        <span style={{ fontSize: '7px', letterSpacing: '1.3px', textTransform: 'uppercase', opacity: 0.55 }}>
          Global Shapers
        </span>
      </span>
    </span>
  );
}
