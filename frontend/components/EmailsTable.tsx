"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { EmailRow } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

const POLL_INTERVAL_MS = 8000;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatFull(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0 text-muted">
      <path d="M12 2.5 15 9l7 .9-5.1 4.8L18.2 21 12 17.4 5.8 21l1.3-6.3L2 9.9 9 9l3-6.5Z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

interface Props {
  kind: "scheduled" | "sent";
  searchQuery: string;
  refreshToken: number;
  statusFilter: string;
}

export function EmailsTable({ kind, searchQuery, refreshToken, statusFilter }: Props) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmailRow | null>(null);
  const isSearching = searchQuery.trim().length > 0;
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const myRequestId = ++requestId.current;

    async function load(showSpinner: boolean) {
      if (showSpinner) setLoading(true);
      try {
        const path = isSearching
          ? `/api/emails/search?status=${kind}&q=${encodeURIComponent(searchQuery.trim())}`
          : `/api/emails?status=${kind}`;
        const data = await apiFetch<EmailRow[]>(path);
        if (!cancelled && requestId.current === myRequestId) {
          setRows(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && requestId.current === myRequestId) {
          setError(err instanceof Error ? err.message : "Failed to load emails");
        }
      } finally {
        if (!cancelled && requestId.current === myRequestId) setLoading(false);
      }
    }

    load(true);
    setSelected(null);

    // Only poll the live, unfiltered view — an active search is a point-in-time query.
    const interval = isSearching ? null : setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [kind, searchQuery, isSearching, refreshToken]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-hover" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-danger">{error}</div>;
  }

  const visibleRows = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);

  if (visibleRows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-sm font-medium text-fg">
          {isSearching || statusFilter !== "all"
            ? "No results match your filters"
            : kind === "scheduled"
              ? "Nothing scheduled yet"
              : "No emails sent yet"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {isSearching
            ? "Try a different keyword."
            : kind === "scheduled"
              ? "Compose a campaign to get started."
              : "Sent emails will show up here once they go out."}
        </p>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <button onClick={() => setSelected(null)} className="flex min-w-0 items-center gap-3 text-sm font-medium text-fg">
            <BackIcon />
            <span className="truncate">{selected.subject}</span>
          </button>
          <StatusBadge status={selected.status} time={selected.status === "sent" || selected.status === "failed" ? selected.sentAt : selected.scheduledAt} />
        </div>
        <div className="px-5 py-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-soft-fg">
              {(selected.sender ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-fg">{selected.sender}</div>
              <div className="truncate text-xs text-muted">to {selected.recipient}</div>
            </div>
            <div className="ml-auto shrink-0 text-xs text-muted">
              {formatFull(selected.status === "sent" || selected.status === "failed" ? selected.sentAt : selected.scheduledAt)}
            </div>
          </div>
          {selected.status === "failed" && selected.error && (
            <div className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{selected.error}</div>
          )}
          <div className="prose prose-sm max-w-none text-sm text-fg" dangerouslySetInnerHTML={{ __html: selected.body }} />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {visibleRows.map((row) => (
        <button
          key={row.id}
          onClick={() => setSelected(row)}
          className="flex w-full items-center gap-4 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-surface-hover"
        >
          <span className="w-40 shrink-0 truncate text-sm font-semibold text-fg">To: {row.recipient}</span>
          <StatusBadge status={row.status} time={kind === "scheduled" ? row.scheduledAt : row.sentAt} />
          <span className="min-w-0 flex-1 truncate text-sm text-fg">
            <span className="font-semibold">{row.subject}</span>
            <span className="text-muted"> · {stripHtml(row.body)}</span>
          </span>
          <StarIcon />
        </button>
      ))}
    </div>
  );
}
