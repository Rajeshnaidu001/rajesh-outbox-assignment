"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ConnectSlackButton } from "./ConnectSlackButton";
import { ThemeToggle } from "./ThemeToggle";

type Tab = "scheduled" | "sent";

interface Counts {
  scheduled: number;
  sent: number;
}

const NAV_ITEMS: { key: Tab; label: string }[] = [
  { key: "scheduled", label: "Scheduled" },
  { key: "sent", label: "Sent" },
];

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onCompose: () => void;
  refreshToken: number;
}

export function Sidebar({ activeTab, onTabChange, onCompose, refreshToken }: Props) {
  const { user, logout } = useAuth();
  const [counts, setCounts] = useState<Counts>({ scheduled: 0, sent: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      apiFetch<Counts>("/api/emails/counts")
        .then((c) => !cancelled && setCounts(c))
        .catch(() => undefined);
    }
    load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshToken]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!user) return null;

  return (
    <aside className="flex h-screen w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar-bg px-4 py-5">
      <div className="mb-6 px-1 font-mono text-2xl font-black tracking-tight text-sidebar-fg">OUTBOX</div>

      <div className="relative mb-4" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left transition hover:bg-sidebar-hover"
        >
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="rounded-full" unoptimized />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-hover text-sm font-medium text-sidebar-fg">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-sidebar-fg">{user.name}</div>
            <div className="truncate text-xs text-sidebar-muted">{user.email}</div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-sidebar-muted">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 space-y-2 rounded-lg border border-sidebar-border bg-sidebar-bg p-2 shadow-xl">
            <ConnectSlackButton />
            <div className="flex items-center justify-between rounded-lg px-2 py-1.5">
              <span className="text-sm text-sidebar-fg">Theme</span>
              <ThemeToggle />
            </div>
            <button
              onClick={logout}
              className="w-full rounded-lg border border-sidebar-border px-3 py-1.5 text-left text-sm font-medium text-sidebar-fg transition hover:bg-sidebar-hover"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onCompose}
        className="mb-6 w-full rounded-full border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-accent-fg"
      >
        Compose
      </button>

      <div className="px-1 text-xs font-medium uppercase tracking-wide text-sidebar-muted">Core</div>
      <nav className="mt-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-sidebar-active-bg text-sidebar-active-fg" : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
              }`}
            >
              {item.key === "scheduled" ? <ClockIcon /> : <SendIcon />}
              <span className="flex-1 text-left">{item.label}</span>
              <span className="text-xs">{item.key === "scheduled" ? counts.scheduled : counts.sent}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
