export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Workaround for sharp < 0.35.0 libvips vulnerabilities (GHSA-f88m-g3jw-g9cj):
    // CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591.
    // next@16 pins sharp@^0.34.5 so a direct upgrade is blocked.
    // Blocking these three loaders eliminates the affected code paths.
    const mod = await import('sharp').catch(() => null);
    if (!mod) return;

    // sharp is CommonJS, so a dynamic import() puts its exports on `.default`
    // and leaves `mod.block` undefined. Calling it threw a TypeError that
    // aborted this hook on every server start — meaning the loaders below
    // were never actually blocked.
    const sharp = (mod as unknown as { default?: typeof mod }).default ?? mod;

    if (typeof sharp.block === 'function') {
      sharp.block({
        operation: ['VipsForeignLoadNsgif', 'VipsForeignLoadTiff', 'VipsForeignLoadVips'],
      });
    }
  }
}
