"use client";

import Image from "next/image";
import { useAuth } from "@/lib/auth";
import { ConnectSlackButton } from "./ConnectSlackButton";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/80 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg font-bold">O</div>
        <span className="text-lg font-semibold text-fg">Outbox</span>
      </div>

      <div className="flex items-center gap-3">
        <ConnectSlackButton />
        <ThemeToggle />

        <div className="ml-2 flex items-center gap-2 border-l border-border pl-3">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={32}
              height={32}
              className="rounded-full"
              unoptimized
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-sm font-medium text-fg">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="hidden text-sm sm:block">
            <div className="font-medium text-fg">{user.name}</div>
            <div className="text-xs text-muted">{user.email}</div>
          </div>
          <button
            onClick={logout}
            className="ml-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg transition hover:bg-surface-hover"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
