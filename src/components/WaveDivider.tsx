interface WaveDividerProps {
  fill?: string;
  flip?: boolean;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function WaveDivider({
  fill = 'var(--background)',
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
        <path
          d="M0,40 C240,80 480,0 720,40 C960,80 1200,0 1440,40 L1440,80 L0,80 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
