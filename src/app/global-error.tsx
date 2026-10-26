'use client';

/* Last resort, if the site's root layout itself fails: a plain bilingual
 * page (translations and styles may be what failed) with a reload button. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 460 }}>
          <h1 style={{ fontSize: '1.4rem', margin: '0 0 .5rem' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 .25rem', color: '#475569' }}>Please reload the page.</p>
          <p dir="rtl" style={{ margin: '0 0 1.25rem', color: '#475569' }}>حدث خطأ ما. يُرجى إعادة تحميل الصفحة.</p>
          <button
            type="button"
            onClick={() => { reset(); window.location.reload(); }}
            style={{ minHeight: 44, padding: '0 1.4rem', border: 'none', borderRadius: 11, background: '#0f5a9f', color: '#fff', fontWeight: 700, fontSize: '.95rem', cursor: 'pointer' }}
          >
            Reload · إعادة التحميل
          </button>
        </div>
      </body>
    </html>
  );
}
