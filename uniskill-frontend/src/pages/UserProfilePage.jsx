import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Github,
  GraduationCap,
  Home,
  ImageIcon,
  Linkedin,
  Loader2,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  MessageSquare,
  Paperclip,
  Pencil,
  UserPlus,
  UserX,
  Video,
  X,
} from "lucide-react";
import { getConnectionStatus, getMyProfile, getPublicProfile, getWorkSamples, sendConnectionRequest, upsertTeachingReview } from "../utils/api";
import { hasActiveSession } from "../utils/session";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const cardShell =
  "relative overflow-hidden rounded-[28px] border border-white/30 bg-white/[0.96] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.28)] backdrop-blur-xl";

function StarRating({ value, label, size = "md" }) {
  const n = Math.round(Number(value) || 0);
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-[1.15rem] w-[1.15rem]";
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <span className="inline-flex items-center gap-0.5 text-amber-400" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`${iconClass} ${i <= n ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
            strokeWidth={i <= n ? 0 : 1.4}
          />
        ))}
      </span>
      {label ? (
        <span className="sr-only">{label}</span>
      ) : null}
    </span>
  );
}

function reviewerLabel(r) {
  const fn = r?.first_name?.trim();
  const ln = r?.last_name?.trim();
  if (fn && ln) {
    return `${fn} ${ln}`;
  }
  if (fn) {
    return fn;
  }
  if (r?.username) {
    return `@${r.username}`;
  }
  return "Member";
}

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
  const [me, setMe] = useState(null);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewDeleting, setReviewDeleting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  // Work samples modal state
  const [samplesModal, setSamplesModal] = useState(null); // { skillName, userSkillId }
  const [modalSamples, setModalSamples] = useState([]);
  const [modalSamplesLoading, setModalSamplesLoading] = useState(false);
  const [modalSamplesError, setModalSamplesError] = useState("");

  // Connection state
  const [connStatus, setConnStatus] = useState("none"); // 'none' | 'pending' | 'accepted' | 'self'
  const [connLoading, setConnLoading] = useState(false);

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

  useEffect(() => {
    if (!hasActiveSession()) {
      setMe(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const row = await getMyProfile();
        if (!cancelled) setMe(row);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  // Load connection status when we have both the viewer and the profile
  useEffect(() => {
    const targetId = profile?.profile_user_id;
    if (!targetId || !me || !hasActiveSession()) {
      setConnStatus("none");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await getConnectionStatus(targetId);
        if (!cancelled) setConnStatus(res?.status ?? "none");
      } catch {
        if (!cancelled) setConnStatus("none");
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.profile_user_id, me]);

  useEffect(() => {
    const mr = profile?.teaching_reviews?.my_review;
    if (mr) {
      setReviewRating(Number(mr.rating) || 5);
      setReviewBody(typeof mr.body === "string" ? mr.body : "");
    } else {
      setReviewRating(5);
      setReviewBody("");
    }
    setReviewError("");
    setReviewSuccess("");
  }, [profile?.teaching_reviews?.my_review, profile?.username]);

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

  const reviewsBlock = profile?.teaching_reviews;
  const reviewItems = Array.isArray(reviewsBlock?.items) ? reviewsBlock.items : [];
  const isOwnProfile =
    Boolean(me?.username &&
    profile?.username &&
    String(me.username).toLowerCase() === String(profile.username).toLowerCase());
  const reviewAudience =
    hasActiveSession() && Boolean(me) && Boolean(profile) && !isOwnProfile && teach.length > 0;
  const reviewGatingActive =
    reviewsBlock != null && Object.prototype.hasOwnProperty.call(reviewsBlock, "eligible_to_review");
  const canUseReviewForm =
    reviewAudience && (!reviewGatingActive || Boolean(reviewsBlock?.eligible_to_review));
  const showLegacyMyReview =
    reviewAudience &&
    Boolean(reviewsBlock?.my_review) &&
    reviewGatingActive &&
    !reviewsBlock?.eligible_to_review;

  async function handleConnect() {
    const targetId = profile?.profile_user_id;
    if (!targetId || connLoading) return;
    setConnLoading(true);
    try {
      await sendConnectionRequest(targetId);
      setConnStatus("pending");
    } catch {
      // silently ignore duplicate-request errors; re-fetch actual status
      try {
        const res = await getConnectionStatus(targetId);
        setConnStatus(res?.status ?? "none");
      } catch { /* ignore */ }
    } finally {
      setConnLoading(false);
    }
  }

  function openSamplesModal(skillName, userSkillId) {
    setSamplesModal({ skillName, userSkillId });
    setModalSamples([]);
    setModalSamplesError("");
    setModalSamplesLoading(true);
    getWorkSamples(userSkillId)
      .then((rows) => setModalSamples(rows || []))
      .catch(() => setModalSamplesError("Could not load work samples."))
      .finally(() => setModalSamplesLoading(false));
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!profile?.username) return;
    setReviewError("");
    setReviewSuccess("");
    setReviewSaving(true);
    try {
      await upsertTeachingReview({
        teacherUsername: profile.username,
        rating: reviewRating,
        body: reviewBody.trim(),
      });
      setReviewSuccess("Your review was saved.");
      const data = await getPublicProfile(username);
      setProfile(data);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not save review.");
    } finally {
      setReviewSaving(false);
    }
  }

  async function handleReviewDelete() {
    const id = reviewsBlock?.my_review?.id;
    if (!id) return;
    if (!window.confirm("Delete your review permanently? You can post a new one after a completed meeting.")) {
      return;
    }
    setReviewError("");
    setReviewSuccess("");
    setReviewDeleting(true);
    try {
      await deleteTeachingReview(String(id));
      setReviewSuccess("Your review was removed.");
      const data = await getPublicProfile(username);
      setProfile(data);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not delete review.");
    } finally {
      setReviewDeleting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-900">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(16,185,129,0.22),transparent),radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(56,189,248,0.12),transparent),radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(167,139,250,0.1),transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        {/* Header — matches DashboardPage navbar */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-10 flex items-center justify-between"
        >
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-900/40">
              <Sparkles className="h-[15px] w-[15px] text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-white">UniSkill</span>
          </div>

          {/* Nav tabs — navigate back to dashboard at the right tab */}
          <nav className="flex items-center gap-6 sm:gap-8" aria-label="Dashboard navigation">
            {[
              { id: "home", label: "Home", icon: Home },
              { id: "chat", label: "Chat", icon: MessageSquare },
              { id: "schedule", label: "Schedule", icon: Calendar },
              { id: "profile", label: "Profile", icon: isOwnProfile ? Pencil : GraduationCap },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => navigate("/dashboard", { state: { tab: id } })}
                className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:text-white"
              >
                <Icon className="h-[14px] w-[14px] text-slate-500" strokeWidth={2.2} />
                {label}
              </button>
            ))}
          </nav>

          {/* Right action */}
          {isOwnProfile ? (
            <button
              type="button"
              onClick={() => navigate("/dashboard", { state: { tab: "profile" } })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2 text-[13px] font-medium text-emerald-300 backdrop-blur-sm transition hover:bg-emerald-500/20 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit profile
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-[13px] font-medium text-slate-300 backdrop-blur-sm transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
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
                    {typeof reviewsBlock?.average_rating === "number" && reviewsBlock.count > 0 ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-amber-50/95 px-3 py-1 text-xs font-semibold text-amber-950 shadow-sm">
                        <StarRating value={reviewsBlock.average_rating} label={`Average ${reviewsBlock.average_rating} out of 5`} />
                        <span className="text-amber-900/90">{reviewsBlock.average_rating}</span>
                        <span className="font-normal text-amber-800/75">({reviewsBlock.count})</span>
                      </span>
                    ) : null}
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

                  {/* Connect button — only for other users' profiles */}
                  {!isOwnProfile && hasActiveSession() && me && (
                    <div className="mt-4">
                      {connStatus === "accepted" ? (
                        <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
                          <Check className="h-4 w-4" />
                          Connected
                        </span>
                      ) : connStatus === "pending" ? (
                        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                          <Clock className="h-4 w-4" />
                          Requested
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={connLoading}
                          onClick={() => void handleConnect()}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition hover:brightness-105 disabled:opacity-50"
                        >
                          {connLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserPlus className="h-4 w-4" />
                          )}
                          Connect
                        </button>
                      )}
                    </div>
                  )}
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
                            {s.user_skill_id && (
                              <button
                                type="button"
                                onClick={() => openSamplesModal(s.name, s.user_skill_id)}
                                className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                                View work samples
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.section>

            {/* Teaching reviews */}
            <motion.section
              {...fadeUp}
              transition={{ duration: 0.45, delay: 0.1 }}
              className={`${cardShell} p-6 sm:p-8`}
            >
              <div className="pointer-events-none absolute right-6 top-6 h-32 w-32 rounded-full bg-amber-200/25 blur-2xl" aria-hidden />

              <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900/80">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                    Teaching reviews
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">What learners say</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {teach.length === 0
                      ? "This member has not added teaching skills yet — reviews apply to people who offer to teach."
                      : "Ratings are out of 5 stars. New reviews require a completed UniSkill meeting (not cancelled). Reviews marked “Verified session” were saved under that rule."}
                  </p>
                </div>
                {typeof reviewsBlock?.average_rating === "number" && reviewsBlock.count > 0 ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50/80 to-white px-4 py-3 shadow-sm">
                    <StarRating value={reviewsBlock.average_rating} label={`Average ${reviewsBlock.average_rating} of 5`} />
                    <div>
                      <p className="text-lg font-bold text-slate-900">{reviewsBlock.average_rating} / 5</p>
                      <p className="text-xs text-slate-500">{reviewsBlock.count} review{reviewsBlock.count === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                ) : teach.length > 0 ? (
                  <p className="text-sm font-medium text-slate-500">No reviews yet.</p>
                ) : null}
              </div>

              {reviewItems.length > 0 ? (
                <ul className="relative space-y-4">
                  {reviewItems.map((rev) => (
                    <li
                      key={rev.id}
                      className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm ring-1 ring-slate-900/[0.03]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{reviewerLabel(rev.reviewer)}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {rev.session_verified ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900"
                              title="Learner had a completed meeting with this teacher on UniSkill"
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                              Verified session
                            </span>
                          ) : null}
                          <StarRating value={rev.rating} size="sm" label={`${rev.rating} stars`} />
                        </div>
                      </div>
                      <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{rev.body}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {rev.created_at
                          ? new Date(rev.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : null}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : teach.length > 0 ? (
                <p className="relative rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                  Be the first to share feedback once you’ve learned with this person.
                </p>
              ) : (
                <p className="relative rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                  Teaching reviews appear after this member marks skills they can teach.
                </p>
              )}

              {canUseReviewForm ? (
                <form className="relative mt-8 border-t border-slate-200/80 pt-6" onSubmit={(e) => void handleReviewSubmit(e)}>
                  <p className="text-sm font-bold text-slate-900">{reviewsBlock?.my_review ? "Update your review" : "Write a review"}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Only you can edit your review. Posting or updating marks it as a verified session because you have a
                    completed meeting with this person.
                  </p>

                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rating</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setReviewRating(n)}
                          aria-pressed={reviewRating === n}
                          className={`rounded-lg p-1.5 transition ${reviewRating === n ? "bg-amber-100 ring-2 ring-amber-400" : "hover:bg-slate-100"}`}
                          aria-label={`${n} star${n === 1 ? "" : "s"}`}
                        >
                          <Star
                            className={`h-8 w-8 ${n <= reviewRating ? "fill-amber-400 text-amber-500" : "text-slate-300"}`}
                            strokeWidth={n <= reviewRating ? 0 : 1.4}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Your feedback
                    <textarea
                      value={reviewBody}
                      onChange={(e) => setReviewBody(e.target.value)}
                      rows={4}
                      minLength={3}
                      maxLength={4000}
                      required
                      placeholder="Share what stood out — clarity, pacing, usefulness…"
                      className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    />
                  </label>

                  {reviewError ? (
                    <p className="mt-2 text-sm text-red-600">{reviewError}</p>
                  ) : null}
                  {reviewSuccess ? (
                    <p className="mt-2 text-sm text-emerald-700">{reviewSuccess}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {reviewsBlock?.my_review?.id ? (
                      <button
                        type="button"
                        onClick={() => void handleReviewDelete()}
                        disabled={reviewDeleting || reviewSaving}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        {reviewDeleting ? "Deleting…" : "Delete review"}
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="submit"
                      disabled={reviewSaving || reviewBody.trim().length < 3}
                      className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reviewSaving ? "Saving…" : reviewsBlock?.my_review ? "Update review" : "Post review"}
                    </button>
                  </div>
                </form>
              ) : null}

              {showLegacyMyReview ? (
                <div className="relative mt-8 border-t border-slate-200/80 pt-6">
                  <p className="text-sm font-bold text-slate-900">Your review (legacy)</p>
                  <p className="mt-1 text-xs text-slate-500">
                    This entry is not tied to a verified meeting record. Complete a UniSkill meeting with this person to
                    post an updated verified review, or remove this one.
                  </p>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700">
                    <StarRating value={reviewsBlock.my_review.rating} size="sm" label={`${reviewsBlock.my_review.rating} stars`} />
                    <p className="mt-2 whitespace-pre-wrap">{reviewsBlock.my_review.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleReviewDelete()}
                    disabled={reviewDeleting}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {reviewDeleting ? "Deleting…" : "Delete my review"}
                  </button>
                  {reviewError ? <p className="mt-2 text-sm text-red-600">{reviewError}</p> : null}
                  {reviewSuccess ? <p className="mt-2 text-sm text-emerald-700">{reviewSuccess}</p> : null}
                </div>
              ) : null}

              {reviewAudience && !canUseReviewForm && !showLegacyMyReview ? (
                <p className="relative mt-6 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-center text-xs text-slate-600">
                  Schedule a meeting from the dashboard, let it finish (end time in the past), then you can leave a verified
                  review here.
                </p>
              ) : null}

              {hasActiveSession() && me && isOwnProfile && teach.length > 0 ? (
                <p className="relative mt-6 text-center text-xs text-slate-500">You can’t review your own profile.</p>
              ) : null}

              {hasActiveSession() && me && !isOwnProfile && teach.length === 0 ? (
                <p className="relative mt-6 text-center text-xs text-slate-500">
                  Reviews are only enabled for members who list skills they can teach.
                </p>
              ) : null}
            </motion.section>
          </div>
        )}
      </div>

      {/* Work Samples Modal */}
      {samplesModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/20 bg-white p-6 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.5)] ring-1 ring-slate-900/5 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-slate-900">{samplesModal.skillName}</h4>
                <p className="mt-0.5 text-xs text-slate-500">Work samples</p>
              </div>
              <button
                type="button"
                onClick={() => setSamplesModal(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              {modalSamplesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
                </div>
              ) : modalSamplesError ? (
                <p className="text-sm text-red-500">{modalSamplesError}</p>
              ) : modalSamples.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Paperclip className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-slate-500">No work samples uploaded yet.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {modalSamples.map((s) => {
                    const fileName = s.file_name || s.file_url.split("/").pop();
                    const isImage = s.file_type === "image";
                    const isVideo = s.file_type === "video";
                    const isPdf = s.file_type === "pdf";
                    return (
                      <li key={s.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
                        {isImage && (
                          <a href={s.file_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={s.file_url}
                              alt={fileName}
                              className="max-h-56 w-full object-cover"
                            />
                          </a>
                        )}
                        {isVideo && (
                          <video
                            src={s.file_url}
                            controls
                            className="max-h-56 w-full rounded-t-2xl bg-black"
                          />
                        )}
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                            {isPdf && <FileText className="h-4 w-4 shrink-0 text-red-500" />}
                            {isVideo && <Video className="h-4 w-4 shrink-0 text-blue-500" />}
                            {isImage && <ImageIcon className="h-4 w-4 shrink-0 text-emerald-500" />}
                            <span className="truncate font-medium">{fileName}</span>
                          </span>
                          <a
                            href={s.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                          >
                            Open
                          </a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
