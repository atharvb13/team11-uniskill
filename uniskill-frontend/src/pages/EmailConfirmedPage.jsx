import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { hasActiveSession, saveSession } from "../utils/session";

export default function EmailConfirmedPage() {
  const [status, setStatus] = useState("loading");
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!supabase) {
          if (!cancelled) {
            setConfigError(true);
            setStatus("ready");
          }
          if (window.location.hash) {
            window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
          }
          return;
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error(error);
        }

        if (session?.access_token && !cancelled) {
          saveSession({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at,
          });
        }

        if (!cancelled) {
          setStatus("ready");
        }
      } finally {
        if (window.location.hash) {
          window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const loggedIn = hasActiveSession();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {status === "loading" ? (
          <Loader2 className="mx-auto h-14 w-14 animate-spin text-emerald-600" aria-hidden />
        ) : (
          <CheckCircle className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
        )}
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Email verified</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your UMass email has been confirmed. You can sign in to UniSkill now.
        </p>
        {configError ? (
          <p className="mt-3 text-xs text-amber-800">
            Add <code className="rounded bg-amber-50 px-1">VITE_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-amber-50 px-1">VITE_SUPABASE_ANON_KEY</code> to{" "}
            <code className="rounded bg-amber-50 px-1">.env</code> so confirmation links can finish in the app (then
            restart Vite).
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {loggedIn ? (
            <Link
              to="/dashboard"
              className="inline-flex justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Go to dashboard
            </Link>
          ) : null}
          <Link
            to="/login"
            className={`inline-flex justify-center rounded-2xl px-6 py-3 text-sm font-semibold transition ${
              loggedIn
                ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                : "bg-slate-950 text-white hover:bg-slate-800"
            }`}
          >
            {loggedIn ? "Sign in as another user" : "Go to login"}
          </Link>
        </div>
      </div>
    </div>
  );
}
