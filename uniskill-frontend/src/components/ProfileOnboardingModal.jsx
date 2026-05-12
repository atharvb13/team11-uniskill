import React, { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
  UserCircle,
} from "lucide-react";
import { addMySkill, updateMyProfile } from "../utils/api";
import { LEARN_TARGET_LEVEL_OPTIONS, TEACH_PROFICIENCY_OPTIONS } from "./dashboard/skillConstants";

const STEPS = [
  {
    id: 1,
    short: "Learn",
    title: "What do you want to learn?",
    subtitle: "Drop in anything you’re curious about — courses, hobbies, tools, languages.",
    icon: Target,
    accent: "from-amber-400/90 to-orange-500",
  },
  {
    id: 2,
    short: "Teach",
    title: "What can you teach others?",
    subtitle: "Share what you’re confident explaining. Honest levels help good matches.",
    icon: GraduationCap,
    accent: "from-emerald-400/90 to-teal-600",
  },
  {
    id: 3,
    short: "Bio",
    title: "Tell people about you",
    subtitle: "Totally optional — a few lines make your profile feel human.",
    icon: UserCircle,
    accent: "from-sky-400/90 to-indigo-600",
  },
];

const spring = { type: "spring", stiffness: 380, damping: 32 };

function normalizeSkillEntries(learnRows, teachRows) {
  const out = [];
  for (const row of learnRows) {
    const name = row.name.trim();
    if (!name) {
      continue;
    }
    out.push({
      skill_name: name,
      wants_to_learn: true,
      can_teach: false,
      proficiency_level: row.level ?? "beginner",
    });
  }
  for (const row of teachRows) {
    const name = row.name.trim();
    if (!name) {
      continue;
    }
    out.push({
      skill_name: name,
      wants_to_learn: false,
      can_teach: true,
      proficiency_level: row.level,
    });
  }
  return out;
}

export default function ProfileOnboardingModal({ onComplete }) {
  const [step, setStep] = useState(1);
  const [learnRows, setLearnRows] = useState([{ id: crypto.randomUUID(), name: "", level: "beginner" }]);
  const [teachRows, setTeachRows] = useState([{ id: crypto.randomUUID(), name: "", level: "beginner" }]);
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stepMeta = useMemo(() => STEPS.find((s) => s.id === step) ?? STEPS[0], [step]);
  const StepIcon = stepMeta.icon;

  const addLearnRow = useCallback(() => {
    setLearnRows((prev) => [...prev, { id: crypto.randomUUID(), name: "", level: "beginner" }]);
  }, []);

  const updateLearnRow = useCallback((id, patch) => {
    setLearnRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const removeLearnRow = useCallback((id) => {
    setLearnRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }, []);

  const addTeachRow = useCallback(() => {
    setTeachRows((prev) => [...prev, { id: crypto.randomUUID(), name: "", level: "beginner" }]);
  }, []);

  const updateTeachRow = useCallback((id, patch) => {
    setTeachRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const removeTeachRow = useCallback((id) => {
    setTeachRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }, []);

  const validateStep = useCallback(
    (n) => {
      if (n === 1) {
        const filled = learnRows.filter((r) => r.name.trim());
        if (filled.length === 0) {
          return "Add at least one skill you want to learn.";
        }
        const learnKeys = filled.map((r) => r.name.trim().toLowerCase());
        if (new Set(learnKeys).size !== learnKeys.length) {
          return "Each skill to learn must be unique — remove or rename a duplicate row.";
        }
        const missingLearnLevel = filled.some((r) => !r.level);
        if (missingLearnLevel) {
          return "Pick a goal level for each skill you want to learn.";
        }
      }
      if (n === 2) {
        const filled = teachRows.filter((r) => r.name.trim());
        if (filled.length === 0) {
          return "Add at least one skill you can teach.";
        }
        const teachKeys = filled.map((r) => r.name.trim().toLowerCase());
        if (new Set(teachKeys).size !== teachKeys.length) {
          return "Each skill you teach must be unique — remove or rename a duplicate row.";
        }
        const missingLevel = filled.some((r) => !r.level);
        if (missingLevel) {
          return "Pick a level for each teaching skill.";
        }
        const learnNames = new Set(
          learnRows.filter((r) => r.name.trim()).map((r) => r.name.trim().toLowerCase()),
        );
        for (const r of filled) {
          const key = r.name.trim().toLowerCase();
          if (learnNames.has(key)) {
            return `“${r.name.trim()}” is already a skill to learn — use a different name for teaching or remove it from learn.`;
          }
        }
      }
      return "";
    },
    [learnRows, teachRows],
  );

  const goNext = useCallback(() => {
    setError("");
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }, [step, validateStep]);

  const goBack = useCallback(() => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const handleSubmit = useCallback(async () => {
    setError("");
    const e1 = validateStep(1);
    const e2 = validateStep(2);
    if (e1 || e2) {
      setError(e1 || e2);
      setStep(e1 ? 1 : 2);
      return;
    }

    const learnFilled = learnRows.filter((r) => r.name.trim());
    const teachFilled = teachRows.filter((r) => r.name.trim());
    const entries = normalizeSkillEntries(learnFilled, teachFilled);

    setSubmitting(true);
    try {
      if (bio.trim()) {
        await updateMyProfile({ bio: bio.trim() });
      }
      for (const e of entries) {
        await addMySkill({
          skill_name: e.skill_name,
          wants_to_learn: e.wants_to_learn,
          can_teach: e.can_teach,
          proficiency_level: e.proficiency_level,
        });
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [bio, learnRows, onComplete, teachRows, validateStep]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" aria-hidden />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        initial={{ opacity: 0, scale: 0.94, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={spring}
        className="relative z-10 flex max-h-[min(92vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-[0_32px_120px_-24px_rgba(15,23,42,0.45)] lg:flex-row"
      >
        {/* Left panel — story + step rail (below form on small screens) */}
        <div className="relative order-2 flex shrink-0 flex-col justify-between overflow-hidden bg-slate-950 p-6 text-white sm:p-8 lg:order-1 lg:w-[42%] lg:max-w-md lg:rounded-l-[32px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_20%_-20%,rgba(16,185,129,0.35),transparent),radial-gradient(ellipse_80%_60%_at_100%_100%,rgba(56,189,248,0.2),transparent)]" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-emerald-200 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome to UniSkill
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="mt-8"
              >
                <div
                  className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${stepMeta.accent} shadow-lg shadow-black/20`}
                >
                  <StepIcon className="h-8 w-8 text-white drop-shadow-sm" strokeWidth={1.75} />
                </div>
                <h2 id="onboarding-title" className="mt-6 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                  {stepMeta.title}
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300 sm:text-base">{stepMeta.subtitle}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Step rail */}
          <nav className="relative mt-10 flex gap-2 lg:mt-14 lg:flex-col lg:gap-3" aria-label="Onboarding steps">
            {STEPS.map((s) => {
              const done = step > s.id;
              const active = step === s.id;
              const Icon = s.icon;
              return (
                <motion.button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (s.id < step) {
                      setError("");
                      setStep(s.id);
                    }
                  }}
                  disabled={s.id >= step}
                  whileHover={s.id < step ? { x: 4 } : undefined}
                  whileTap={s.id < step ? { scale: 0.98 } : undefined}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors lg:py-3 ${
                    active
                      ? "bg-white/15 ring-1 ring-white/25"
                      : done
                        ? "cursor-pointer bg-white/5 hover:bg-white/10"
                        : "cursor-default opacity-40"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      active || done ? "bg-emerald-500/30 text-emerald-200" : "bg-white/5 text-slate-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Step {s.id}
                    </span>
                    <span className="block truncate text-sm font-semibold">{s.short}</span>
                  </span>
                  {done ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-300">
                      ✓
                    </motion.span>
                  ) : null}
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Right panel — form (first on small screens) */}
        <div className="order-1 flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50/80 lg:order-2">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <LayoutGroup>
              {/*
                AnimatePresence must have exactly one direct child. Key the wrapper by step so
                enter/exit run reliably (nested ternary motion siblings can leave step 2 blank).
              */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={spring}
                  className={step === 3 ? "space-y-5" : "space-y-6"}
                >
                  {step === 1 ? (
                    <div className="contents">
                      <p className="text-sm text-slate-600">
                        Start with one skill name below. Use <strong className="text-slate-800">Add skill to learn</strong> if
                        you want to list more.
                      </p>

                      <div className="space-y-4">
                        {learnRows.map((row, index) => (
                          <motion.div
                            key={row.id}
                            layout
                            className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/5"
                          >
                            <div className="mb-3 flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-800">Skill to learn {index + 1}</span>
                              {learnRows.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => removeLearnRow(row.id)}
                                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Remove row"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                            <div className="relative">
                              <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => updateLearnRow(row.id, { name: e.target.value })}
                                placeholder="Skill name"
                                className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50/50 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:bg-white"
                              />
                            </div>
                            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Goal level
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {LEARN_TARGET_LEVEL_OPTIONS.map((o) => {
                                const selected = row.level === o.value;
                                return (
                                  <motion.button
                                    key={o.value}
                                    type="button"
                                    onClick={() => updateLearnRow(row.id, { level: o.value })}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`min-w-0 rounded-xl border-2 px-2 py-2.5 text-left text-xs transition ${
                                      selected
                                        ? "border-amber-500 bg-amber-50 shadow-sm"
                                        : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                                    }`}
                                  >
                                    <span className={`font-bold ${selected ? "text-amber-950" : "text-slate-800"}`}>
                                      {o.label}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{o.hint}</span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      <motion.button
                        type="button"
                        onClick={addLearnRow}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-3 text-sm font-semibold text-slate-600 hover:border-emerald-400 hover:bg-emerald-50/30"
                      >
                        <Plus className="h-5 w-5" />
                        Add skill to learn
                      </motion.button>
                    </div>
                  ) : step === 2 ? (
                    <div className="contents">
                      <p className="text-sm text-slate-600">
                        For each skill, choose how strong you are — this keeps expectations clear for people who reach out.
                        Levels run from <strong className="font-semibold text-slate-800">beginner</strong> through{" "}
                        <strong className="font-semibold text-slate-800">expert</strong>.
                      </p>
                      <div className="space-y-5">
                        {teachRows.map((row, index) => (
                          <motion.div
                            key={row.id}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, ...spring }}
                            className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 transition-shadow hover:shadow-md"
                          >
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <label className="text-sm font-semibold text-slate-800">Skill {index + 1}</label>
                              {teachRows.length > 1 ? (
                                <motion.button
                                  type="button"
                                  onClick={() => removeTeachRow(row.id)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                  aria-label="Remove skill"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </motion.button>
                              ) : null}
                            </div>
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => updateTeachRow(row.id, { name: e.target.value })}
                              placeholder="e.g. React, Calculus, Portrait drawing"
                              className="mb-5 h-12 w-full rounded-xl border-2 border-slate-200 bg-slate-50/50 px-4 text-base outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100/80"
                            />
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Your level</p>
                            <div className="grid grid-cols-2 gap-2">
                              {TEACH_PROFICIENCY_OPTIONS.map((o) => {
                                const selected = row.level === o.value;
                                return (
                                  <motion.button
                                    key={o.value}
                                    type="button"
                                    onClick={() => updateTeachRow(row.id, { level: o.value })}
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
                          </motion.div>
                        ))}
                      </div>

                      <motion.button
                        type="button"
                        onClick={addTeachRow}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-4 text-sm font-semibold text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50/30 hover:text-emerald-800"
                      >
                        <Plus className="h-5 w-5" />
                        Add another skill
                      </motion.button>
                    </div>
                  ) : (
                    <div className="contents">
                      <div className="relative">
                        <label className="mb-3 block text-sm font-semibold text-slate-800">About you</label>
                        <UserCircle className="pointer-events-none absolute left-4 top-[52px] h-5 w-5 text-slate-400" />
                        <textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Clubs, majors, what you’re hoping to find on UniSkill, favorite side projects…"
                          rows={8}
                          className="w-full resize-none rounded-3xl border-2 border-slate-200 bg-white py-4 pl-12 pr-4 text-base leading-relaxed text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/80"
                        />
                        <p className="mt-2 text-right text-xs text-slate-400">{bio.length} characters</p>
                      </div>
                      <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
                        <strong className="font-semibold">Optional.</strong> You can leave this blank and still finish — you
                        can always add more from your profile later.
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </LayoutGroup>

            <AnimatePresence>
              {error ? (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 bg-white px-5 py-5 sm:px-8 lg:px-10">
            <motion.button
              type="button"
              onClick={goBack}
              disabled={step === 1 || submitting}
              whileHover={step === 1 || submitting ? undefined : { x: -2 }}
              whileTap={step === 1 || submitting ? undefined : { scale: 0.98 }}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft className="h-5 w-5" />
              Back
            </motion.button>

            {step < 3 ? (
              <motion.button
                type="button"
                onClick={goNext}
                disabled={submitting}
                whileHover={submitting ? undefined : { scale: 1.02, x: 2 }}
                whileTap={submitting ? undefined : { scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 disabled:opacity-60"
              >
                Continue
                <ChevronRight className="h-5 w-5" />
              </motion.button>
            ) : (
              <motion.button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                whileHover={submitting ? undefined : { scale: 1.02 }}
                whileTap={submitting ? undefined : { scale: 0.98 }}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-slate-900/20 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Finish setup
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
