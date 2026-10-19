interface WaveDividerProps {
  fill?: string;
  /** Painted under `fill`. Needed when `fill` is translucent (e.g.
   *  var(--card-bg)) and the wave sits on a differently coloured section:
   *  without it that section's colour bleeds through the wave, so the wave
   *  no longer matches the section it continues. */
  backdrop?: string;
  flip?: boolean;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

const PATH = 'M0,40 C240,80 480,0 720,40 C960,80 1200,0 1440,40 L1440,80 L0,80 Z';

export default function WaveDivider({
  fill = 'var(--background)',
  backdrop,
  flip = false,
  height = 80,
  className,
  style,
}: WaveDividerProps) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ lineHeight: 0, overflow: 'hidden', display: 'block', ...style }}
    >
      <svg
        viewBox="0 0 1440 80"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        style={{
          width: '100%',
          height: `${height}px`,
          display: 'block',
          ...(flip ? { transform: 'scaleY(-1)' } : {}),
        }}
      >
        {backdrop && <path d={PATH} fill={backdrop} />}
        <path d={PATH} fill={fill} />
      </svg>
    </div>
  );
}
