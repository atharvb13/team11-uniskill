import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Github,
  GraduationCap,
  Linkedin,
  Loader2,
  Sparkles,
  Target,
  UserX,
} from "lucide-react";
import { getPublicProfile } from "../utils/api";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const cardShell =
  "relative overflow-hidden rounded-[28px] border border-white/30 bg-white/[0.96] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.28)] backdrop-blur-xl";

function proficiencyBadgeClass(level) {
  switch (level) {
    case "expert":
      return "border-violet-200 bg-violet-50 text-violet-900";
    case "advanced":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "intermediate":
      return "border-teal-200 bg-teal-50 text-teal-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default function UserProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setNotFound(false);
      try {
        const data = await getPublicProfile(username);
        if (!cancelled) setProfile(data);
      } catch (e) {
        if (cancelled) return;
        if (e?.status === 404) {
          setNotFound(true);
        } else {
          setError(e instanceof Error ? e.message : "Could not load profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [username]);

  const displayName = useMemo(() => {
    if (!profile) return username || "User";
    const fn = profile.first_name?.trim();
    const ln = profile.last_name?.trim();
    if (fn && ln) return `${fn} ${ln}`;
    return fn || profile.username || username || "User";
  }, [profile, username]);

  const initials = useMemo(() => {
    if (!profile) return (username?.[0] ?? "U").toUpperCase();
    const fn = profile.first_name?.trim()?.[0];
    const ln = profile.last_name?.trim()?.[0];
    if (fn && ln) return `${fn}${ln}`.toUpperCase();
    if (fn) return fn.toUpperCase();
    return (profile.username?.[0] ?? "U").toUpperCase();
  }, [profile, username]);

  const teach = Array.isArray(profile?.teach_skills) ? profile.teach_skills : [];
  const learn = Array.isArray(profile?.learn_skills) ? profile.learn_skills : [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-900">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(16,185,129,0.22),transparent),radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(56,189,248,0.12),transparent),radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(167,139,250,0.1),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-10 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-[13px] font-medium text-slate-300 backdrop-blur-sm transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-900/40">
                <Sparkles className="h-[15px] w-[15px] text-white" />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-white">UniSkill</span>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            @{username}
          </p>
        </motion.header>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-32">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
            <p className="text-sm text-slate-400">Loading profile…</p>
          </div>
        )}

        {/* Not found */}
        {!loading && notFound && (
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center justify-center gap-5 py-32 text-center"
          >
            <UserX className="h-14 w-14 text-slate-600" strokeWidth={1.4} />
            <div>
              <p className="text-xl font-bold text-white">User not found</p>
              <p className="mt-2 text-sm text-slate-400">
                There is no account with the username{" "}
                <span className="font-semibold text-slate-200">@{username}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
          </motion.div>
        )}

        {/* Error */}
        {!loading && error && (
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-red-100"
          >
            <p className="font-semibold">Could not load profile</p>
            <p className="mt-1 text-sm text-red-200/80">{error}</p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
          </motion.div>
        )}

        {/* Profile */}
        {!loading && !notFound && !error && profile && (
          <div className="space-y-8">
            {/* Hero card */}
            <motion.section
              {...fadeUp}
              transition={{ duration: 0.45 }}
              className={`${cardShell} ring-1 ring-white/40`}
            >
              <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" aria-hidden />

              <div className="relative h-28 overflow-hidden bg-gradient-to-br from-emerald-400 via-teal-500 to-sky-600 sm:h-36">
                <div
                  className="absolute inset-0 opacity-[0.35]"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.22'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                  }}
                  aria-hidden
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" aria-hidden />
              </div>

              <div className="relative z-[1] -mt-12 flex flex-col items-center gap-5 px-6 pb-10 pt-0 sm:-mt-16 sm:flex-row sm:items-end sm:gap-8 sm:px-10">
                <div className="relative shrink-0">
                  {profile.profile_picture_url ? (
                    <img
                      src={profile.profile_picture_url}
                      alt={displayName}
                      className="h-[5.75rem] w-[5.75rem] rounded-3xl border-[3px] border-white object-cover shadow-[0_20px_40px_-12px_rgba(15,23,42,0.5)] sm:h-[7.25rem] sm:w-[7.25rem]"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    style={{ display: profile.profile_picture_url ? "none" : "flex" }}
                    className="relative h-[5.75rem] w-[5.75rem] items-center justify-center sm:h-[7.25rem] sm:w-[7.25rem]"
                  >
                    <div className="absolute -inset-1 rounded-[1.35rem] bg-gradient-to-br from-emerald-300 via-white to-sky-200 opacity-90 blur-[2px]" aria-hidden />
                    <div className="relative flex h-full w-full items-center justify-center rounded-3xl border-[3px] border-white bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-2xl font-bold tracking-tight text-white shadow-[0_20px_40px_-12px_rgba(15,23,42,0.5)] sm:text-3xl">
                      {initials}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 pb-1 text-center sm:pb-3 sm:text-left">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600/90">
                    UniSkill member
                  </p>
                  <h1 className="mt-1.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-2xl font-bold leading-tight tracking-tight text-transparent sm:text-3xl">
                    {displayName}
                  </h1>
                  <p className="mt-1.5 text-sm font-medium text-slate-500">
                    @{profile.username}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {profile.date_of_joining ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                        Joined{" "}
                        {new Date(profile.date_of_joining).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                        })}
                      </span>
                    ) : null}
                    {(profile.program || profile.degree_type) ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-medium text-emerald-800 shadow-sm">
                        <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
                        {[profile.degree_type, profile.program].filter(Boolean).join(" · ")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-200/80 bg-slate-50/60 px-3 py-1 text-xs font-medium text-slate-400">
                        <GraduationCap className="h-3.5 w-3.5" />
                        Program not added
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Bio + links — always shown */}
            <motion.section
              {...fadeUp}
              transition={{ duration: 0.45, delay: 0.04 }}
              className={`${cardShell} p-6 sm:p-8`}
            >
              <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 translate-x-1/4 -translate-y-1/4 rounded-full bg-gradient-to-br from-violet-200/40 to-emerald-100/30 blur-2xl" aria-hidden />

              <p className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">About</p>
              {profile.bio ? (
                <p className="relative mt-3 text-[15px] leading-relaxed text-slate-700">{profile.bio}</p>
              ) : (
                <p className="relative mt-3 text-sm italic text-slate-400">Bio not added</p>
              )}

              <div className="relative mt-6 border-t border-slate-200/70 pt-6">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Links</p>
                <div className="flex flex-wrap gap-3">
                  {profile.linkedin_url ? (
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-sky-200/80 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:bg-sky-100 hover:text-sky-900"
                    >
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-2 text-sm italic text-slate-400">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn not added
                    </span>
                  )}
                  {profile.github_url ? (
                    <a
                      href={profile.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Github className="h-4 w-4" />
                      GitHub
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-2 text-sm italic text-slate-400">
                      <Github className="h-4 w-4" />
                      GitHub not added
                    </span>
                  )}
                  {profile.portfolio_url ? (
                    <a
                      href={profile.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-800 shadow-sm transition hover:bg-violet-100 hover:text-violet-900"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Portfolio
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-2 text-sm italic text-slate-400">
                      <ExternalLink className="h-4 w-4" />
                      Portfolio not added
                    </span>
                  )}
                </div>
              </div>
            </motion.section>

            {/* Skills */}
            <motion.section
              {...fadeUp}
              transition={{ duration: 0.45, delay: 0.08 }}
              className={`${cardShell} p-6 sm:p-8`}
            >
              <div className="pointer-events-none absolute left-0 bottom-0 h-48 w-48 -translate-x-1/3 translate-y-1/3 rounded-full bg-amber-200/20 blur-3xl" aria-hidden />

              <div className="relative mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <Target className="h-3 w-3 text-amber-500" />
                    Skill graph
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    Skills
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-gradient-to-r from-amber-50 to-orange-50/80 px-3.5 py-2 text-xs font-semibold text-amber-950 shadow-sm">
                    <Target className="h-3.5 w-3.5 text-amber-600" />
                    {learn.length} learning
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-gradient-to-r from-emerald-50 to-teal-50/80 px-3.5 py-2 text-xs font-semibold text-emerald-950 shadow-sm">
                    <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
                    {teach.length} teaching
                  </span>
                </div>
              </div>

              <div className="relative grid gap-8 lg:grid-cols-2 lg:gap-10">
                {/* Want to learn */}
                <div>
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-100/80 bg-gradient-to-r from-amber-50/50 to-orange-50/30 px-4 py-3 sm:px-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-900/20">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Want to learn</h3>
                      <p className="text-xs text-slate-500">Skills {displayName.split(" ")[0]} is actively growing</p>
                    </div>
                  </div>

                  {learn.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-amber-200/70 bg-gradient-to-b from-amber-50/40 to-white px-6 py-10 text-center shadow-inner">
                      <BookOpen className="mx-auto h-9 w-9 text-amber-300" strokeWidth={1.5} />
                      <p className="mt-3 text-sm font-medium text-slate-600">Nothing listed yet</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {learn.map((s, i) => (
                        <li
                          key={`${s.name}-${i}`}
                          className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-white to-amber-50/40 p-4 shadow-md shadow-amber-900/[0.06] ring-1 ring-amber-900/[0.04]"
                        >
                          <div className="absolute inset-y-3 left-0 w-1 rounded-full bg-amber-400" aria-hidden />
                          <div className="pl-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                                Learning
                              </span>
                              {s.proficiency_level && (
                                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${proficiencyBadgeClass(s.proficiency_level)}`}>
                                  Goal: {s.proficiency_level}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-base font-bold text-slate-900">{s.name}</p>
                            {s.category && (
                              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                                {s.category}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Can teach */}
                <div>
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-100/80 bg-gradient-to-r from-emerald-50/50 to-teal-50/30 px-4 py-3 sm:px-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/20">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Can teach</h3>
                      <p className="text-xs text-slate-500">Skills {displayName.split(" ")[0]} can help you with</p>
                    </div>
                  </div>

                  {teach.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-emerald-200/70 bg-gradient-to-b from-emerald-50/40 to-white px-6 py-10 text-center shadow-inner">
                      <GraduationCap className="mx-auto h-9 w-9 text-emerald-300" strokeWidth={1.5} />
                      <p className="mt-3 text-sm font-medium text-slate-600">Nothing listed yet</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {teach.map((s, i) => (
                        <li
                          key={`${s.name}-${i}`}
                          className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-md shadow-emerald-900/[0.06] ring-1 ring-emerald-900/[0.04]"
                        >
                          <div className="absolute inset-y-3 left-0 w-1 rounded-full bg-emerald-500" aria-hidden />
                          <div className="pl-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                                Teaching
                              </span>
                              {s.proficiency_level && (
                                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${proficiencyBadgeClass(s.proficiency_level)}`}>
                                  {s.proficiency_level}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-base font-bold text-slate-900">{s.name}</p>
                            {s.category && (
                              <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                                {s.category}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.section>
          </div>
        )}
      </div>
    </div>
  );
}
