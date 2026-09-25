import { ImageResponse } from "next/og";
import { ALMANAC_MARK_PATHS } from "@/components/brand/almanac-mark";

// Favicon: the Almanac mark in paper on a deep-green rounded square,
// matching the sidebar logo in `src/components/layout/sidebar.tsx`.
// Next.js renders this at build time and injects <link rel="icon">.

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a5030",
          borderRadius: 7,
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f4f1e9"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ALMANAC_MARK_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </div>
    ),
    { ...size },
  );
}
