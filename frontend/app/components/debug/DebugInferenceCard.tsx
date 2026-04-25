"use client";

import { useMemo, useState } from "react";

import { Button } from "@/app/components/ui/Button";
import { Panel } from "@/app/components/ui/Panel";
import { Tag } from "@/app/components/ui/Tag";
import { apiPost } from "@/app/lib/api";

type Status = "idle" | "running" | "ok" | "error";

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

function extractError(data: unknown): string | null {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.detail === "string") return obj.detail;
  }
  return null;
}

export function DebugInferenceCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const [model, setModel] = useState<string>(
    "gateway/groq:llama-3.3-70b-versatile",
  );
  const [headline, setHeadline] = useState<string>(
    "NVDA reports record Q4 earnings, beats estimates by 18%.",
  );
  const [userPrompt, setUserPrompt] = useState<string>(
    "Decide your next action based on the latest headline and market state.",
  );

  const payload = useMemo(
    () => ({
      model: model.trim() || null,
      headline: headline.trim(),
      user_prompt: userPrompt.trim(),
    }),
    [headline, model, userPrompt],
  );

  const handleRun = async () => {
    setStatus("running");
    setError(null);
    setResult(null);
    setLatencyMs(null);
    const started = performance.now();
    try {
      const data = await apiPost("/debug/inference", payload);
      const elapsed = performance.now() - started;
      setLatencyMs(elapsed);
      setResult(data);
      const ok =
        data != null &&
        typeof data === "object" &&
        (data as Record<string, unknown>).ok === true;
      setStatus(ok ? "ok" : "error");
      if (!ok) setError(extractError(data));
    } catch (err) {
      const elapsed = performance.now() - started;
      setLatencyMs(elapsed);
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
      console.error("[debug] inference failed", err);
    }
  };

  return (
    <Panel
      title="4 · Gateway query"
      caption="POST /debug/inference"
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
        <p className="text-sm text-[var(--color-fg-muted)]">
          Runs one live pydantic-ai turn using a <code>gateway/...</code> model
          string. If it fails, the response should include a hint pointing at{" "}
          <code>PYDANTIC_AI_GATEWAY_API_KEY</code>.
        </p>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
              model
            </span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              spellCheck={false}
              className="w-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 font-mono text-[12px] text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
              placeholder="gateway/groq:llama-3.3-70b-versatile"
            />
          </label>

          <label className="grid gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
              headline
            </span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-[12px] text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
              placeholder="Type a headline the agents should react to"
            />
          </label>

          <label className="grid gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
              user_prompt
            </span>
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              rows={3}
              className="w-full resize-y border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-[12px] text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="accent"
            onClick={handleRun}
            disabled={status === "running"}
          >
            {status === "running" ? "Running…" : "Run query"}
          </Button>
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

