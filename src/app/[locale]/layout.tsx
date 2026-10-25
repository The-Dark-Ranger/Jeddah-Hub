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
import ScrollToTop from '@/components/ScrollToTop';
import PageTransition from '@/components/PageTransition';
import { SITE_URL, alternateLanguages } from '@/lib/seo';
import type { Metadata, Viewport } from 'next';
import { Inter, Tajawal } from 'next/font/google';

// Self-hosted by next/font: no request to Google at runtime, and size-matched
// fallback fonts so text doesn't reflow (jump) when the real font arrives.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-tajawal',
  display: 'swap',
});

// Browser chrome (mobile address bar, PWA title bar) follows the theme, and
// color-scheme lets native controls, scrollbars, date pickers, selects,
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
    ? '\u0645\u062c\u062a\u0645\u0639 \u0635\u0646\u0627\u0639 \u0627\u0644\u0639\u0627\u0644\u0645\u060c \u0635\u0646\u0627\u0639 \u062c\u062f\u0629. \u0634\u0628\u0643\u0629 \u0645\u0646 \u0627\u0644\u0634\u0628\u0627\u0628 \u0644\u062a\u062d\u0642\u064a\u0642 \u062a\u0623\u062b\u064a\u0631 \u0625\u064a\u062c\u0627\u0628\u064a \u0641\u064a \u062c\u062f\u0629.'
    : 'Global Shapers Community, Jeddah Hub. A network of young leaders driving positive change in Jeddah.';

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

  // Read theme from cookie set by ThemeProvider, eliminates client-side flash.
  const cookieStore = await cookies();
  const savedTheme  = cookieStore.get('jh-theme')?.value;
  const themeAttr   = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : undefined;

  return (
    <html lang={locale} dir={isRtl ? 'rtl' : 'ltr'} data-theme={themeAttr} className={`${inter.variable} ${tajawal.variable}`} suppressHydrationWarning>
      <head>
        {/* Must run before first paint: lock in the saved theme and decide
            whether this load shows the splash, so neither flashes in late. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + SPLASH_INIT_SCRIPT }} />
      </head>
      <body className={isRtl ? 'rtl' : 'ltr'}>
        {/* reCAPTCHA is loaded on demand by the forms that use it
            (src/lib/recaptcha.ts), not on every page. */}
        <SplashScreen locale={locale} />
        <LangSwitchHandler />
        <NextIntlClientProvider messages={messages}>
          <ScrollToTop />
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
