import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Loader2, Search, Target } from "lucide-react";
import { getRecommendations, searchProfiles } from "../../utils/api";

function fullName(rec) {
  const user = rec?.user;
  const fn = user?.first_name?.trim();
  const ln = user?.last_name?.trim();
  if (fn && ln) {
    return `${fn} ${ln}`;
  }
  return fn || user?.username || "Unnamed user";
}

function tierMeta(tier) {
  if (tier === "mutual_exchange") {
    return {
      label: "Mutual exchange",
      className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
    };
  }
  return {
    label: "One-way learning",
    className: "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
  };
}

export default function HomeTab() {
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadRecommendations() {
      setLoading(true);
      setError("");
      try {
        const rows = await getRecommendations();
        if (!cancelled) {
          setRecommendations(Array.isArray(rows) ? rows : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load recommendations.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= 2;

  useEffect(() => {
    if (!isSearching) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const rows = await searchProfiles(trimmedQuery, 20);
        if (!cancelled) {
          setSearchResults(Array.isArray(rows) ? rows : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not search users.");
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isSearching, trimmedQuery]);

  const activeCount = isSearching ? searchResults.length : recommendations.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="search"
          placeholder="Search all users by name or skill (min 2 chars)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-white placeholder:text-slate-500 backdrop-blur-sm outline-none transition focus:border-emerald-500/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {loading && !isSearching ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          Loading recommendations...
        </div>
      ) : isSearching && searchLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          Searching users...
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-300">
            {isSearching
              ? `Showing ${activeCount} users for "${trimmedQuery}"`
              : `Showing ${activeCount} recommendations`}
          </p>

          {activeCount === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-300">
              {isSearching
                ? "No users matched your search. Try another name or skill."
                : "No recommendations yet. Add more learning/teaching skills and try again."}
            </p>
          ) : isSearching ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {searchResults.map((user) => {
                const teach = Array.isArray(user?.teach_skills) ? user.teach_skills : [];
                const learn = Array.isArray(user?.learn_skills) ? user.learn_skills : [];
                return (
                  <li
                    key={user.id || user.username}
                    className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 text-slate-100 shadow-lg shadow-black/10"
                  >
                    <p className="text-lg font-semibold">
                      {`${user?.first_name?.trim() || ""} ${user?.last_name?.trim() || ""}`.trim() || user?.username || "Unnamed user"}
                    </p>
                    <p className="text-xs text-slate-400">@{user?.username || "unknown"}</p>
                    {user?.bio ? <p className="mt-3 text-sm text-slate-300">{user.bio}</p> : null}

                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                          <GraduationCap className="h-3.5 w-3.5" />
                          Can teach
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {teach.length === 0 ? (
                            <span className="text-xs text-slate-400">Nothing listed</span>
                          ) : (
                            teach.map((s) => (
                              <span
                                key={`${user.id}-teach-${s.name}`}
                                className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100"
                              >
                                {s.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
                          <Target className="h-3.5 w-3.5" />
                          Wants to learn
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {learn.length === 0 ? (
                            <span className="text-xs text-slate-400">Nothing listed</span>
                          ) : (
                            learn.map((s) => (
                              <span
                                key={`${user.id}-learn-${s.name}`}
                                className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100"
                              >
                                {s.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {recommendations.map((rec) => {
                const user = rec?.user || {};
                const teachMatches = Array.isArray(rec?.teach_matches) ? rec.teach_matches : [];
                const reciprocalMatches = Array.isArray(rec?.reciprocal_matches) ? rec.reciprocal_matches : [];
                const meta = tierMeta(rec?.recommendation_tier);
                return (
                  <li
                    key={user.id || `${user.username || "user"}-${rec.recommendation_tier}`}
                    className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 text-slate-100 shadow-lg shadow-black/10"
                  >
                    <div
                      className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${meta.className}`}
                    >
                      {meta.label}
                    </div>
                    <p className="text-lg font-semibold">{fullName(rec)}</p>
                    <p className="text-xs text-slate-400">@{user.username || "unknown"}</p>
                    {user.bio ? <p className="mt-3 text-sm text-slate-300">{user.bio}</p> : null}

                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                          <GraduationCap className="h-3.5 w-3.5" />
                          Can teach you
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {teachMatches.length === 0 ? (
                            <span className="text-xs text-slate-400">Nothing listed</span>
                          ) : (
                            teachMatches.map((m) => (
                              <span
                                key={`${user.id}-teach-${m.skill_name}`}
                                className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100"
                              >
                                {m.skill_name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
                          <Target className="h-3.5 w-3.5" />
                          Wants to learn from you
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {reciprocalMatches.length === 0 ? (
                            <span className="text-xs text-slate-400">Nothing listed</span>
                          ) : (
                            reciprocalMatches.map((m) => (
                              <span
                                key={`${user.id}-learn-${m.skill_name}`}
                                className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100"
                              >
                                {m.skill_name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </motion.div>
  );
}
