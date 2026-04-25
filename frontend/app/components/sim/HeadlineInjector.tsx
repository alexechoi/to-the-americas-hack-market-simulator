"use client";

import { useState } from "react";

import { Button } from "../ui/Button";

interface HeadlineInjectorProps {
  onInject: (title: string) => void;
}

export function HeadlineInjector({ onInject }: HeadlineInjectorProps) {
  const [title, setTitle] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onInject(title.trim());
    setTitle("");
  };

  return (
    <div className="border border-[var(--color-line-strong)] bg-[var(--color-surface-2)]">
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="Type a headline · ⌘↵ to inject"
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
