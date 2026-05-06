import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, MessageSquare, Send, X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getAccessToken } from "../../utils/session";
import {
  acceptConnection,
  getMessages,
  getMyConnections,
  getPendingRequests,
  rejectConnection,
  sendMessage,
} from "../../utils/api";

function userInitials(user) {
  const fn = user?.first_name?.trim()?.[0];
  const ln = user?.last_name?.trim()?.[0];
  if (fn && ln) return `${fn}${ln}`.toUpperCase();
  if (fn) return fn.toUpperCase();
  return (user?.username?.[0] || "?").toUpperCase();
}

function userDisplayName(user) {
  const fn = user?.first_name?.trim();
  const ln = user?.last_name?.trim();
  if (fn && ln) return `${fn} ${ln}`;
  return fn || user?.username || "Unknown";
}

function Avatar({ user, size = "md" }) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-xs";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 font-bold text-white ${sizeClass}`}
    >
      {userInitials(user)}
    </div>
  );
}

export default function ChatTab({ myId }) {
  const [connections, setConnections] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);
  const selectedUserRef = useRef(null);

  // Keep ref in sync so the realtime callback can read latest selectedUser
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [connsData, pendingData] = await Promise.all([
        getMyConnections(),
        getPendingRequests(),
      ]);
      setConnections(connsData);
      setPendingRequests(pendingData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load connections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  // ── Supabase Realtime — listen for incoming messages ──────────────────────
  useEffect(() => {
    if (!myId || !supabase) return;

    // Authenticate the Supabase client with the user's JWT so RLS passes
    const token = getAccessToken();
    if (token) {
      supabase.auth
        .setSession({ access_token: token, refresh_token: "" })
        .catch(() => {});
    }

    const channel = supabase
      .channel(`messages-inbox-${myId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${myId}`,
        },
        (payload) => {
          const newMsg = payload.new;
          // Only append to UI if we're currently viewing this sender's chat
          if (selectedUserRef.current?.id === newMsg.sender_id) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {});
        channelRef.current = null;
      }
    };
  }, [myId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openChat = useCallback(async (user) => {
    setSelectedUser(user);
    setMessages([]);
    setMsgLoading(true);
    setError("");
    try {
      const data = await getMessages(user.id);
      setMessages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages.");
    } finally {
      setMsgLoading(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedUser || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    // Optimistic message — show immediately
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      sender_id: myId,
      receiver_id: selectedUser.id,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const saved = await sendMessage(selectedUser.id, content);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? saved ?? tempMsg : m))
      );
    } catch (e) {
      // Roll back on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(e instanceof Error ? e.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }, [input, selectedUser, sending, myId]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  const handleAccept = useCallback(
    async (connectionId) => {
      try {
        await acceptConnection(connectionId);
        await loadConnections();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to accept connection.");
      }
    },
    [loadConnections]
  );

  const handleReject = useCallback(
    async (connectionId) => {
      try {
        await rejectConnection(connectionId);
        await loadConnections();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to reject connection.");
      }
    },
    [loadConnections]
  );

  const isEmpty = connections.length === 0 && pendingRequests.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex gap-4"
      style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}
    >
      {/* ── Left panel: connections list ── */}
      <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
        <div className="border-b border-white/10 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-white">Connections</h2>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <MessageSquare className="h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-400">No connections yet</p>
            <p className="text-xs text-slate-500">
              Connect with users from the Home tab
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {/* Pending requests */}
            {pendingRequests.length > 0 && (
              <div>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                  Requests ({pendingRequests.length})
                </p>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.connection_id}
                      className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-3"
                    >
                      <div className="mb-2.5 flex items-center gap-2.5">
                        <Avatar user={req.user} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {userDisplayName(req.user)}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            @{req.user.username}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAccept(req.connection_id)}
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-400/25 bg-emerald-500/20 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30"
                        >
                          <Check className="h-3 w-3" />
                          Accept
                        </button>
                        <button
                          onClick={() => handleReject(req.connection_id)}
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-400/20 bg-red-500/10 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                        >
                          <X className="h-3 w-3" />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connected users */}
            {connections.length > 0 && (
              <div>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Messages
                </p>
                <div className="space-y-0.5">
                  {connections.map(({ connection_id, user }) => {
                    const isActive = selectedUser?.id === user.id;
                    return (
                      <button
                        key={connection_id}
                        onClick={() => openChat(user)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                          isActive
                            ? "border border-emerald-400/20 bg-emerald-500/15"
                            : "border border-transparent hover:bg-white/5"
                        }`}
                      >
                        <Avatar user={user} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {userDisplayName(user)}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            @{user.username}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right panel: chat window ── */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
        {!selectedUser ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <MessageSquare className="h-7 w-7 text-slate-500" />
            </div>
            <p className="text-base font-medium text-slate-300">
              Select a conversation
            </p>
            <p className="text-sm text-slate-500">
              Choose a connection from the left to start chatting
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3.5">
              <Avatar user={selectedUser} />
              <div>
                <p className="text-sm font-semibold text-white">
                  {userDisplayName(selectedUser)}
                </p>
                <p className="text-xs text-slate-400">
                  @{selectedUser.username}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {msgLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">
                  No messages yet — say hello!
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === myId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                            isMe
                              ? "rounded-br-sm bg-emerald-600/75 text-white"
                              : "rounded-bl-sm bg-white/10 text-slate-100"
                          }`}
                        >
                          <p className="break-words leading-relaxed">
                            {msg.content}
                          </p>
                          <p
                            className={`mt-1 text-[10px] ${
                              isMe ? "text-emerald-200/60" : "text-slate-500"
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <p className="mx-5 mb-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            {/* Message input */}
            <div className="border-t border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  maxLength={2000}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
