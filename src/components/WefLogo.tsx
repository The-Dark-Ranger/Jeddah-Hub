/** The World Economic Forum's official logo (public/wef-logo.svg, from
 *  Wikimedia Commons) with its all-white reverse for dark backgrounds.
 *  `variant="auto"` follows the site theme; "white" is for surfaces that
 *  are always dark. Plain <img> — next/image won't optimise SVGs. */
export default function WefLogo({
  alt,
  className,
  height = 40,
  variant = 'auto',
}: {
  alt: string;
  className?: string;
  height?: number;
  variant?: 'auto' | 'white';
}) {
  // Intrinsic aspect ratio of the source artwork (102 × 63).
  const width = Math.round((height * 102) / 63);
  const img = (src: string) => (
    <img src={src} alt={alt} width={width} height={height} className={className} loading="lazy" decoding="async" />
  );

  if (variant === 'white') return img('/wef-logo-white.svg');
  return (
    <>
      <span className="theme-light-only">{img('/wef-logo.svg')}</span>
      <span className="theme-dark-only">{img('/wef-logo-white.svg')}</span>
    </>
  );
}
