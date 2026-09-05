"use client";

import { useEffect, useRef, useState } from "react";

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  onChange: (query: string) => void;
  onRefresh: () => void;
  filterOptions: FilterOption[];
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
}

export function SearchBar({ onChange, onRefresh, filterOptions, statusFilter, onStatusFilterChange }: Props) {
  const [value, setValue] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => onChange(value), 300);
    return () => clearTimeout(timer);
  }, [value, onChange]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const activeLabel = filterOptions.find((f) => f.value === statusFilter)?.label;

  return (
    <div className="flex w-full max-w-lg items-center gap-2">
      <div className="relative flex-1">
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
          placeholder="Search"
          className="w-full rounded-lg border border-border bg-surface-hover py-2 pl-9 pr-3 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="relative" ref={filterRef}>
        <button
          onClick={() => setFilterOpen((v) => !v)}
          title={activeLabel && statusFilter !== "all" ? `Filtered: ${activeLabel}` : "Filter"}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
            statusFilter !== "all" ? "border-accent text-accent" : "border-border text-muted hover:bg-surface-hover"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M4 5h16M7 12h10M10 19h4" />
          </svg>
        </button>
        {filterOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-lg border border-border bg-surface p-1 shadow-lg">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onStatusFilterChange(opt.value);
                  setFilterOpen(false);
                }}
                className={`block w-full rounded-md px-3 py-1.5 text-left text-sm ${
                  opt.value === statusFilter ? "bg-accent-soft text-accent-soft-fg" : "text-fg hover:bg-surface-hover"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onRefresh}
        title="Refresh"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition hover:bg-surface-hover"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" />
        </svg>
      </button>
    </div>
  );
}
