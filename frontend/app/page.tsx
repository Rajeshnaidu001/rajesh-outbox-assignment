"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { ComposeModal } from "@/components/ComposeModal";
import { ScheduledTable } from "@/components/ScheduledTable";
import { SentTable } from "@/components/SentTable";
import { SearchBar } from "@/components/SearchBar";

type Tab = "scheduled" | "sent";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("scheduled");
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-bg">
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-fg">Campaigns</h1>
            <p className="text-sm text-muted">Schedule, throttle, and track your outbound email campaigns.</p>
          </div>
          <button
            onClick={() => setComposeOpen(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90"
          >
            + Compose
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {(["scheduled", "sent"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                  tab === t ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <SearchBar onChange={setSearchQuery} />
        </div>

        {tab === "scheduled" ? (
          <ScheduledTable searchQuery={searchQuery} refreshToken={refreshToken} />
        ) : (
          <SentTable searchQuery={searchQuery} refreshToken={refreshToken} />
        )}
      </main>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onScheduled={(count) => {
          setRefreshToken((t) => t + 1);
          setTab("scheduled");
          setToast(`Scheduled ${count} email${count === 1 ? "" : "s"}.`);
        }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
