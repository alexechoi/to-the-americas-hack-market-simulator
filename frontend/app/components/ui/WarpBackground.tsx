"use client";

import { Warp } from "@paper-design/shaders-react";

/**
 * Tonal presets for the wave. Each is a 4-stop ramp from pure black up to a
 * deep, desaturated mid-tone. Strict: never goes brighter than the surface-3
 * neutral, so the wave reads as ambience, not decoration.
 */
const TONES = {
  /** monochrome — disappears into the page; safest, lowest contrast. */
  ink: ["#000000", "#0a0a0b", "#1a1a1d", "#2a2a2f"],
  /** cold steel-blue — Palantir Gotham terminal, intelligence-agency feel. */
  steel: ["#000000", "#05080d", "#0c1622", "#1a2a3a"],
  /** warm oxblood — evil hedge fund, blood-money. */
  oxblood: ["#000000", "#0a0405", "#1a0a0d", "#2a1015"],
  /** Matrix terminal — toxic green-black surveillance. */
  toxic: ["#000000", "#040806", "#0a1410", "#152822"],
  /** dimmed brand lime — a deep olive ramp that echoes --color-accent. */
  lime: ["#000000", "#080a02", "#1a2208", "#3d5a14"],
} as const;

export type WarpTone = keyof typeof TONES;

interface WarpBackgroundProps {
  /** 0..1 — overall opacity of the shader. Defaults to a low, brooding 0.55. */
  intensity?: number;
  /** speed of the warp animation. Lower feels heavier. */
  speed?: number;
  /** colour ramp preset. */
  tone?: WarpTone;
  /** add the fine grid overlay used elsewhere in the app. */
  grid?: boolean;
  className?: string;
}

/**
 * The dystopian "wave" backdrop — a Warp shader from @paper-design/shaders-react
 * dropped into a fixed layer behind page content. Tones stay deep enough that
 * the lime accent in the foreground is still the only real colour on the page.
 */
export function WarpBackground({
  intensity = 0.55,
  speed = 1.6,
  tone = "lime",
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
          colors={[...TONES[tone]]}
        />
      </div>

      {grid && <div className="bg-grid-fine absolute inset-0 opacity-[0.18]" />}
    </div>
  );
}
