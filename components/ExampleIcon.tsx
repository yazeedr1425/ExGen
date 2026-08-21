import type { IconKey } from '@/lib/examples';

const PATHS: Record<IconKey, string> = {
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2',
  pen: 'M15 4l5 5L9 20H4v-5L15 4zM13 6l5 5',
  moon: 'M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10z',
  bell: 'M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.5 20a2 2 0 0 0 3 0',
  code: 'M8 6l-5 6 5 6M16 6l5 6-5 6',
  doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h4',
  bookmark: 'M6 4h12v16l-6-4-6 4V4z',
  link: 'M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1',
  chart: 'M5 20V10M12 20V4M19 20v-7',
};

/** Small stroked glyph for an example chip, tinted per example. */
export function ExampleIcon({ name, tint, size = 15 }: { name: IconKey; tint: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tint}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
