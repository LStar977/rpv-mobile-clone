// Logo placeholder rebuilt as inline SVG so we can animate the ring/hands.
// Swap path data with the real artwork when the SVG export is available —
// the shape primitives (black disc, gold ring, two hands) stay the same.
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Represent Vote"
    >
      <circle cx="50" cy="50" r="48" fill="#000" stroke="#D4A949" strokeWidth="3" />
      {/* Adult hand (gold) */}
      <path
        d="M32 70 V48 a3 3 0 0 1 6 0 V40 a3 3 0 0 1 6 0 V38 a3 3 0 0 1 6 0 V42 a3 3 0 0 1 6 0 V52 l6 -8 a3 3 0 0 1 5 4 l-10 18 V78 H32 Z"
        fill="#D4A949"
      />
      {/* Child hand (cream, in front) */}
      <path
        d="M44 78 V58 a2.4 2.4 0 0 1 4.8 0 V52 a2.4 2.4 0 0 1 4.8 0 V50 a2.4 2.4 0 0 1 4.8 0 V54 a2.4 2.4 0 0 1 4.8 0 V60 l4 -5 a2.4 2.4 0 0 1 4 3 l-7 12 V78 Z"
        fill="#F2E6CC"
      />
    </svg>
  );
}
