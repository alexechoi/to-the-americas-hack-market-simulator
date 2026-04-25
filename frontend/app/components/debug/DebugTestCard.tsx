"use client";

import { useState } from "react";

import { Button } from "@/app/components/ui/Button";
import { Panel } from "@/app/components/ui/Panel";
import { Tag } from "@/app/components/ui/Tag";

type Status = "idle" | "running" | "ok" | "error";

interface DebugTestCardProps {
  title: string;
  caption?: string;
  description: string;
  /** Async runner. Should return parsed JSON; throw on transport / non-2xx. */
  run: () => Promise<unknown>;
  /** Pulled from the response and surfaced as the headline metric. */
  successProbe?: (result: unknown) => boolean;
}

const STATUS_TONE: Record<Status, "muted" | "accent" | "up" | "down"> = {
  idle: "muted",
  running: "accent",
  ok: "up",
  error: "down",
};

const STATUS_LABEL: Record<Status, string> = {
  idle: "Idle",
  running: "Running…",
  ok: "Pass",
  error: "Fail",
};

/**
 * Reusable card for one-shot debug probes. Click "Run" → calls `run()` →
 * renders status, wall-clock latency, and the raw JSON response so the
 * developer can eyeball validation, schema shape, and LLM output.
 */
export function DebugTestCard({
  title,
  caption,
  description,
  run,
  successProbe,
}: DebugTestCardProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setStatus("running");
    setError(null);
    setResult(null);
    setLatencyMs(null);
    const started = performance.now();
    try {
      const data = await run();
      const elapsed = performance.now() - started;
      setLatencyMs(elapsed);
      setResult(data);
      const ok = successProbe ? successProbe(data) : true;
      setStatus(ok ? "ok" : "error");
      if (!ok) {
        setError(extractError(data));
      }
    } catch (err) {
      const elapsed = performance.now() - started;
      setLatencyMs(elapsed);
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
      console.error(`[debug] ${title} failed`, err);
    }
  };

  return (
    <Panel
      title={title}
      caption={caption}
      right={
        <div className="flex items-center gap-2">
          {latencyMs !== null && (
            <Tag tone="neutral">{latencyMs.toFixed(0)} ms</Tag>
          )}
          <Tag tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Tag>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-fg-muted)]">{description}</p>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="accent"
            onClick={handleRun}
            disabled={status === "running"}
          >
            {status === "running" ? "Running…" : "Run test"}
          </Button>
          {status === "ok" && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-up)]">
              passed
            </span>
          )}
        </div>

        {error && (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-[var(--color-down)]/40 bg-[color-mix(in_oklab,var(--color-down)_8%,transparent)] p-3 font-mono text-[11px] text-[var(--color-down)]">
            {error}
          </pre>
        )}

        {result !== null && (
          <pre className="max-h-80 overflow-auto border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3 font-mono text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </Panel>
  );
}

function extractError(data: unknown): string | null {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.detail === "string") return obj.detail;
  }
  return null;
}
