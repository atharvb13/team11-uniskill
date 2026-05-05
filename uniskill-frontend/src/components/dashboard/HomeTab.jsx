import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Loader2, Search, Target } from "lucide-react";
import { discoverProfiles } from "../../utils/api";

function fullName(user) {
  const fn = user?.first_name?.trim();
  const ln = user?.last_name?.trim();
  if (fn && ln) {
    return `${fn} ${ln}`;
  }
  return fn || user?.username || "Unnamed user";
}

function skillsToText(skills) {
  if (!Array.isArray(skills)) {
    return "";
  }
  return skills
    .map((s) => s?.name)
    .filter(Boolean)
    .join(" ");
}

export default function HomeTab() {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadProfiles() {
      setLoading(true);
      setError("");
      try {
        const rows = await discoverProfiles();
        if (!cancelled) {
          setProfiles(Array.isArray(rows) ? rows : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load people.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return profiles;
    }
    return profiles.filter((user) => {
      const nameText = `${fullName(user)} ${user?.username || ""}`.toLowerCase();
      const teachText = skillsToText(user?.teach_skills).toLowerCase();
      const learnText = skillsToText(user?.learn_skills).toLowerCase();
      return nameText.includes(q) || teachText.includes(q) || learnText.includes(q);
    });
  }, [profiles, query]);

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
          placeholder="Search skills, people, topics…"
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

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          Loading students...
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-300">
            Showing {filteredProfiles.length} of {profiles.length} students
          </p>

          {filteredProfiles.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-300">
              No matches yet. Try a different name or skill.
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {filteredProfiles.map((user) => {
                const teach = Array.isArray(user?.teach_skills) ? user.teach_skills : [];
                const learn = Array.isArray(user?.learn_skills) ? user.learn_skills : [];
                return (
                  <li
                    key={user.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 text-slate-100 shadow-lg shadow-black/10"
                  >
                    <p className="text-lg font-semibold">{fullName(user)}</p>
                    <p className="text-xs text-slate-400">@{user.username || "unknown"}</p>
                    {user.bio ? <p className="mt-3 text-sm text-slate-300">{user.bio}</p> : null}

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
          )}
        </>
      )}
    </motion.div>
  );
}
