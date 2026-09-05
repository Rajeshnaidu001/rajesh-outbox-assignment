"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function ConnectSlackButton() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/slack/oauth/url");
      window.location.href = url;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not start Slack connection");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await apiFetch("/api/slack/connection", { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (user?.slackConnected) {
    return (
      <button
        onClick={disconnect}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition hover:bg-surface-hover disabled:opacity-60"
        title="Click to disconnect"
      >
        <span className="h-2 w-2 rounded-full bg-success" />
        Slack connected{user.slackTeamName ? ` · ${user.slackTeamName}` : ""}
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={busy}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition hover:bg-surface-hover disabled:opacity-60"
    >
      <span className="h-2 w-2 rounded-full bg-muted" />
      {busy ? "Connecting…" : "Connect Slack"}
    </button>
  );
}
