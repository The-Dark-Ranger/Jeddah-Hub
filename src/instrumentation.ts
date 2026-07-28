export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Workaround for sharp < 0.35.0 libvips vulnerabilities (GHSA-f88m-g3jw-g9cj):
    // CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591.
    // next@16 pins sharp@^0.34.5 so a direct upgrade is blocked.
    // Blocking these three loaders eliminates the affected code paths.
    const sharp = await import('sharp').catch(() => null);
    if (sharp) {
      sharp.block({
        operation: ['VipsForeignLoadNsgif', 'VipsForeignLoadTiff', 'VipsForeignLoadVips'],
      });
    }
  }
}
