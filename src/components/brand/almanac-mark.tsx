import type { SVGProps } from "react";

/**
 * The Almanac mark: a calendar page that is also a chat bubble. Two
 * binder tabs on top, two lines of text inside, a speech tail below.
 *
 * Drawn in currentColor on a 24px grid with a 2px stroke, the same
 * shape language as the lucide icons around it. `icon.tsx` reuses
 * the paths for the favicon.
 */
export const ALMANAC_MARK_PATHS = [
  "M5.5 5h13A1.5 1.5 0 0 1 20 6.5v9a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17h-1A1.5 1.5 0 0 1 4 15.5v-9A1.5 1.5 0 0 1 5.5 5z",
  "M9 3v4",
  "M15 3v4",
  "M8 10.5h8",
  "M8 13.5h4.5",
] as const;

export function AlmanacMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {ALMANAC_MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
