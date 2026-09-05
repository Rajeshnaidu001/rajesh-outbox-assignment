"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { EmailRow } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

const POLL_INTERVAL_MS = 8000;

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  kind: "scheduled" | "sent";
  searchQuery: string;
  refreshToken: number;
}

export function EmailsTable({ kind, searchQuery, refreshToken }: Props) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-hover" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-danger">{error}</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-sm font-medium text-fg">
          {isSearching ? "No results match your search" : kind === "scheduled" ? "Nothing scheduled yet" : "No emails sent yet"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {isSearching ? "Try a different keyword." : kind === "scheduled" ? "Compose a campaign to get started." : "Sent emails will show up here once they go out."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Recipient</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">{kind === "scheduled" ? "Scheduled For" : "Sent At"}</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
              <td className="px-4 py-3 font-medium text-fg">{row.recipient}</td>
              <td className="max-w-xs truncate px-4 py-3 text-fg" title={row.subject}>
                {row.subject}
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(kind === "scheduled" ? row.scheduledAt : row.sentAt)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
                {row.status === "failed" && row.error && (
                  <span className="ml-2 text-xs text-muted" title={row.error}>
                    ⓘ
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
