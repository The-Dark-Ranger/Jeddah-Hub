import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import {notFound} from 'next/navigation';
import {cookies} from 'next/headers';
import '../globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SplashScreen from '@/components/SplashScreen';
import { THEME_INIT_SCRIPT, SPLASH_INIT_SCRIPT } from '@/lib/initScripts';
import LangSwitchHandler from '@/components/LangSwitchHandler';
import PageTransition from '@/components/PageTransition';
import { SITE_URL, alternateLanguages } from '@/lib/seo';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';

// Browser chrome (mobile address bar, PWA title bar) follows the theme, and
// color-scheme lets native controls — scrollbars, date pickers, selects —
// render in the matching palette instead of staying light in dark mode.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)',  color: '#080e1c' },
  ],
  colorScheme: 'light dark',
};

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === 'ar'
    ? '\u0635\u0646\u0627\u0639 \u062c\u062f\u0629 | \u0645\u062c\u062a\u0645\u0639 \u0635\u0646\u0627\u0639 \u0627\u0644\u0639\u0627\u0644\u0645'
    : 'Jeddah Hub | Global Shapers Community';
  const description = locale === 'ar'
    ? '\u0645\u062c\u062a\u0645\u0639 \u0635\u0646\u0627\u0639 \u0627\u0644\u0639\u0627\u0644\u0645 \u2014 \u0635\u0646\u0627\u0639 \u062c\u062f\u0629. \u0634\u0628\u0643\u0629 \u0645\u0646 \u0627\u0644\u0634\u0628\u0627\u0628 \u0644\u062a\u062d\u0642\u064a\u0642 \u062a\u0623\u062b\u064a\u0631 \u0625\u064a\u062c\u0627\u0628\u064a \u0641\u064a \u062c\u062f\u0629.'
    : 'Global Shapers Community \u2014 Jeddah Hub. A network of young leaders driving positive change in Jeddah.';

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | Jeddah Hub` },
    description,
    icons: { icon: '/GSCJ.png', apple: '/GSCJ.png' },
    alternates: { canonical: `/${locale}`, languages: alternateLanguages('/') },
    openGraph: {
      title, description, siteName: 'Jeddah Hub', url: `${SITE_URL}/${locale}`,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US', type: 'website',
      images: [{ url: '/GSCJ.png' }],
    },
    twitter: { card: 'summary', title, description, images: ['/GSCJ.png'] },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'en' | 'ar')) notFound();

  const messages = await getMessages({ locale });
  const isRtl    = locale === 'ar';

  // Read theme from cookie set by ThemeProvider \u2014 eliminates client-side flash.
  const cookieStore = await cookies();
  const savedTheme  = cookieStore.get('jh-theme')?.value;
  const themeAttr   = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : undefined;

  return (
    <html lang={locale} dir={isRtl ? 'rtl' : 'ltr'} data-theme={themeAttr} suppressHydrationWarning>
      <head>
        {/* Must run before first paint: lock in the saved theme and decide
            whether this load shows the splash, so neither flashes in late. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + SPLASH_INIT_SCRIPT }} />
        {/* Preconnect for faster font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter for LTR, Tajawal for RTL \u2014 loaded together so switching is instant */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={isRtl ? 'rtl' : 'ltr'}>
        {/* reCAPTCHA v3 \u2014 loaded after hydration so it never blocks first
            paint; grecaptcha.execute() is ready long before anyone can
            submit a form that needs it. */}
        {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
            strategy="afterInteractive"
          />
        )}
        <SplashScreen locale={locale} />
        <LangSwitchHandler />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <AuthProvider>
              <Navbar />
              <div className="page-content" id="main-content" tabIndex={-1}>
                <PageTransition>{children}</PageTransition>
              </div>
              <Footer />
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
