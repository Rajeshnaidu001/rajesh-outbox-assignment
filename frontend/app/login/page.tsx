"use client";

import { useEffect, useState, type FormEvent } from "react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await apiFetch<{ token: string }>("/api/auth/dev-login", { method: "POST" });
      setToken(token);
      await refresh();
      router.replace("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  const devLoginEnabled = Boolean(config?.devLoginEnabled);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-fg">Login</h1>

        <a
          href={config?.googleOAuthConfigured ? `${API_URL}/api/auth/google` : undefined}
          aria-disabled={!config?.googleOAuthConfigured}
          className={`mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-soft px-4 py-2.5 text-sm font-medium text-accent-soft-fg transition ${
            config?.googleOAuthConfigured ? "hover:opacity-90" : "cursor-not-allowed opacity-50"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.85A11 11 0 0012 23z" />
            <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 015.5 12c0-.73.13-1.44.34-2.1V7.05H2.18A11 11 0 001 12c0 1.77.42 3.45 1.18 4.95l3.66-2.85z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 00-9.82 6.05l3.66 2.85C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          Login with Google
        </a>
        {!config?.googleOAuthConfigured && (
          <p className="mb-3 text-center text-xs text-muted">Google OAuth isn&apos;t configured on the server yet.</p>
        )}

        <div className="my-4 flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-border" />
          or sign up through email
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email ID"
            disabled={!devLoginEnabled}
            className="w-full rounded-lg bg-surface-hover px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            disabled={!devLoginEnabled}
            className="w-full rounded-lg bg-surface-hover px-3 py-2.5 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!devLoginEnabled || busy}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Login"}
          </button>
        </form>
        <p className="mt-3 text-center text-xs text-muted">
          {devLoginEnabled
            ? "Local dev mode: any values above sign you in as a test user."
            : "Email/password sign-in is disabled on this server — use Google."}
        </p>
      </div>
    </div>
  );
}
