"use client";

import { Warp } from "@paper-design/shaders-react";

interface WarpBackgroundProps {
  /** 0..1 — overall opacity of the shader. Defaults to a low, brooding 0.55. */
  intensity?: number;
  /** speed of the warp animation. Lower feels heavier. */
  speed?: number;
  /** add the fine grid overlay used elsewhere in the app. */
  grid?: boolean;
  className?: string;
}

/**
 * The dystopian "wave" backdrop. A black-on-black Warp shader from
 * @paper-design/shaders-react, dropped into a fixed layer behind the page.
 *
 * Intentionally monochrome — the only colour in the brand should come from the
 * accent lime, never from the backdrop.
 */
export function WarpBackground({
  intensity = 0.55,
  speed = 0.55,
  grid = true,
  className,
}: WarpBackgroundProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden bg-[var(--color-bg)] ${className ?? ""}`}
    >
      <div className="absolute inset-0" style={{ opacity: intensity }}>
        <Warp
          style={{ width: "100%", height: "100%" }}
          proportion={0.5}
          softness={1}
          distortion={0.22}
          swirl={0.85}
          swirlIterations={10}
          shape="checks"
          shapeScale={0.08}
          scale={1.1}
          rotation={0}
          speed={speed}
          colors={["#000000", "#0a0a0b", "#1a1a1d", "#2a2a2f"]}
        />
      </div>

      {grid && <div className="bg-grid-fine absolute inset-0 opacity-[0.18]" />}
    </div>
  );
}
