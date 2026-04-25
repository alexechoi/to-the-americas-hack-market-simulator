"use client";

import { DebugInferenceCard } from "@/app/components/debug/DebugInferenceCard";
import { DebugTestCard } from "@/app/components/debug/DebugTestCard";
import { DebugYahooCard } from "@/app/components/debug/DebugYahooCard";
import { Footer } from "@/app/components/ui/Footer";
import { Header } from "@/app/components/ui/Header";
import { Tag } from "@/app/components/ui/Tag";
import { API_BASE_URL, apiGet, apiPost } from "@/app/lib/api";

interface OkResponse {
  ok?: boolean;
  error?: string;
  detail?: string;
}

const isOk = (data: unknown) =>
  data != null && typeof data === "object" && (data as OkResponse).ok === true;

export default function DebugPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Backend debug
            </h1>
            <Tag tone="muted">/debug</Tag>
          </div>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Three end-to-end probes: HTTP reachability, Pydantic schema
            validation, and a full LLM inference round-trip through the
            centralised{" "}
            <code className="font-mono text-[var(--color-fg)]">
              build_trader_agent
            </code>{" "}
            utility.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-faint)]">
            target · {API_BASE_URL}
          </p>
        </div>

        <div className="space-y-4">
          <DebugTestCard
            title="1 · Backend connection"
            caption="GET /debug/ping"
            description="Verifies the backend is reachable and reports which LLM provider keys are present in the environment."
            run={() => apiGet("/debug/ping")}
            successProbe={isOk}
          />

          <DebugTestCard
            title="2 · Pydantic schemas"
            caption="GET /debug/pydantic"
            description="Round-trips a sample TraderPersona + TraderDecision through the schemas, then confirms an intentionally invalid TraderDecision is rejected by the validator."
            run={() => apiGet("/debug/pydantic")}
            successProbe={isOk}
          />

          <DebugTestCard
            title="3 · LLM inference"
            caption="POST /debug/inference"
            description="Runs one real pydantic-ai Agent turn against the configured LLM_MODEL with live exchange context and a sample headline. Returns the validated TraderDecision (action / quantity / limit / confidence / reasoning) plus latency. Will fail loudly if the provider API key is missing."
            run={() => apiPost("/debug/inference", {})}
            successProbe={isOk}
          />

          <DebugInferenceCard />

          <DebugYahooCard />
        </div>
      </main>

      <Footer />
    </div>
  );
}
