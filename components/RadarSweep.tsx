// The radar sweep from the design export (rings, conic sweep, ping, blips). Decorative only.

const BLIPS: [number, number][] = [
  [38, 0.29],
  [118, 0.41],
  [206, 0.21],
  [296, 0.36],
  [252, 0.44],
];

export function RadarSweep({ size = 1040, on, sweepSeconds = 7, rings = [0.16, 0.32, 0.48, 0.64, 0.8, 0.96], blips = true }: { size?: number; on: boolean; sweepSeconds?: number; rings?: number[]; blips?: boolean }) {
  const mask = 'radial-gradient(closest-side, #000 32%, transparent 100%)';
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        transform: 'translate(-50%,-50%)',
        pointerEvents: 'none',
        zIndex: -1,
        opacity: on ? 1 : 0,
        transition: 'opacity .9s ease',
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {rings.map((r) => (
        <div
          key={r}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: size * r,
            height: size * r,
            marginLeft: (-size * r) / 2,
            marginTop: (-size * r) / 2,
            borderRadius: '50%',
            border: '1px solid var(--ring-faint)',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'conic-gradient(from 0deg, rgba(0,201,122,0) 0deg, rgba(0,201,122,0) 280deg, rgba(0,201,122,0.12) 352deg, rgba(0,201,122,0.3) 359.4deg, rgba(0,201,122,0) 360deg)',
          animation: on ? `rdSpin ${sweepSeconds}s linear infinite` : 'none',
        }}
      />
      <div style={{ position: 'absolute', inset: '2%', borderRadius: '50%', border: '1px solid rgba(0,201,122,0.45)', animation: on ? 'rdPing 4.2s cubic-bezier(.2,.6,.3,1) infinite' : 'none', opacity: 0 }} />
      {blips &&
        BLIPS.map(([a, r]) => {
          const rad = (a * Math.PI) / 180;
          return (
            <div
              key={a}
              style={{
                position: 'absolute',
                left: `calc(50% + ${(Math.sin(rad) * r * size).toFixed(1)}px - 3.5px)`,
                top: `calc(50% - ${(Math.cos(rad) * r * size).toFixed(1)}px - 3.5px)`,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#00C97A',
                boxShadow: '0 0 0 4px rgba(0,201,122,.14)',
                opacity: 0,
                animation: on ? `rdBlip ${sweepSeconds}s ease-out ${((a / 360) * sweepSeconds).toFixed(2)}s infinite` : 'none',
              }}
            />
          );
        })}
    </div>
  );
}
