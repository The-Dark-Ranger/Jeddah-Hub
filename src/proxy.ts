import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import {routing} from './i18n/routing';

const intl = createMiddleware(routing);

// Paths vulnerability scanners probe for (leaked secrets, source control,
// other platforms' admin panels, server-side scripts). None exist on this
// site; answering them with a bare, cacheable 404 — no page, no framework
// markup — gives a scanner nothing to fingerprint and costs no render.
const SCANNER_PATH =
  /(?:^|\/)(?:\.(?:env|git|svn|hg|aws|ssh|vscode|idea|htaccess|htpasswd|DS_Store)|wp-[a-z]+|wordpress|xmlrpc|phpmyadmin|pma|cgi-bin|vendor|server-status|actuator|boaform|HNAP1|administrator|backup)(?:$|[/.?])/i;
const SCANNER_EXT = /\.(?:php\d?|aspx?|jsp|cgi|env|ini|bak|sql|old|swp|ya?ml|log|conf|config)$/i;

export default function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (SCANNER_PATH.test(path) || SCANNER_EXT.test(path)) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=86400', 'X-Robots-Tag': 'noindex' },
    });
  }
  return intl(request);
}

export const config = {
  matcher: [
    // Internationalized pathnames
    '/', '/(ar|en)/:path*',
    // Common scanner probes outside them
    '/((?:\\.(?:env|git|svn|hg|aws|ssh|vscode|idea|htaccess|htpasswd|DS_Store)|wp-|wordpress|xmlrpc|phpmyadmin|pma|cgi-bin|vendor|server-status|actuator|boaform|HNAP1|administrator|backup).*)',
    '/(.*\\.(?:php\\d?|aspx?|jsp|cgi|env|ini|bak|sql|old|swp|ya?ml|log|conf|config))',
  ],
};
