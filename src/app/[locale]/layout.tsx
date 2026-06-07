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

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    title: locale === 'ar'
      ? '\u0635\u0646\u0627\u0639 \u062c\u062f\u0629 | \u0645\u062c\u062a\u0645\u0639 \u0635\u0646\u0627\u0639 \u0627\u0644\u0639\u0627\u0644\u0645'
      : 'Jeddah Hub | Global Shapers Community',
    description: locale === 'ar'
      ? '\u0645\u062c\u062a\u0645\u0639 \u0635\u0646\u0627\u0639 \u0627\u0644\u0639\u0627\u0644\u0645 \u2014 \u0635\u0646\u0627\u0639 \u062c\u062f\u0629. \u0634\u0628\u0643\u0629 \u0645\u0646 \u0627\u0644\u0634\u0628\u0627\u0628 \u0644\u062a\u062d\u0642\u064a\u0642 \u062a\u0623\u062b\u064a\u0631 \u0625\u064a\u062c\u0627\u0628\u064a \u0641\u064a \u062c\u062f\u0629.'
      : 'Global Shapers Community \u2014 Jeddah Hub. A network of young leaders driving positive change in Jeddah.',
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
        <SplashScreen />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <AuthProvider>
              <Navbar />
              <div className="page-content">
                {children}
              </div>
              <Footer />
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
