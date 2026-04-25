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
    <div className={wrapperClass}>
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          // Plain Enter sends; Shift+Enter inserts a newline (standard chat ergonomics).
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Type a headline · ↵ to inject · ⇧↵ for newline"
        rows={2}
        className="block w-full resize-none bg-transparent px-3 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus:outline-none"
      />
      <div className="flex items-center justify-end border-t border-[var(--color-line)] px-3 py-2">
        <Button size="sm" onClick={submit} disabled={!title.trim()}>
          Inject
          <span aria-hidden>↵</span>
        </Button>
      </div>
    </div>
  );
}
