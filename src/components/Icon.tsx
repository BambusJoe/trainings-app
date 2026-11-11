/** Eigenes, einheitliches Icon-Set (24er Raster, 2px Strich, runde Enden). */
const PATHS = {
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronUp: 'M5 15l7-7 7 7',
  chevronDown: 'M5 9l7 7 7-7',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  play: 'M8 5.5v13l10.5-6.5z',
  // Hantel: zwei Scheiben je Seite + Griff
  dumbbell: 'M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11',
  journal: 'M6 3.5h10.5A1.5 1.5 0 0 1 18 5v15.5H7.5A2.5 2.5 0 0 1 5 18V4.5a1 1 0 0 1 1-1zM5 18a2.5 2.5 0 0 1 2.5-2.5H18M9 8h5',
  chart: 'M4 20h16M7 16v-4M12 16V7M17 16v-6',
  sliders: 'M5 7h9M18 7h1M5 17h3M12 17h7M16 5v4M10 15v4',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  timer: 'M12 8v5l3 2M9 2.5h6M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, strokeWidth = 2, className }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  const filled = name === 'play'
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3.2 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
