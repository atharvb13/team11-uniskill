import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Video,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getAccessToken } from "../../utils/session";
import { compressVideo, isVideoFile } from "../../utils/videoCompressor";
import {
  acceptConnection,
  getMessages,
  getMessagePreviews,
  getMyConnections,
  getPendingRequests,
  markMessagesRead,
  rejectConnection,
  sendMessage,
} from "../../utils/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return isToday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function previewText(preview) {
  if (!preview?.last_message) return "";
  const { attachment_type, attachment_name, content } = preview.last_message;
  if (attachment_type === "image") return "📷 Image";
  if (attachment_type === "video") return "🎥 Video";
  if (attachment_type === "file") return `📎 ${attachment_name || "File"}`;
  return content || "";
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectFileType(file) {
  if (file?.type?.startsWith("image/")) return "image";
  if (file?.type?.startsWith("video/")) return "video";
  return "file";
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ user, size = "md" }) {
  const cls =
    size === "sm" ? "h-8 w-8 text-[11px]"
    : size === "lg" ? "h-11 w-11 text-sm"
    : "h-9 w-9 text-xs";
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 font-bold text-white ${cls}`}>
      {userInitials(user)}
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe }) {
  const { attachment_url, attachment_type, attachment_name, attachment_size, content, created_at } = msg;
  const hasAttachment = !!attachment_url;

  const timeStamp = (
    <p className={`pb-2 pr-3 text-right text-[10px] ${isMe ? "text-emerald-200/60" : "text-slate-500"}`}>
      {formatTime(created_at)}
    </p>
  );

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] rounded-2xl text-sm overflow-hidden ${
        isMe ? "rounded-br-sm bg-emerald-600/75 text-white" : "rounded-bl-sm bg-white/10 text-slate-100"
      }`}>

        {/* Image */}
        {hasAttachment && attachment_type === "image" && (
          <a href={attachment_url} target="_blank" rel="noopener noreferrer">
            <img
              src={attachment_url}
              alt={attachment_name || "image"}
              className="max-h-60 w-full object-cover"
            />
          </a>
        )}

        {/* Video */}
        {hasAttachment && attachment_type === "video" && (
          <video
            src={attachment_url}
            controls
            preload="metadata"
            className="max-h-60 w-full bg-black"
          />
        )}

        {/* File */}
        {hasAttachment && attachment_type === "file" && (
          <a
            href={attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2.5 px-4 py-3 ${isMe ? "text-emerald-100 hover:text-white" : "text-slate-200 hover:text-white"}`}
          >
            <FileText className="h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{attachment_name || "File"}</p>
              {attachment_size ? (
                <p className={`text-[10px] ${isMe ? "text-emerald-200/70" : "text-slate-400"}`}>
                  {formatBytes(attachment_size)}
                </p>
              ) : null}
            </div>
          </a>
        )}

        {/* Text */}
        {content ? (
          <div className="px-4 py-2.5">
            <p className="break-words leading-relaxed">{content}</p>
          </div>
        ) : null}

        {timeStamp}
      </div>
    </div>
  );
}

// ─── Compression progress bar ─────────────────────────────────────────────────

function CompressionProgress({ progress }) {
  return (
    <div className="mx-4 mb-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
          <Video className="h-3.5 w-3.5" />
          Compressing video…
        </span>
        <span className="text-xs text-emerald-400">{progress}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main ChatTab ─────────────────────────────────────────────────────────────

export default function ChatTab({ myId }) {
  const [connections, setConnections] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [previews, setPreviews] = useState({});
  const [sortedConnections, setSortedConnections] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState(null);   // { file, previewUrl, type }

  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(null); // null | 0-100
  const [uploadProgress, setUploadProgress] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);
  const selectedUserRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  // Sort connections by most-recent message
  useEffect(() => {
    setSortedConnections(
      [...connections].sort((a, b) => {
        const ta = previews[a.user?.id]?.last_message?.created_at ?? "";
        const tb = previews[b.user?.id]?.last_message?.created_at ?? "";
        return tb.localeCompare(ta);
      })
    );
  }, [connections, previews]);

  // Load connections + previews
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [connsData, pendingData, previewsData] = await Promise.all([
        getMyConnections(),
        getPendingRequests(),
        getMessagePreviews(),
      ]);
      setConnections(connsData);
      setPendingRequests(pendingData);
      const map = {};
      for (const p of previewsData) map[p.other_user_id] = p;
      setPreviews(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // Supabase Realtime — incoming messages
  useEffect(() => {
    if (!myId || !supabase) return;
    const token = getAccessToken();
    if (token) {
      supabase.auth.setSession({ access_token: token, refresh_token: "" }).catch(() => {});
    }

    const channel = supabase
      .channel(`messages-inbox-${myId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${myId}` },
        (payload) => {
          const newMsg = payload.new;
          const senderId = newMsg.sender_id;
          const isActiveChat = selectedUserRef.current?.id === senderId;

          setPreviews((prev) => ({
            ...prev,
            [senderId]: {
              ...(prev[senderId] || { other_user_id: senderId, unread_count: 0 }),
              last_message: {
                content: newMsg.content,
                created_at: newMsg.created_at,
                sender_id: senderId,
                attachment_type: newMsg.attachment_type,
                attachment_name: newMsg.attachment_name,
              },
              unread_count: isActiveChat ? 0 : ((prev[senderId]?.unread_count || 0) + 1),
            },
          }));

          if (isActiveChat) setMessages((prev) => [...prev, newMsg]);
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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Open conversation
  const openChat = useCallback(async (user) => {
    setSelectedUser(user);
    setMessages([]);
    setMsgLoading(true);
    setError("");
    setPreviews((prev) => ({
      ...prev,
      [user.id]: { ...(prev[user.id] || {}), unread_count: 0 },
    }));
    try {
      const [msgs] = await Promise.all([
        getMessages(user.id),
        markMessagesRead(user.id).catch(() => {}),
      ]);
      setMessages(msgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages.");
    } finally {
      setMsgLoading(false);
    }
  }, []);

  // File selection
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = detectFileType(file);
    const previewUrl = (type === "image" || type === "video")
      ? URL.createObjectURL(file)
      : null;
    setPendingFile({ file, previewUrl, type });
    e.target.value = "";
  }

  function removePendingFile() {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  }

  // Upload to Supabase Storage
  async function uploadFile(file, type) {
    if (!supabase) throw new Error("Supabase client not available.");
    const ext = file.name.split(".").pop();
    const folder = type === "image" ? "images" : type === "video" ? "videos" : "files";
    const path = `${myId}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);
    const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    return urlData.publicUrl;
  }

  // Send message
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content && !pendingFile) return;
    if (!selectedUser || sending) return;

    setSending(true);
    setInput("");
    const fileToSend = pendingFile;
    setPendingFile(null);

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      sender_id: myId,
      receiver_id: selectedUser.id,
      content,
      created_at: new Date().toISOString(),
      attachment_url: fileToSend?.previewUrl ?? null,
      attachment_type: fileToSend?.type ?? null,
      attachment_name: fileToSend?.file?.name ?? null,
      attachment_size: fileToSend?.file?.size ?? null,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setPreviews((prev) => ({
      ...prev,
      [selectedUser.id]: {
        ...(prev[selectedUser.id] || {}),
        last_message: {
          content,
          created_at: tempMsg.created_at,
          sender_id: myId,
          attachment_type: fileToSend?.type ?? null,
          attachment_name: fileToSend?.file?.name ?? null,
        },
        unread_count: 0,
      },
    }));

    try {
      let attachment = null;

      if (fileToSend) {
        let fileToUpload = fileToSend.file;

        // Compress video before uploading
        if (fileToSend.type === "video") {
          setCompressionProgress(0);
          fileToUpload = await compressVideo(fileToSend.file, (pct) => {
            setCompressionProgress(pct);
          });
          setCompressionProgress(null);
        }

        setUploadProgress(true);
        const url = await uploadFile(fileToUpload, fileToSend.type);
        setUploadProgress(false);

        attachment = {
          url,
          type: fileToSend.type,
          name: fileToUpload.name,
          size: fileToUpload.size,
        };

        // Update optimistic message with real upload URL
        setMessages((prev) =>
          prev.map((m) => m.id === tempId ? { ...m, attachment_url: url, attachment_size: fileToUpload.size } : m)
        );
      }

      const saved = await sendMessage(selectedUser.id, content, attachment);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved ?? m : m)));
    } catch (e) {
      setCompressionProgress(null);
      setUploadProgress(false);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(e instanceof Error ? e.message : "Failed to send.");
    } finally {
      setSending(false);
      if (fileToSend?.previewUrl) URL.revokeObjectURL(fileToSend.previewUrl);
    }
  }, [input, pendingFile, selectedUser, sending, myId]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }, [handleSend]);

  const handleAccept = useCallback(async (id) => {
    try { await acceptConnection(id); await loadAll(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to accept."); }
  }, [loadAll]);

  const handleReject = useCallback(async (id) => {
    try { await rejectConnection(id); await loadAll(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to reject."); }
  }, [loadAll]);

  const isEmpty = connections.length === 0 && pendingRequests.length === 0;
  const isBusy = compressionProgress !== null || uploadProgress;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex gap-4"
      style={{ height: "calc(100vh - 220px)", minHeight: "520px" }}
    >
      {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
      <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
        <div className="border-b border-white/10 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-white">Chats</h2>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <MessageSquare className="h-8 w-8 text-slate-600" />
            <p className="text-sm text-slate-400">No connections yet</p>
            <p className="text-xs text-slate-500">Connect with users from the Home tab</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Pending requests */}
            {pendingRequests.length > 0 && (
              <div className="border-b border-white/10 px-3 py-3">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                  Requests ({pendingRequests.length})
                </p>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div key={req.connection_id} className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-3">
                      <div className="mb-2.5 flex items-center gap-2.5">
                        <Avatar user={req.user} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{userDisplayName(req.user)}</p>
                          <p className="truncate text-xs text-slate-400">@{req.user.username}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleAccept(req.connection_id)}
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-400/25 bg-emerald-500/20 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30">
                          <Check className="h-3 w-3" /> Accept
                        </button>
                        <button onClick={() => handleReject(req.connection_id)}
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-400/20 bg-red-500/10 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20">
                          <X className="h-3 w-3" /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation list */}
            <div className="divide-y divide-white/5">
              {sortedConnections.map(({ connection_id, user }) => {
                const preview = previews[user.id];
                const unread = preview?.unread_count || 0;
                const isActive = selectedUser?.id === user.id;

                return (
                  <button key={connection_id} onClick={() => openChat(user)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${isActive ? "bg-emerald-500/10" : "hover:bg-white/5"}`}>
                    <div className="relative">
                      <Avatar user={user} />
                      {unread > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className={`truncate text-sm font-medium ${unread > 0 ? "text-white" : "text-slate-200"}`}>
                          {userDisplayName(user)}
                        </p>
                        {preview?.last_message?.created_at && (
                          <span className={`shrink-0 text-[10px] ${unread > 0 ? "font-semibold text-emerald-400" : "text-slate-500"}`}>
                            {formatTime(preview.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      <p className={`truncate text-xs ${unread > 0 ? "font-medium text-slate-200" : "text-slate-500"}`}>
                        {previewText(preview) || "No messages yet"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
        {!selectedUser ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <MessageSquare className="h-7 w-7 text-slate-500" />
            </div>
            <p className="text-base font-medium text-slate-300">Select a conversation</p>
            <p className="text-sm text-slate-500">Choose a connection from the left to start chatting</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3.5">
              <Avatar user={selectedUser} size="lg" />
              <div>
                <p className="text-sm font-semibold text-white">{userDisplayName(selectedUser)}</p>
                <p className="text-xs text-slate-400">@{selectedUser.username}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {msgLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No messages yet — say hello!</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} isMe={msg.sender_id === myId} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="mx-5 mb-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            {/* Compression progress */}
            {compressionProgress !== null && (
              <CompressionProgress progress={compressionProgress} />
            )}

            {/* Upload progress */}
            {uploadProgress && compressionProgress === null && (
              <div className="mx-4 mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-slate-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                Uploading…
              </div>
            )}

            {/* Pending file preview */}
            {pendingFile && (
              <div className="mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                {pendingFile.type === "image" && (
                  <img src={pendingFile.previewUrl} alt="preview"
                    className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                )}
                {pendingFile.type === "video" && (
                  <video src={pendingFile.previewUrl} className="h-16 w-28 shrink-0 rounded-xl object-cover bg-black"
                    muted playsInline />
                )}
                {pendingFile.type === "file" && (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <FileText className="h-6 w-6 text-slate-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{pendingFile.file.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(pendingFile.file.size)}
                    {pendingFile.type === "video" && (
                      <span className="ml-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                        Will be compressed
                      </span>
                    )}
                  </p>
                </div>
                <button onClick={removePendingFile}
                  className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Input bar */}
            <div className="border-t border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy || sending}
                  title="Attach image, video, or file"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50">
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={pendingFile ? "Add a caption…" : "Type a message…"}
                  maxLength={2000}
                  disabled={isBusy}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={(!input.trim() && !pendingFile) || sending || isBusy}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                  {sending || isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
