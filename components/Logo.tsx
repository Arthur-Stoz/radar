import Link from 'next/link';

export function Logo({ size = 23, href = '/' }: { size?: number; href?: string | null }) {
  const inner = (
    <>
      <span style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.055em', lineHeight: 1 }}>Radar</span>
      <span className="inline-block rounded-full bg-accent" style={{ width: size * 0.3, height: size * 0.3 }} />
    </>
  );
  if (href === null) return <span className="flex items-baseline gap-[3px]">{inner}</span>;
  return (
    <Link href={href} aria-label="Radar home" className="flex items-baseline gap-[3px] rounded-lg px-0.5 py-1">
      {inner}
    </Link>
  );
}
