import Image from 'next/image';

/**
 * The Jeddah Hub logo in the variant matching the active theme.
 *
 * Both variants are rendered and CSS (.theme-light-only / .theme-dark-only in
 * globals.css) shows the right one, keyed off html[data-theme] — which the
 * server and the pre-paint init script already set. Choosing in CSS rather
 * than in React state means dark-mode visitors never see the light logo for a
 * frame before hydration, and no "mounted" flag is needed.
 */
export default function ThemeLogo({
  className,
  priority = false,
}: {
  className?: string;
  /** Above-the-fold usages (navbar, login) should load eagerly. */
  priority?: boolean;
}) {
  const shared = {
    alt: 'Jeddah Hub',
    width: 512,
    height: 491,
    className,
    sizes: '160px',
    loading: priority ? ('eager' as const) : ('lazy' as const),
  };
  return (
    <>
      <span className="theme-light-only"><Image src="/logo.png" {...shared} /></span>
      <span className="theme-dark-only"><Image src="/logo-dark.png" {...shared} /></span>
    </>
  );
}
