"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center text-muted">Signing you in…</div>;
}

function CallbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      router.replace("/login?error=missing_token");
      return;
    }
    setToken(token);
    refresh().then(() => router.replace("/"));
  }, [params, router, refresh]);

  return <LoadingScreen />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CallbackInner />
    </Suspense>
  );
}
