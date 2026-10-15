/** Decorative flowing stripes inspired by the HSA logo (purely visual; hidden from assistive tech). */
export function BrandWaves({ className }: { className?: string }) {
  const stripes = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg className={className} viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <defs>
        <linearGradient id="hsa-wave" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="0.45" stopColor="var(--primary)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--primary-hover)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {stripes.map((i) => {
        const o = i * 34;
        return (
          <path
            key={i}
            d={`M -80 ${560 + o} C 120 ${420 + o}, 260 ${760 + o}, 460 ${560 + o} S 720 ${300 + o}, 760 ${380 + o}`}
            fill="none"
            stroke="url(#hsa-wave)"
            strokeWidth={i % 3 === 0 ? 10 : 4}
            strokeLinecap="round"
            opacity={0.25 + (i % 4) * 0.12}
          />
        );
      })}
    </svg>
  );
}
