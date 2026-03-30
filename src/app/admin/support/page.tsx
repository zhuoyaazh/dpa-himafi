"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { ToastContainer, useToast } from "@/components/toast-notification";

type ThreadStatus = "open" | "in_review" | "resolved";
type TicketChannel = "general" | "password_recovery";

type UnifiedThread = {
  id: string;
  channel: TicketChannel;
  subject: string;
  category: string;
  status: ThreadStatus;
  requesterEmail: string;
  requesterNim: string;
  requesterUid?: string;
  contactInfo?: string;
  verificationNote?: string;
  lastMessage: string;
  lastSenderRole: "user" | "admin";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  assignedAdminEmail?: string;
};

type UnifiedMessage = {
  id: string;
  text: string;
  senderRole: "user" | "admin";
  senderEmail: string;
  createdAt?: Timestamp;
};

function formatTimestamp(value?: Timestamp) {
  if (!value) return "-";
  return value.toDate().toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMessageDay(value?: Timestamp) {
  if (!value) return "Recent";
  return value.toDate().toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getThreadPath(thread: UnifiedThread) {
  return thread.channel === "password_recovery" ? "password_reset_chats" : "support_threads";
}

function sortThreadsByUpdatedAt(items: UnifiedThread[]) {
  return [...items].sort((left, right) => {
    const leftValue = left.updatedAt?.toMillis() ?? 0;
    const rightValue = right.updatedAt?.toMillis() ?? 0;
    return rightValue - leftValue;
  });
}

export default function AdminSupportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [threads, setThreads] = useState<UnifiedThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [supportLoadError, setSupportLoadError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  async function resolveAdminAccess(currentUser: User) {
    const snapshot = await getDoc(doc(db, "admin_users", currentUser.uid));
    return snapshot.exists() && snapshot.data().active === true;
  }

  async function loadThreads() {
    const [generalResult, recoveryResult] = await Promise.allSettled([
      getDocs(query(collection(db, "support_threads"), orderBy("updatedAt", "desc"), limit(250))),
      getDocs(query(collection(db, "password_reset_chats"), orderBy("updatedAt", "desc"), limit(250))),
    ]);

    const generalSnapshot = generalResult.status === "fulfilled" ? generalResult.value : null;
    const recoverySnapshot = recoveryResult.status === "fulfilled" ? recoveryResult.value : null;

    if (!generalSnapshot && !recoverySnapshot) {
      throw new Error("Semua query tiket support ditolak oleh Firestore Rules.");
    }

    if (!generalSnapshot || !recoverySnapshot) {
      setSupportLoadError("Sebagian data support belum bisa dibaca. Cek Firestore Rules untuk support_threads dan password_reset_chats.");
    } else {
      setSupportLoadError("");
    }

    const generalThreads: UnifiedThread[] = (generalSnapshot?.docs ?? []).map((threadDoc) => {
      const data = threadDoc.data() as {
        category?: string;
        subject?: string;
        status?: ThreadStatus;
        requesterEmail?: string;
        requesterNim?: string;
        requesterUid?: string;
        lastMessage?: string;
        lastSenderRole?: "user" | "admin";
        createdAt?: Timestamp;
        updatedAt?: Timestamp;
        assignedAdminEmail?: string;
      };

      return {
        id: `general:${threadDoc.id}`,
        channel: "general",
        subject: data.subject ?? "Tiket Bantuan",
        category: data.category ?? "lainnya",
        status: data.status ?? "open",
        requesterEmail: data.requesterEmail ?? "-",
        requesterNim: data.requesterNim ?? "",
        requesterUid: data.requesterUid,
        lastMessage: data.lastMessage ?? "",
        lastSenderRole: data.lastSenderRole ?? "user",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        assignedAdminEmail: data.assignedAdminEmail,
      };
    });

    const recoveryThreads: UnifiedThread[] = (recoverySnapshot?.docs ?? []).map((threadDoc) => {
      const data = threadDoc.data() as {
        requesterEmail?: string;
        requesterNim?: string;
        contactInfo?: string;
        verificationNote?: string;
        status?: ThreadStatus;
        lastMessage?: string;
        lastSenderRole?: "user" | "admin";
        createdAt?: Timestamp;
        updatedAt?: Timestamp;
        assignedAdminEmail?: string;
      };

      return {
        id: `password_recovery:${threadDoc.id}`,
        channel: "password_recovery",
        subject: `Recovery ${threadDoc.id}`,
        category: "password",
        status: data.status ?? "open",
        requesterEmail: data.requesterEmail ?? "-",
        requesterNim: data.requesterNim ?? "",
        contactInfo: data.contactInfo,
        verificationNote: data.verificationNote,
        lastMessage: data.lastMessage ?? "",
        lastSenderRole: data.lastSenderRole ?? "user",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        assignedAdminEmail: data.assignedAdminEmail,
      };
    });

    setThreads(sortThreadsByUpdatedAt([...generalThreads, ...recoveryThreads]));
  }

  async function loadMessages(thread: UnifiedThread) {
    const rawId = thread.id.split(":")[1];
    const basePath = getThreadPath(thread);

    let snapshot;

    try {
      snapshot = await getDocs(
        query(collection(db, basePath, rawId, "messages"), orderBy("createdAt", "asc"), limit(400)),
      );
    } catch {
      setMessages([]);
      setSupportLoadError("Tiket bisa terlihat, tapi pesan detailnya ditolak oleh rules. Pastikan rule subcollection messages sudah terdeploy.");
      return;
    }

    const loaded = snapshot.docs.map((messageDoc) => {
      const data = messageDoc.data() as {
        text?: string;
        senderRole?: "user" | "admin";
        senderEmail?: string;
        createdAt?: Timestamp;
      };

      return {
        id: messageDoc.id,
        text: data.text ?? "",
        senderRole: data.senderRole ?? "user",
        senderEmail: data.senderEmail ?? "-",
        createdAt: data.createdAt,
      };
    });

    setMessages(loaded);
  }

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setIsAdmin(false);
        setSupportLoadError("");
        setIsLoading(false);
        return;
      }

      try {
        const activeAdmin = await resolveAdminAccess(currentUser);
        setIsAdmin(activeAdmin);
        setSupportLoadError("");

        if (activeAdmin) {
          try {
            await loadThreads();
          } catch {
            setSupportLoadError("Akses admin valid, tapi data tiket support belum bisa dibaca. Biasanya ini karena Firestore Rules belum terdeploy.");
          }
        }
      } catch {
        setIsAdmin(false);
        setSupportLoadError("");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedThread) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedThread);
  }, [selectedThread]);

  async function onSendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.email || !selectedThread) return;

    const cleanReply = replyText.trim();
    if (!cleanReply) {
      addToast("Balasan tidak boleh kosong.", "warning");
      return;
    }

    const rawId = selectedThread.id.split(":")[1];
    const basePath = getThreadPath(selectedThread);

    try {
      setIsSendingReply(true);

      await addDoc(collection(db, basePath, rawId, "messages"), {
        text: cleanReply,
        senderRole: "admin",
        senderEmail: user.email,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, basePath, rawId), {
        lastMessage: cleanReply,
        lastSenderRole: "admin",
        status: selectedThread.status === "open" ? "in_review" : selectedThread.status,
        assignedAdminUid: user.uid,
        assignedAdminEmail: user.email,
        updatedAt: serverTimestamp(),
      });

      setReplyText("");
      await Promise.all([loadThreads(), loadMessages(selectedThread)]);
      addToast("Balasan terkirim.", "success");
    } catch {
      addToast("Gagal mengirim balasan.", "error");
    } finally {
      setIsSendingReply(false);
    }
  }

  async function onUpdateThreadStatus(nextStatus: ThreadStatus) {
    if (!selectedThread || !user?.email) return;

    const rawId = selectedThread.id.split(":")[1];
    const basePath = getThreadPath(selectedThread);

    try {
      setIsUpdatingStatus(true);

      await updateDoc(doc(db, basePath, rawId), {
        status: nextStatus,
        assignedAdminUid: user.uid,
        assignedAdminEmail: user.email,
        updatedAt: serverTimestamp(),
      });

      await loadThreads();
      addToast(`Status tiket diubah ke ${nextStatus}.`, "success");
    } catch {
      addToast("Gagal update status tiket.", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  if (isLoading) {
    return <section className="gold-card p-6 text-sm">Memuat panel support admin...</section>;
  }

  if (!user) {
    return <section className="gold-card p-6 text-sm">Login dulu untuk membuka panel support admin.</section>;
  }

  if (!isAdmin) {
    return <section className="gold-card p-6 text-sm">Akun ini tidak memiliki akses admin support.</section>;
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      {supportLoadError ? (
        <div className="gold-card border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {supportLoadError}
        </div>
      ) : null}

      <header className="space-y-2">
        <p className="section-kicker">Admin Console</p>
        <h1 className="section-title">Support Inbox</h1>
        <p className="max-w-3xl text-sm text-foreground/75">
          Satu panel chat untuk bantuan umum dan recovery password dengan alur admin yang lebih ringkas.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <aside className="gold-card space-y-3 p-4 sm:p-5">
          <p className="text-sm text-foreground/75">
            Pilih tiket di bawah untuk membalas pesan dan ubah status langsung dari panel kanan.
          </p>

          <div className="max-h-140 space-y-2 overflow-y-auto pr-1">
            {threads.length === 0 ? <p className="text-sm text-foreground/70">Belum ada tiket.</p> : null}
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
                className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                  selectedThreadId === thread.id
                    ? "border-[--maroon] bg-white"
                    : "border-[--gold-soft] bg-white/70"
                }`}
              >
                <p className="font-semibold text-[--maroon]">{thread.subject}</p>
                <p className="text-xs uppercase tracking-wide text-foreground/60">
                  {thread.channel === "password_recovery" ? "Recovery Password" : "Bantuan Umum"}
                </p>
                <p className="text-xs text-foreground/65">{thread.requesterEmail}</p>
                <p className="text-xs uppercase tracking-wide text-foreground/60">{thread.status}</p>
                <p className="mt-1 line-clamp-2 text-foreground/75">{thread.lastMessage}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="gold-card flex min-h-140 flex-col p-4 sm:p-5">
          {!selectedThread ? (
            <div className="my-auto rounded-2xl border border-dashed border-[--gold-soft] p-6 text-center text-sm text-foreground/70">
              Pilih tiket di kiri untuk mulai balas chat pengguna.
            </div>
          ) : (
            <>
              <div className="mb-4 grid gap-2 rounded-2xl border border-[--gold-soft] bg-white/70 p-3 sm:grid-cols-[1fr,auto] sm:items-center">
                <div>
                  <p className="font-semibold text-[--maroon]">{selectedThread.subject}</p>
                  <p className="text-xs text-foreground/70">
                    {selectedThread.requesterEmail} · NIM: {selectedThread.requesterNim || "-"} · Update: {formatTimestamp(selectedThread.updatedAt)}
                  </p>
                  <p className="text-xs text-foreground/65">
                    Assigned admin: {selectedThread.assignedAdminEmail ?? "-"}
                  </p>
                </div>
                <select
                  value={selectedThread.status}
                  onChange={(event) => void onUpdateThreadStatus(event.target.value as ThreadStatus)}
                  disabled={isUpdatingStatus}
                  className="input-luxury w-full sm:w-44"
                >
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="imessage-thread">
                {messages.map((message, index) => {
                  const currentDayKey = message.createdAt?.toDate().toDateString() ?? "";
                  const previousDayKey = messages[index - 1]?.createdAt?.toDate().toDateString() ?? "";
                  const showDayDivider = index === 0 || currentDayKey !== previousDayKey;

                  return (
                    <div key={message.id}>
                      {showDayDivider ? (
                        <p className="imessage-day-divider">{formatMessageDay(message.createdAt)}</p>
                      ) : null}
                      <div
                        className={`imessage-row ${
                          message.senderRole === "admin" ? "imessage-row-user" : "imessage-row-peer"
                        }`}
                      >
                        <div
                          className={`imessage-bubble ${
                            message.senderRole === "admin" ? "imessage-bubble-user" : "imessage-bubble-peer"
                          }`}
                        >
                          <p className="text-[11px] opacity-80">{message.senderRole === "admin" ? "Admin" : "User"}</p>
                          <p className="wrap-break-word">{message.text}</p>
                          <p className="imessage-meta">{formatTimestamp(message.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form className="imessage-composer grid gap-2 sm:grid-cols-[1fr,auto]" onSubmit={onSendReply}>
                <textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  rows={2}
                  className="input-luxury"
                  placeholder="Tulis balasan untuk user..."
                />
                <button
                  type="submit"
                  disabled={isSendingReply}
                  className="imessage-send-button"
                  aria-label="Kirim balasan"
                  title="Kirim balasan"
                >
                  {isSendingReply ? (
                    "..."
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </section>
  );
}
