import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Loader2, LogOut, RefreshCw, Sparkles } from "lucide-react";
import DashboardBody from "../components/dashboard/DashboardBody";
import ProfileOnboardingModal from "../components/ProfileOnboardingModal";
import { getMyProfile, getMySkills, removeMySkill } from "../utils/api";
import { clearSession } from "../utils/session";
import { clearLocalOnboarding } from "../utils/onboardingLocal";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [p, s] = await Promise.all([getMyProfile(), getMySkills()]);
      setProfile(p);
      const list = Array.isArray(s) ? s : [];
      setSkills(list);
      setShowOnboarding(list.length === 0);
    } catch (e) {
      if (e?.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return;
      }
      setShowOnboarding(false);
      setLoadError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    void loadDashboard();
  }, [loadDashboard]);

  const handleRunSetupAgain = useCallback(async () => {
    if (skills.length === 0) {
      clearLocalOnboarding();
      setShowOnboarding(true);
      return;
    }
    setResetting(true);
    setLoadError("");
    try {
      for (const row of skills) {
        await removeMySkill(row.skill_id);
      }
      setSkills([]);
      clearLocalOnboarding();
      setShowOnboarding(true);
    } catch (e) {
      if (e?.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return;
      }
      setLoadError(e instanceof Error ? e.message : "Could not reset skills.");
    } finally {
      setResetting(false);
    }
  }, [navigate, skills]);

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  const displayName = useMemo(() => {
    if (loadError) {
      return "Can't load profile";
    }
    if (!profile) {
      return "there";
    }
    const fn = profile.first_name?.trim();
    const ln = profile.last_name?.trim();
    if (fn && ln) {
      return `${fn} ${ln}`;
    }
    if (fn) {
      return fn;
    }
    return profile.username?.trim() || "there";
  }, [profile, loadError]);

  const initials = useMemo(() => {
    if (loadError) {
      return "?";
    }
    if (!profile) {
      return "?";
    }
    const fn = profile.first_name?.trim()?.[0];
    const ln = profile.last_name?.trim()?.[0];
    if (fn && ln) {
      return `${fn}${ln}`.toUpperCase();
    }
    if (fn) {
      return fn.toUpperCase();
    }
    const u = profile.username?.trim()?.[0];
    return u ? u.toUpperCase() : "U";
  }, [profile, loadError]);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-900">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(16,185,129,0.22),transparent),radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(56,189,248,0.12),transparent),radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(167,139,250,0.1),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-900/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">UniSkill</p>
              <h1 className="text-lg font-bold text-white sm:text-xl">Dashboard</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 opacity-80" />
            Log out
          </button>
        </motion.header>

        <AnimatePresence>
          {showOnboarding && !loadError ? (
            <ProfileOnboardingModal key="onboarding" onComplete={handleOnboardingComplete} />
          ) : null}
        </AnimatePresence>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
            <p className="text-sm text-slate-400">Loading your profile…</p>
          </div>
        ) : showOnboarding && !loadError ? (
          <p className="py-20 text-center text-sm text-slate-400">
            Use the setup dialog to add what you want to learn and what you can teach.
          </p>
        ) : (
          <div className="space-y-8">
            {loadError ? (
              <motion.div
                {...fadeUp}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-amber-500/25 bg-amber-950/35 p-5 text-amber-50 backdrop-blur-sm"
              >
                <p className="font-semibold text-amber-100">API unreachable</p>
                <p className="mt-1 text-sm text-amber-200/90">{loadError}</p>
                <p className="mt-3 text-sm text-amber-200/85">
                  The dashboard can&apos;t load your data until the browser can reach the backend (common when the server
                  isn&apos;t running or the URL is wrong).
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-amber-200/90">
                  <li>
                    Start FastAPI from <code className="rounded bg-black/25 px-1.5 py-0.5">uniskill-backend</code>:{" "}
                    <code className="rounded bg-black/25 px-1.5 py-0.5">uvicorn app.main:app --reload --port 4000</code>
                  </li>
                  <li>
                    In <code className="rounded bg-black/25 px-1.5 py-0.5">uniskill-frontend/.env</code> set{" "}
                    <code className="rounded bg-black/25 px-1.5 py-0.5">VITE_API_BASE_URL={apiBaseUrl}</code>
                    (adjust if your API uses another host/port), then restart{" "}
                    <code className="rounded bg-black/25 px-1.5 py-0.5">npm run dev</code>.
                  </li>
                </ol>
                <button
                  type="button"
                  onClick={() => void loadDashboard()}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </motion.div>
            ) : null}

            {!loadError ? (
              <>
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => void handleRunSetupAgain()}
                    className="rounded-2xl border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 disabled:opacity-50"
                  >
                    {resetting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Resetting…
                      </span>
                    ) : (
                      "Run setup again"
                    )}
                  </button>
                </div>
                <DashboardBody profile={profile} skills={skills} onRefresh={loadDashboard} />
              </>
            ) : (
              <div className="space-y-8 opacity-80">
                <motion.section
                  {...fadeUp}
                  transition={{ duration: 0.4 }}
                  className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl shadow-black/20"
                >
                  <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-emerald-500/90 via-teal-500/80 to-sky-600/70" />
                  <div className="relative flex flex-col items-center gap-4 px-6 pb-8 pt-16 sm:flex-row sm:items-end sm:px-10">
                    <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-slate-800 text-2xl font-bold text-white">
                      {initials}
                    </div>
                    <div className="text-center sm:text-left">
                      <h2 className="text-2xl font-bold text-slate-900">{displayName}</h2>
                      <p className="mt-2 text-sm text-slate-500">Start the API and retry — your full dashboard will load here.</p>
                    </div>
                  </div>
                </motion.section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
