"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { ComposeModal } from "@/components/ComposeModal";
import { ScheduledTable } from "@/components/ScheduledTable";
import { SentTable } from "@/components/SentTable";
import { SearchBar, type FilterOption } from "@/components/SearchBar";

type Tab = "scheduled" | "sent";

const FILTER_OPTIONS: Record<Tab, FilterOption[]> = {
  scheduled: [
    { value: "all", label: "All" },
    { value: "scheduled", label: "Scheduled" },
    { value: "sending", label: "Sending" },
  ],
  sent: [
    { value: "all", label: "All" },
    { value: "sent", label: "Sent" },
    { value: "failed", label: "Failed" },
  ],
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("scheduled");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  function changeTab(next: Tab) {
    setTab(next);
    setStatusFilter("all");
  }

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar activeTab={tab} onTabChange={changeTab} onCompose={() => setComposeOpen(true)} refreshToken={refreshToken} />

      <main className="min-w-0 flex-1 px-6 py-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <SearchBar
            onChange={setSearchQuery}
            onRefresh={() => setRefreshToken((t) => t + 1)}
            filterOptions={FILTER_OPTIONS[tab]}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </div>

        {tab === "scheduled" ? (
          <ScheduledTable searchQuery={searchQuery} refreshToken={refreshToken} statusFilter={statusFilter} />
        ) : (
          <SentTable searchQuery={searchQuery} refreshToken={refreshToken} statusFilter={statusFilter} />
        )}
      </main>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onScheduled={(count) => {
          setRefreshToken((t) => t + 1);
          changeTab("scheduled");
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
