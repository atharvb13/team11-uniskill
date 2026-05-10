import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Search, Trash2, UserPlus } from "lucide-react";
import { cancelMeeting, createMeeting, getMyConnections, getMyMeetings } from "../../utils/api";

const DURATION_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeekSunday(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function endOfWeekSaturday(d) {
  const x = startOfWeekSunday(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dateKey(d) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function dateKeyFromIso(iso) {
  return dateKey(new Date(iso));
}

function isSameDay(a, b) {
  return dateKey(a) === dateKey(b);
}

function userDisplayName(user) {
  const fn = user?.first_name?.trim();
  const ln = user?.last_name?.trim();
  if (fn && ln) {
    return `${fn} ${ln}`;
  }
  return fn || user?.username || "Unknown";
}

function parseDateTimeLocal(dateStr, timeStr) {
  if (!dateStr || !timeStr) {
    return null;
  }
  const dt = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(dt.getTime())) {
    return null;
  }
  return dt;
}

export default function ScheduleTab() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const [meetings, setMeetings] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [connectionQuery, setConnectionQuery] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [title, setTitle] = useState("Skill session");
  const [notes, setNotes] = useState("");
  const [meetingDate, setMeetingDate] = useState(() => dateKey(today));
  const [startTime, setStartTime] = useState("15:00");
  const [durationMin, setDurationMin] = useState(60);

  const monthWindowStart = useMemo(() => startOfWeekSunday(startOfMonth(monthCursor)), [monthCursor]);
  const monthWindowEnd = useMemo(() => endOfWeekSaturday(addDays(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0), 0)), [monthCursor]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [m, c] = await Promise.all([
        getMyMeetings({ from: monthWindowStart.toISOString(), to: monthWindowEnd.toISOString() }),
        getMyConnections(),
      ]);
      setMeetings(Array.isArray(m) ? m : []);
      setConnections(Array.isArray(c) ? c : []);
    } catch (e) {
      setMeetings([]);
      setConnections([]);
      setError(e instanceof Error ? e.message : "Could not load schedule.");
    } finally {
      setLoading(false);
    }
  }, [monthWindowStart, monthWindowEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const calendarDays = useMemo(() => {
    const arr = [];
    const start = monthWindowStart;
    for (let i = 0; i < 42; i++) {
      arr.push(addDays(start, i));
    }
    return arr;
  }, [monthWindowStart]);

  const meetingsByDay = useMemo(() => {
    const map = new Map();
    for (const mt of meetings) {
      const key = dateKeyFromIso(mt.starts_at);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(mt);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    }
    return map;
  }, [meetings]);

  const selectedDayMeetings = useMemo(() => meetingsByDay.get(dateKey(selectedDate)) || [], [meetingsByDay, selectedDate]);

  const upcomingAgenda = useMemo(() => {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const d = addDays(selectedDate, i);
      out.push({ date: d, items: meetingsByDay.get(dateKey(d)) || [] });
    }
    return out;
  }, [meetingsByDay, selectedDate]);

  const filteredConnections = useMemo(() => {
    const q = connectionQuery.trim().toLowerCase();
    if (!q) {
      return connections;
    }
    return connections.filter((c) => {
      const label = `${userDisplayName(c.user)} ${c.user?.username || ""}`.toLowerCase();
      return label.includes(q);
    });
  }, [connections, connectionQuery]);

  useEffect(() => {
    if (!participantId) {
      return;
    }
    const stillListed = filteredConnections.some((c) => String(c.user?.id || "") === participantId);
    if (!stillListed) {
      setParticipantId("");
    }
  }, [filteredConnections, participantId]);

  const selectedConnection = useMemo(
    () => connections.find((c) => String(c.user?.id) === participantId)?.user || null,
    [connections, participantId],
  );

  const computedWindow = useMemo(() => {
    const starts = parseDateTimeLocal(meetingDate, startTime);
    if (!starts) {
      return null;
    }
    const ends = new Date(starts.getTime() + Number(durationMin) * 60 * 1000);
    return { starts, ends };
  }, [meetingDate, startTime, durationMin]);

  const myConflict = useMemo(() => {
    if (!computedWindow) {
      return null;
    }
    const { starts, ends } = computedWindow;
    return meetings.find((m) => {
      const ms = new Date(m.starts_at);
      const me = new Date(m.ends_at);
      return ms < ends && me > starts;
    }) || null;
  }, [computedWindow, meetings]);

  async function handleSchedule(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!participantId) {
      setError("Choose a connection.");
      return;
    }
    if (!computedWindow) {
      setError("Choose a valid date and time.");
      return;
    }
    const { starts, ends } = computedWindow;
    setSaving(true);
    try {
      await createMeeting({
        participant_id: participantId,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        title: title.trim() || "Meeting",
        notes: notes.trim() || undefined,
      });
      setNotes("");
      setSuccess(
        `Meeting scheduled with ${userDisplayName(selectedConnection)} for ${starts.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        })} at ${starts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(meetingId) {
    if (!window.confirm("Cancel this meeting?")) {
      return;
    }
    setError("");
    try {
      await cancelMeeting(meetingId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel meeting.");
    }
  }

  function formatMeetingTime(mt) {
    const s = new Date(mt.starts_at);
    const e = new Date(mt.ends_at);
    return `${s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${e.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-400/90">
            <CalendarIcon className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Schedule</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold text-white">Meetings with connections</h2>
          <p className="mt-1 text-sm text-slate-400">
            Week view starts on Sunday, and today is highlighted so you can orient quickly.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          Today:{" "}
          <span className="font-semibold text-emerald-300">
            {today.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">{success}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-white/10 bg-white/[0.97] p-5 shadow-xl lg:col-span-3"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-lg font-bold text-slate-900">
              {monthCursor.toLocaleDateString([], { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div
            className="mb-2 grid gap-1 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500"
            style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {calendarDays.map((d) => {
              const key = dateKey(d);
              const inMonth = d.getMonth() === monthCursor.getMonth();
              const selected = isSameDay(d, selectedDate);
              const isToday = isSameDay(d, today);
              const count = (meetingsByDay.get(key) || []).length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(startOfDay(d))}
                  className={`relative rounded-xl px-2 py-2 text-sm transition ${
                    selected
                      ? "bg-emerald-600 text-white shadow"
                      : inMonth
                        ? "bg-slate-50 text-slate-800 hover:bg-slate-100"
                        : "bg-slate-50/40 text-slate-400 hover:bg-slate-100"
                  } ${isToday && !selected ? "ring-2 ring-emerald-400/80" : ""}`}
                >
                  <span>{d.getDate()}</span>
                  {count > 0 ? (
                    <span className={`absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${selected ? "bg-white" : "bg-emerald-500"}`} />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">
              {isSameDay(selectedDate, today) ? "Today" : selectedDate.toLocaleDateString([], { weekday: "long" })}
              <span className="ml-2 font-normal text-slate-500">
                {selectedDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                const t = startOfDay(new Date());
                setSelectedDate(t);
                setMonthCursor(startOfMonth(t));
              }}
              className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Today
            </button>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center justify-center gap-2 py-10 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading meetings…
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {selectedDayMeetings.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No meetings on this date.</p>
              ) : (
                selectedDayMeetings.map((mt) => (
                  <div key={mt.id} className="flex items-start justify-between gap-3 rounded-xl border border-emerald-100 bg-white px-3 py-2.5 shadow-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{mt.title || "Meeting"}</p>
                      <p className="text-sm text-slate-700">{formatMeetingTime(mt)}</p>
                      <p className="text-sm text-slate-600">With {userDisplayName(mt.other_user)}</p>
                      <p className="text-xs text-slate-500">{mt.my_role === "organizer" ? "Created by you" : "Invitation received"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCancel(mt.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Cancel meeting"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}

              <div className="border-t border-slate-200 pt-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Upcoming (compact)</p>
                <ul className="space-y-1.5">
                  {upcomingAgenda.map(({ date, items }) => (
                    <li key={dateKey(date)} className="text-sm text-slate-700">
                      <span className="font-medium">{date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
                      <span className="text-slate-400"> — </span>
                      {items.length === 0 ? (
                        <span className="text-slate-400">No meetings</span>
                      ) : (
                        <span>{items.length} meeting{items.length > 1 ? "s" : ""}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[28px] border border-white/10 bg-white/[0.97] p-6 shadow-xl lg:col-span-2"
        >
          <div className="mb-4 flex items-center gap-2 text-slate-800">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-bold">New meeting</h3>
          </div>
          {connections.length === 0 ? (
            <p className="text-sm leading-relaxed text-slate-600">Connect with someone from Home first — then schedule here.</p>
          ) : (
            <form onSubmit={(e) => void handleSchedule(e)} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="schedule-connection-search">
                  Search connection
                </label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="schedule-connection-search"
                    value={connectionQuery}
                    onChange={(e) => setConnectionQuery(e.target.value)}
                    placeholder="Filter by name or @username"
                    autoComplete="off"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {connectionQuery.trim()
                    ? filteredConnections.length > 0
                      ? `${filteredConnections.length} match${filteredConnections.length === 1 ? "" : "es"} — pick someone below`
                      : "No connections match — clear the search or try another spelling."
                    : "Pick someone below — or type to narrow the list."}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">With</p>
                <div className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1">
                  {filteredConnections.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-slate-500">
                      No one to show here matching your filter.
                    </p>
                  ) : (
                    <ul className="space-y-0.5" role="listbox" aria-label="Connections">
                      {filteredConnections.map((c) => {
                        const id = String(c.user?.id || "");
                        const selected = participantId === id;
                        const line = `${userDisplayName(c.user)}${c.user?.username ? ` (@${c.user.username})` : ""}`;
                        return (
                          <li key={c.connection_id} role="option" aria-selected={selected}>
                            <button
                              type="button"
                              onClick={() => setParticipantId(id)}
                              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                                selected
                                  ? "bg-emerald-600 font-semibold text-white shadow-sm"
                                  : "text-slate-800 hover:bg-slate-100"
                              }`}
                            >
                              {line}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {!participantId ? (
                  <p className="mt-1 text-xs text-amber-700">Select a connection to schedule.</p>
                ) : selectedConnection ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Selected: {userDisplayName(selectedConnection)}
                    {selectedConnection.username ? ` (@${selectedConnection.username})` : ""}
                  </p>
                ) : null}
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  Date
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Start time
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    required
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Duration
                <select
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              {computedWindow ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Ends at{" "}
                  <span className="font-semibold text-slate-700">
                    {computedWindow.ends.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </p>
              ) : null}

              {myConflict ? (
                <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Conflict: You already have “{myConflict.title || "Meeting"}” at {formatMeetingTime(myConflict)}.
                </p>
              ) : (
                <p className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Available on your calendar. (Other person’s conflicts are not available yet.)
                </p>
              )}

              <label className="block text-sm font-medium text-slate-700">
                Notes <span className="font-normal text-slate-400">(optional)</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setNotes("");
                    setTitle("Skill session");
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving || !participantId || !meetingDate || !startTime || !!myConflict}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Scheduling…" : "Schedule meeting"}
                </button>
              </div>
            </form>
          )}
        </motion.section>
      </div>
    </div>
  );
}
