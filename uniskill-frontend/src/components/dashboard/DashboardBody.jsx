import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  addMySkill,
  removeMySkill,
  updateMyProfile,
  updateMySkill,
} from "../../utils/api";
import { LEARN_TARGET_LEVEL_OPTIONS, TEACH_PROFICIENCY_OPTIONS } from "./skillConstants";

function skillName(row) {
  const s = row?.skills;
  if (Array.isArray(s)) {
    return s[0]?.name ?? "Skill";
  }
  return s?.name ?? "Skill";
}

function skillCategory(row) {
  const s = row?.skills;
  if (Array.isArray(s)) {
    return s[0]?.category ?? null;
  }
  return s?.category ?? null;
}

function learnGoalLabel(row) {
  const v = row?.proficiency_level;
  if (!v) {
    return null;
  }
  return LEARN_TARGET_LEVEL_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

function emptyDraft() {
  return {
    first_name: "",
    last_name: "",
    bio: "",
  };
}

export default function DashboardBody({ profile, skills, onRefresh }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [modal, setModal] = useState(null);
  const [skillSaving, setSkillSaving] = useState(false);
  const [skillError, setSkillError] = useState("");

  const [teachForm, setTeachForm] = useState({
    skill_name: "",
    proficiency_level: "beginner",
  });
  const [learnForm, setLearnForm] = useState({ skill_name: "", proficiency_level: "beginner" });

  useEffect(() => {
    if (!profile) {
      setDraft(emptyDraft());
      return;
    }
    setDraft({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      bio: profile.bio ?? "",
    });
  }, [profile]);

  const { learning, teaching } = useMemo(() => {
    const L = [];
    const T = [];
    for (const row of skills) {
      if (row.wants_to_learn) {
        L.push(row);
      }
      if (row.can_teach) {
        T.push(row);
      }
    }
    return { learning: L, teaching: T };
  }, [skills]);

  const displayName = useMemo(() => {
    if (!profile) {
      return "Your profile";
    }
    const fn = profile.first_name?.trim();
    const ln = profile.last_name?.trim();
    if (fn && ln) {
      return `${fn} ${ln}`;
    }
    if (fn) {
      return fn;
    }
    return profile.username?.trim() || "Your profile";
  }, [profile]);

  const initials = useMemo(() => {
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
  }, [profile]);

  const saveProfile = useCallback(async () => {
    setProfileError("");
    setSavingProfile(true);
    try {
      await updateMyProfile({
        first_name: draft.first_name.trim() || undefined,
        last_name: draft.last_name.trim() || undefined,
        bio: draft.bio.trim(),
      });
      await onRefresh();
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  }, [draft, onRefresh]);

  const closeModal = useCallback(() => {
    setModal(null);
    setSkillError("");
    setTeachForm({ skill_name: "", proficiency_level: "beginner" });
    setLearnForm({ skill_name: "", proficiency_level: "beginner" });
  }, []);

  const submitTeach = useCallback(async () => {
    setSkillError("");
    if (!teachForm.skill_name.trim()) {
      setSkillError("Skill name is required.");
      return;
    }
    setSkillSaving(true);
    try {
      await addMySkill({
        skill_name: teachForm.skill_name.trim(),
        can_teach: true,
        wants_to_learn: false,
        proficiency_level: teachForm.proficiency_level,
      });
      closeModal();
      await onRefresh();
    } catch (e) {
      setSkillError(e instanceof Error ? e.message : "Could not add skill.");
    } finally {
      setSkillSaving(false);
    }
  }, [closeModal, onRefresh, teachForm]);

  const submitLearn = useCallback(async () => {
    setSkillError("");
    if (!learnForm.skill_name.trim()) {
      setSkillError("Skill name is required.");
      return;
    }
    setSkillSaving(true);
    try {
      await addMySkill({
        skill_name: learnForm.skill_name.trim(),
        can_teach: false,
        wants_to_learn: true,
        proficiency_level: learnForm.proficiency_level,
      });
      closeModal();
      await onRefresh();
    } catch (e) {
      setSkillError(e instanceof Error ? e.message : "Could not add skill.");
    } finally {
      setSkillSaving(false);
    }
  }, [closeModal, learnForm, onRefresh]);

  const handleRemoveSkill = useCallback(
    async (skillId) => {
      if (!window.confirm("Remove this skill from your profile?")) {
        return;
      }
      try {
        await removeMySkill(skillId);
        await onRefresh();
      } catch (e) {
        setSkillError(e instanceof Error ? e.message : "Could not remove.");
      }
    },
    [onRefresh],
  );

  const openEditTeach = useCallback((row) => {
    setSkillError("");
    setTeachForm({
      skill_name: skillName(row),
      proficiency_level: row.proficiency_level || "beginner",
    });
    setModal({ type: "edit-teach", skill_id: row.skill_id });
  }, []);

  const openEditLearn = useCallback((row) => {
    setSkillError("");
    setLearnForm({
      skill_name: skillName(row),
      proficiency_level: row.proficiency_level || "beginner",
    });
    setModal({ type: "edit-learn", skill_id: row.skill_id });
  }, []);

  const submitEditTeach = useCallback(async () => {
    if (!modal?.skill_id) {
      return;
    }
    setSkillError("");
    setSkillSaving(true);
    try {
      await updateMySkill(modal.skill_id, {
        proficiency_level: teachForm.proficiency_level,
      });
      closeModal();
      await onRefresh();
    } catch (e) {
      setSkillError(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setSkillSaving(false);
    }
  }, [closeModal, modal, onRefresh, teachForm]);

  const submitEditLearn = useCallback(async () => {
    if (!modal?.skill_id) {
      return;
    }
    setSkillError("");
    setSkillSaving(true);
    try {
      await updateMySkill(modal.skill_id, {
        proficiency_level: learnForm.proficiency_level,
      });
      closeModal();
      await onRefresh();
    } catch (e) {
      setSkillError(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setSkillSaving(false);
    }
  }, [closeModal, learnForm.proficiency_level, modal, onRefresh]);

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:shadow-md focus:shadow-emerald-500/10 focus:ring-2 focus:ring-emerald-100";

  const cardShell =
    "relative overflow-hidden rounded-[28px] border border-white/30 bg-white/[0.96] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.28)] backdrop-blur-xl";

  return (
    <div className="space-y-10">
      {!profile ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          Your account profile row was not found. Skills below may still load; contact support if this persists.
        </p>
      ) : null}

      {/* Hero — banner + avatar */}
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
            <div className="absolute -inset-1 rounded-[1.35rem] bg-gradient-to-br from-emerald-300 via-white to-sky-200 opacity-90 blur-[2px]" aria-hidden />
            <div className="relative flex h-[5.75rem] w-[5.75rem] items-center justify-center rounded-3xl border-[3px] border-white bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-2xl font-bold tracking-tight text-white shadow-[0_20px_40px_-12px_rgba(15,23,42,0.5)] sm:h-[7.25rem] sm:w-[7.25rem] sm:text-3xl">
              {initials}
            </div>
          </div>
          <div className="min-w-0 flex-1 pb-1 text-center sm:pb-3 sm:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600/90">Your public presence</p>
            <h2 className="mt-1.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-2xl font-bold leading-tight tracking-tight text-transparent sm:text-3xl">
              {displayName}
            </h2>
            {profile?.username ? (
              <p className="mt-1.5 text-sm font-medium text-slate-500">@{profile.username}</p>
            ) : null}
            {profile?.contact_email ? (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                {profile.contact_email}
              </p>
            ) : null}
          </div>
        </div>
      </motion.section>

      {/* Basics + About (before skills) */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.45, delay: 0.04 }}
        className={`${cardShell} p-6 sm:p-8`}
      >
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 translate-x-1/4 -translate-y-1/4 rounded-full bg-gradient-to-br from-violet-200/40 to-emerald-100/30 blur-2xl" aria-hidden />
        <div className="relative mb-8 flex flex-col gap-4 border-b border-slate-200/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-lg shadow-slate-900/25">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 sm:text-xl">Your profile</h3>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-600">
                How you introduce yourself on UniSkill — name and bio (interests, what you want to learn). Email comes from
                your account.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            Visible to peers
          </span>
        </div>

        <div className="relative grid gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Name</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                First name
                <input
                  className={inputClass}
                  value={draft.first_name}
                  onChange={(e) => setDraft((d) => ({ ...d, first_name: e.target.value }))}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Last name
                <input
                  className={inputClass}
                  value={draft.last_name}
                  onChange={(e) => setDraft((d) => ({ ...d, last_name: e.target.value }))}
                />
              </label>
            </div>
          </div>
          <div className="space-y-4 lg:border-l lg:border-slate-200/80 lg:pl-10">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">About you</p>
            <label className="block text-sm font-medium text-slate-700">
              Bio
              <textarea
                rows={6}
                className={`${inputClass} resize-none bg-slate-50/50`}
                placeholder="A short intro: who you are, what you enjoy, and what you’re hoping to learn or find on UniSkill…"
                value={draft.bio}
                onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              />
            </label>
          </div>
        </div>

        {profileError ? <p className="relative mt-6 text-sm text-red-600">{profileError}</p> : null}
        <div className="relative mt-8 flex flex-col gap-3 border-t border-slate-200/70 pt-6 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={savingProfile || !profile}
            onClick={() => void saveProfile()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 transition hover:brightness-105 disabled:opacity-50 sm:w-auto sm:min-w-[200px] sm:px-10"
          >
            {savingProfile ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 opacity-90" />
                Save profile
              </>
            )}
          </button>
        </div>
      </motion.section>

      {skillError ? (
        <p className="rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
          {skillError}
        </p>
      ) : null}

      {/* Skills hub */}
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
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your skills</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              What you want to learn and what you can teach — specific names help classmates find you. Teaching levels set
              expectations before anyone messages you.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-gradient-to-r from-amber-50 to-orange-50/80 px-3.5 py-2 text-xs font-semibold text-amber-950 shadow-sm">
              <Target className="h-3.5 w-3.5 text-amber-600" />
              {learning.length} learning
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-gradient-to-r from-emerald-50 to-teal-50/80 px-3.5 py-2 text-xs font-semibold text-emerald-950 shadow-sm">
              <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
              {teaching.length} teaching
            </span>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-100/80 bg-gradient-to-r from-amber-50/50 to-orange-50/30 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-900/20">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Want to learn</h3>
                  <p className="text-xs text-slate-500">Goals you are actively trying to grow</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModal({ type: "learn" })}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-amber-900/20 transition hover:brightness-105"
              >
                <Plus className="h-4 w-4" /> Add skill
              </button>
            </div>
            <ul className="space-y-4">
              {learning.map((row) => {
                const cat = skillCategory(row);
                const target = learnGoalLabel(row);
                return (
                  <li
                    key={row.skill_id}
                    className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-white to-amber-50/40 p-5 shadow-md shadow-amber-900/[0.06] ring-1 ring-amber-900/[0.04] transition hover:shadow-lg hover:shadow-amber-900/10"
                  >
                    <div className="absolute inset-y-3 left-0 w-1 rounded-full bg-amber-400" aria-hidden />
                    <div className="flex items-start justify-between gap-3 pl-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                            Learning
                          </span>
                          {target ? (
                            <span className="inline-flex rounded-full border border-amber-200/90 bg-white px-2.5 py-0.5 text-xs font-semibold capitalize text-amber-950">
                              Goal: {target}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-dashed border-amber-300/80 bg-amber-50/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800/80">
                              Set goal level
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-lg font-bold leading-tight text-slate-900">{skillName(row)}</p>
                        {cat ? (
                          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{cat}</p>
                        ) : null}
                        <p className="mt-3 text-xs leading-relaxed text-slate-600">
                          Shown on your profile so peers can offer help, study together, or suggest resources.
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEditLearn(row)}
                          className="rounded-xl border border-transparent p-2.5 text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
                          aria-label={`Edit goal level for ${skillName(row)}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemoveSkill(row.skill_id)}
                          className="rounded-xl border border-transparent p-2.5 text-slate-400 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${skillName(row)}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {learning.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-amber-200/70 bg-gradient-to-b from-amber-50/40 to-white px-6 py-10 text-center shadow-inner">
                <BookOpen className="mx-auto h-11 w-11 text-amber-400" strokeWidth={1.5} />
                <p className="mt-4 font-semibold text-slate-800">No learning goals yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                  Add concrete skills or topics — the more specific, the easier it is for others to match with you.
                </p>
                <button
                  type="button"
                  onClick={() => setModal({ type: "learn" })}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  <Plus className="h-4 w-4" /> Add your first skill
                </button>
              </div>
            ) : null}
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100/80 bg-gradient-to-r from-emerald-50/50 to-teal-50/30 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/20">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Can teach</h3>
                  <p className="text-xs text-slate-500">What you feel confident helping others with</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModal({ type: "teach" })}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-900/20 transition hover:brightness-105"
              >
                <Plus className="h-4 w-4" /> Add skill
              </button>
            </div>
            <ul className="space-y-4">
              {teaching.map((row) => {
                const cat = skillCategory(row);
                const level = row.proficiency_level || "—";
                return (
                  <li
                    key={row.skill_id}
                    className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-md shadow-emerald-900/[0.06] ring-1 ring-emerald-900/[0.04] transition hover:shadow-lg hover:shadow-emerald-900/10"
                  >
                    <div className="absolute inset-y-3 left-0 w-1 rounded-full bg-emerald-500" aria-hidden />
                    <div className="flex items-start justify-between gap-3 pl-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                            Teaching
                          </span>
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-700">
                            {level}
                          </span>
                        </div>
                        <p className="mt-2 text-lg font-bold leading-tight text-slate-900">{skillName(row)}</p>
                        {cat ? (
                          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{cat}</p>
                        ) : null}
                        <p className="mt-3 text-xs leading-relaxed text-slate-600">
                          Your level sets expectations. You can change it anytime — edit, or remove and re-add to rename
                          the skill.
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEditTeach(row)}
                          className="rounded-xl border border-transparent p-2.5 text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
                          aria-label={`Edit ${skillName(row)}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemoveSkill(row.skill_id)}
                          className="rounded-xl border border-transparent p-2.5 text-slate-400 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${skillName(row)}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {teaching.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-emerald-200/70 bg-gradient-to-b from-emerald-50/40 to-white px-6 py-10 text-center shadow-inner">
                <GraduationCap className="mx-auto h-11 w-11 text-emerald-400" strokeWidth={1.5} />
                <p className="mt-4 font-semibold text-slate-800">Nothing listed as teachable yet</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                  Add skills you could explain, demo, or mentor on — even if you are still growing, pick the level that
                  reflects what you can offer today.
                </p>
                <button
                  type="button"
                  onClick={() => setModal({ type: "teach" })}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" /> Add something you teach
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </motion.section>

      {/* Modal */}
      {modal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/20 bg-white p-6 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.45)] ring-1 ring-slate-900/5 sm:p-8">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900">
                {modal.type === "teach" && "Add a skill you teach"}
                {modal.type === "learn" && "Add a skill to learn"}
                {modal.type === "edit-teach" && "Edit teaching skill"}
                {modal.type === "edit-learn" && "Edit learning goal level"}
              </h4>
              <button type="button" onClick={closeModal} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {skillError ? <p className="mt-2 text-sm text-red-600">{skillError}</p> : null}

            {(modal.type === "teach" || modal.type === "edit-teach") && (
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-relaxed text-slate-600">
                  Choose a clear skill name and the level that reflects what you can offer today. You can update the level
                  later without changing the name.
                </p>
                {modal.type === "teach" ? (
                  <label className="block text-sm font-medium text-slate-700">
                    Skill name
                    <input
                      className={inputClass}
                      value={teachForm.skill_name}
                      onChange={(e) => setTeachForm((f) => ({ ...f, skill_name: e.target.value }))}
                    />
                  </label>
                ) : (
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">{teachForm.skill_name}</span> (rename by removing and re-adding)
                  </p>
                )}
                <div>
                  <p className="text-sm font-medium text-slate-700">Your level</p>
                  <p className="mt-0.5 text-xs text-slate-500">Pick the level that best matches what you can offer.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {TEACH_PROFICIENCY_OPTIONS.map((o) => {
                      const selected = teachForm.proficiency_level === o.value;
                      return (
                        <motion.button
                          key={o.value}
                          type="button"
                          onClick={() => setTeachForm((f) => ({ ...f, proficiency_level: o.value }))}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`min-w-0 w-full rounded-2xl border-2 px-2.5 py-3 text-left transition ${
                            selected
                              ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-500/10"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`block text-sm font-bold leading-snug ${selected ? "text-emerald-900" : "text-slate-800"}`}
                          >
                            {o.label}
                          </span>
                          <span className="mt-0.5 block text-pretty text-xs leading-snug text-slate-500">
                            {o.hint}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={skillSaving}
                  onClick={() => void (modal.type === "teach" ? submitTeach() : submitEditTeach())}
                  className="mt-2 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {skillSaving ? "Saving…" : modal.type === "teach" ? "Add skill" : "Save changes"}
                </button>
              </div>
            )}

            {modal.type === "learn" && (
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-relaxed text-slate-600">
                  Add anything you want to get better at. Pick the level you are aiming for so peers know how to help.
                </p>
                <label className="block text-sm font-medium text-slate-700">
                  Skill name
                  <input
                    className={inputClass}
                    value={learnForm.skill_name}
                    onChange={(e) => setLearnForm((f) => ({ ...f, skill_name: e.target.value }))}
                  />
                </label>
                <div>
                  <p className="text-sm font-medium text-slate-700">Goal level</p>
                  <p className="mt-0.5 text-xs text-slate-500">Where you want to get with this skill.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {LEARN_TARGET_LEVEL_OPTIONS.map((o) => {
                      const selected = learnForm.proficiency_level === o.value;
                      return (
                        <motion.button
                          key={o.value}
                          type="button"
                          onClick={() => setLearnForm((f) => ({ ...f, proficiency_level: o.value }))}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`min-w-0 w-full rounded-2xl border-2 px-2.5 py-3 text-left transition ${
                            selected
                              ? "border-amber-500 bg-amber-50 shadow-md shadow-amber-500/10"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`block text-sm font-bold leading-snug ${selected ? "text-amber-950" : "text-slate-800"}`}
                          >
                            {o.label}
                          </span>
                          <span className="mt-0.5 block text-pretty text-xs leading-snug text-slate-500">{o.hint}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={skillSaving}
                  onClick={() => void submitLearn()}
                  className="mt-2 w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {skillSaving ? "Saving…" : "Add goal"}
                </button>
              </div>
            )}

            {modal.type === "edit-learn" && (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">{learnForm.skill_name}</span>
                  <span className="text-slate-500"> — rename by removing and re-adding</span>
                </p>
                <div>
                  <p className="text-sm font-medium text-slate-700">Goal level</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {LEARN_TARGET_LEVEL_OPTIONS.map((o) => {
                      const selected = learnForm.proficiency_level === o.value;
                      return (
                        <motion.button
                          key={o.value}
                          type="button"
                          onClick={() => setLearnForm((f) => ({ ...f, proficiency_level: o.value }))}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`min-w-0 w-full rounded-2xl border-2 px-2.5 py-3 text-left transition ${
                            selected
                              ? "border-amber-500 bg-amber-50 shadow-md shadow-amber-500/10"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`block text-sm font-bold leading-snug ${selected ? "text-amber-950" : "text-slate-800"}`}
                          >
                            {o.label}
                          </span>
                          <span className="mt-0.5 block text-pretty text-xs leading-snug text-slate-500">{o.hint}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={skillSaving}
                  onClick={() => void submitEditLearn()}
                  className="mt-2 w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {skillSaving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
