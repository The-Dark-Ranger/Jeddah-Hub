/* The dashboard's layout (server): gives the dashboard its own messages,
 * which public pages don't send to the browser (see the root layout), then
 * renders the shell with the sidebar. */
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import DashboardShell from './DashboardShell';

export default async function DashboardLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={await getMessages({ locale })}>
      <DashboardShell>{children}</DashboardShell>
    </NextIntlClientProvider>
  );
}
