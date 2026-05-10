import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { supabase } from "../lib/supabaseClient";
import { syncGoogleSession } from "../utils/api";
import { clearSession, saveSession, saveSupabaseSession } from "../utils/session";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing Google sign-in...");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      if (!supabase) {
        setError("Google sign-in is not configured.");
        return;
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const oauthError = params.get("error_description") || params.get("error");
        if (oauthError) {
          throw new Error(oauthError);
        }

        let session = null;
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
          session = data?.session ?? null;
        }

        if (!session) {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            throw sessionError;
          }
          session = data?.session ?? null;
        }

        if (!session?.access_token) {
          throw new Error("Google sign-in did not return a session.");
        }

        const response = await syncGoogleSession(session);
        saveSession(response.session ?? null);
        saveSupabaseSession(session);

        if (!cancelled) {
          setMessage("Sign-in complete.");
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        await supabase.auth.signOut();
        clearSession();
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not complete Google sign-in.");
        }
      }
    }

    finishSignIn();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <AuthLayout title="Google sign-in" subtitle={error ? "Use your UMass Google account." : message}>
      <div className="space-y-4 text-center">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!error ? <p className="text-sm text-slate-500">{message}</p> : null}
        {error ? (
          <Link to="/login" className="inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700">
            Back to login
          </Link>
        ) : null}
      </div>
    </AuthLayout>
  );
}
