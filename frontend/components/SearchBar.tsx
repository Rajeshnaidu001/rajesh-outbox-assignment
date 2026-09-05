"use client";

import { useEffect, useState } from "react";

interface Props {
  onChange: (query: string) => void;
}

export function SearchBar({ onChange }: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onChange(value), 300);
    return () => clearTimeout(timer);
  }, [value, onChange]);

  return (
    <div className="relative w-full max-w-sm">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by subject or recipient…"
        className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}
