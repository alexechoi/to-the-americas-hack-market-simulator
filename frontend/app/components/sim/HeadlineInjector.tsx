"use client";

import { useState } from "react";

import { Button } from "../ui/Button";

interface HeadlineInjectorProps {
  onInject: (title: string) => void;
  /**
   * When true, render without an outer border / surface step — for use as the
   * compose row inside another bordered panel (e.g. inside the News panel).
   */
  flush?: boolean;
}

export function HeadlineInjector({ onInject, flush }: HeadlineInjectorProps) {
  const [title, setTitle] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onInject(title.trim());
    setTitle("");
  };

  const wrapperClass = flush
    ? ""
    : "border border-[var(--color-line-strong)] bg-[var(--color-surface-2)]";

  return (
    <div className={`flex items-end gap-2 px-3 py-2 ${wrapperClass}`}>
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Type a headline…"
        rows={2}
        className="flex-1 resize-none bg-transparent text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:outline-none"
      />
      <Button size="sm" onClick={submit} disabled={!title.trim()}>
        Inject
      </Button>
    </div>
  );
}
