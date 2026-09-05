"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiFetch, setToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface AuthConfig {
  devLoginEnabled: boolean;
  googleOAuthConfigured: boolean;
  slackOAuthConfigured: boolean;
}

export default function LoginPage() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { refresh, user } = useAuth();

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    apiFetch<AuthConfig>("/api/auth/config")
      .then(setConfig)
      .catch(() => setConfig({ devLoginEnabled: false, googleOAuthConfigured: false, slackOAuthConfigured: false }));
  }, []);

  async function devLogin() {
    setBusy(true);
    try {
      const { token } = await apiFetch<{ token: string }>("/api/auth/dev-login", { method: "POST" });
      setToken(token);
      await refresh();
      router.replace("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Dev login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-fg font-bold">
            O
          </div>
          <h1 className="text-xl font-semibold text-fg">Sign in to Outbox</h1>
          <p className="mt-1 text-sm text-muted">Schedule and track your outbound email campaigns.</p>
        </div>

        <div className="space-y-3">
          <a
            href={config?.googleOAuthConfigured ? `${API_URL}/api/auth/google` : undefined}
            aria-disabled={!config?.googleOAuthConfigured}
            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-fg transition ${
              config?.googleOAuthConfigured ? "hover:bg-surface-hover" : "cursor-not-allowed opacity-50"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.85A11 11 0 0012 23z" />
              <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 015.5 12c0-.73.13-1.44.34-2.1V7.05H2.18A11 11 0 001 12c0 1.77.42 3.45 1.18 4.95l3.66-2.85z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 00-9.82 6.05l3.66 2.85C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            Continue with Google
          </a>
          {!config?.googleOAuthConfigured && (
            <p className="text-center text-xs text-muted">Google OAuth isn&apos;t configured on the server yet.</p>
          )}

          {config?.devLoginEnabled && (
            <>
              <div className="flex items-center gap-3 text-xs text-muted">
                <div className="h-px flex-1 bg-border" />
                or, for local testing
                <div className="h-px flex-1 bg-border" />
              </div>
              <button
                onClick={devLogin}
                disabled={busy}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Dev Login"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
