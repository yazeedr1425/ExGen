/** The Extgen mark: a downward triangle filled with nested chevrons, drawn in
 *  the brand's orange-to-amber gradient. Vector rather than an image file so it
 *  stays crisp at any size and inherits the layout's sizing.
 *
 *  The gradient id is fixed on purpose — if the mark appears twice on a page,
 *  both references resolve to the same (identical) definition. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 58"
      role="img"
      aria-label="Extgen"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="extgen-mark" x1="0" y1="0.1" x2="1" y2="0.9">
          <stop offset="0" stopColor="#F2621A" />
          <stop offset="0.45" stopColor="#F98B10" />
          <stop offset="1" stopColor="#FDBA14" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#extgen-mark)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* outer triangle, apex down */}
        <path d="M3 3 H61 L32 55 Z" />
        {/* nested chevrons echoing the silhouette */}
        <path d="M11 9 L32 46 L53 9" />
        <path d="M18 15 L32 39 L46 15" />
        <path d="M25 21 L32 33 L39 21" />
        {/* centre stem */}
        <path d="M32 9 V15" />
      </g>
    </svg>
  );
}

/** Mark plus wordmark, matching the casing used in the logo artwork. */
export function Logo({ size = 26, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <LogoMark size={size} />
      {showWord && <span className="wordmark">Extgen</span>}
    </span>
  );
}
