"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { extractNimFromCampusEmail } from "@/lib/voter-identity";
import { ToastContainer, useToast } from "@/components/toast-notification";

type ThreadStatus = "open" | "in_review" | "resolved";

type SupportThread = {
  id: string;
  category: string;
  subject: string;
  status: ThreadStatus;
  requesterUid: string;
  requesterEmail: string;
  requesterNim: string;
  lastMessage: string;
  lastSenderRole: "user" | "admin";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type SupportMessage = {
  id: string;
  text: string;
  senderUid: string;
  senderEmail: string;
  senderRole: "user" | "admin";
  createdAt?: Timestamp;
};

const CATEGORY_OPTIONS = [
  { value: "password", label: "Password / Akun" },
  { value: "voting", label: "Kendala Voting" },
  { value: "hearing", label: "Kendala Hearing" },
  { value: "lainnya", label: "Lainnya" },
];

function formatTimestamp(value?: Timestamp) {
  if (!value) {
    return "-";
  }

  return value.toDate().toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMessageDay(value?: Timestamp) {
  if (!value) {
    return "Recent";
  }

  return value.toDate().toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function sortByUpdatedAtDesc(items: SupportThread[]) {
  return [...items].sort((left, right) => {
    const leftValue = left.updatedAt?.toMillis() ?? 0;
    const rightValue = right.updatedAt?.toMillis() ?? 0;
    return rightValue - leftValue;
  });
}

export default function BantuanPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isSubmittingThread, setIsSubmittingThread] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [category, setCategory] = useState("password");
  const [initialMessage, setInitialMessage] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const { toasts, addToast, removeToast } = useToast();

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  async function loadThreads(currentUser: User) {
    const snapshot = await getDocs(
      query(
        collection(db, "support_threads"),
        where("requesterUid", "==", currentUser.uid),
        limit(100),
      ),
    );

    const loadedThreads = snapshot.docs.map((threadDoc) => {
      const data = threadDoc.data() as Omit<SupportThread, "id">;
      return { id: threadDoc.id, ...data };
    });

    setThreads(sortByUpdatedAtDesc(loadedThreads));
  }

  async function loadMessages(threadId: string) {
    const snapshot = await getDocs(
      query(
        collection(db, "support_threads", threadId, "messages"),
        orderBy("createdAt", "asc"),
        limit(200),
      ),
    );

    const loadedMessages = snapshot.docs.map((messageDoc) => {
      const data = messageDoc.data() as Omit<SupportMessage, "id">;
      return { id: messageDoc.id, ...data };
    });

    setMessages(loadedMessages);
  }

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setThreads([]);
        setMessages([]);
        setSelectedThreadId("");
        setIsLoading(false);
        return;
      }

      try {
        await loadThreads(currentUser);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedThreadId);
  }, [selectedThreadId]);

  async function onCreateThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.email) {
      addToast("Login dulu sebelum membuat tiket bantuan.", "warning");
      return;
    }

    const cleanInitialMessage = initialMessage.trim();
    const selectedCategoryLabel =
      CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? "Bantuan";
    const cleanSubject = `${selectedCategoryLabel} - ${new Date().toLocaleDateString("id-ID")}`;

    if (!cleanInitialMessage) {
      addToast("Pesan awal wajib diisi.", "warning");
      return;
    }

    try {
      setIsSubmittingThread(true);

      const threadRef = await addDoc(collection(db, "support_threads"), {
        category,
        subject: cleanSubject,
        status: "open",
        requesterUid: user.uid,
        requesterEmail: user.email,
        requesterNim: extractNimFromCampusEmail(user.email),
        lastMessage: cleanInitialMessage,
        lastSenderRole: "user",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "support_threads", threadRef.id, "messages"), {
        text: cleanInitialMessage,
        senderUid: user.uid,
        senderEmail: user.email,
        senderRole: "user",
        createdAt: serverTimestamp(),
      });

      setInitialMessage("");
      setSelectedThreadId(threadRef.id);
      addToast("Tiket bantuan berhasil dibuat.", "success");
      await loadThreads(user);
      await loadMessages(threadRef.id);
    } catch {
      addToast("Gagal membuat tiket bantuan.", "error");
    } finally {
      setIsSubmittingThread(false);
    }
  }

  async function onSendMessage() {
    if (!user?.email || !selectedThread) {
      return;
    }

    const cleanText = newMessage.trim();
    if (!cleanText) {
      addToast("Pesan tidak boleh kosong.", "warning");
      return;
    }

    try {
      setIsSendingMessage(true);

      await addDoc(collection(db, "support_threads", selectedThread.id, "messages"), {
        text: cleanText,
        senderUid: user.uid,
        senderEmail: user.email,
        senderRole: "user",
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "support_threads", selectedThread.id), {
        lastMessage: cleanText,
        lastSenderRole: "user",
        status: selectedThread.status === "resolved" ? "in_review" : selectedThread.status,
        updatedAt: serverTimestamp(),
      });

      setNewMessage("");
      await Promise.all([loadThreads(user), loadMessages(selectedThread.id)]);
    } catch {
      addToast("Gagal mengirim pesan.", "error");
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function onReopenResolvedThread() {
    if (!selectedThread || selectedThread.status !== "resolved") {
      return;
    }

    try {
      await setDoc(
        doc(db, "support_threads", selectedThread.id),
        {
          status: "in_review",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (user) {
        await loadThreads(user);
      }
      addToast("Tiket dibuka ulang. Admin akan menindaklanjuti.", "success");
    } catch {
      addToast("Gagal membuka ulang tiket.", "error");
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="section-kicker">Support Desk</p>
        <h1 className="section-title">Bantuan & Chat Admin</h1>
        <p className="max-w-3xl text-sm text-foreground/75">
          Form dibuat ringkas: pilih kategori, kirim pesan awal, lalu lanjut chat sampai selesai.
        </p>
      </header>

      {!user ? (
        <div className="gold-card p-5 text-sm text-foreground/80">
          Login dulu untuk membuka tiket bantuan dan chat admin.
        </div>
      ) : null}

      {user ? (
        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <aside className="gold-card space-y-4 p-4 sm:p-5">
            <h2 className="subtitle-strong">Buat Tiket Baru (Singkat)</h2>
            <form className="grid gap-3" onSubmit={onCreateThread}>
              <label className="grid gap-1 text-sm">
                <span>Kategori</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="input-luxury"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>Pesan</span>
                <textarea
                  value={initialMessage}
                  onChange={(event) => setInitialMessage(event.target.value)}
                  rows={4}
                  className="input-luxury"
                  placeholder="Jelaskan kendala kamu secara singkat."
                />
              </label>

              <button
                type="submit"
                disabled={isSubmittingThread}
                className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60"
              >
                {isSubmittingThread ? "Mengirim..." : "Kirim Tiket"}
              </button>
            </form>

            <div className="space-y-2">
              <h3 className="subtitle-strong">Tiket Saya</h3>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {isLoading ? <p className="text-sm text-foreground/70">Memuat tiket...</p> : null}
                {!isLoading && threads.length === 0 ? (
                  <p className="text-sm text-foreground/70">Belum ada tiket bantuan.</p>
                ) : null}
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
                    <p className="text-xs uppercase tracking-wide text-foreground/60">{thread.status}</p>
                    <p className="mt-1 line-clamp-2 text-foreground/75">{thread.lastMessage}</p>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="gold-card flex min-h-115 flex-col p-4 sm:p-5">
            {!selectedThread ? (
              <div className="my-auto rounded-2xl border border-dashed border-[--gold-soft] p-6 text-center text-sm text-foreground/70">
                Pilih tiket untuk melihat percakapan dengan admin.
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-2xl border border-[--gold-soft] bg-white/70 p-3">
                  <p className="font-semibold text-[--maroon]">{selectedThread.subject}</p>
                  <p className="text-xs text-foreground/70">
                    Kategori: {selectedThread.category} · Status: {selectedThread.status} · Update: {formatTimestamp(selectedThread.updatedAt)}
                  </p>
                </div>

                <div className="imessage-thread">
                  {messages.length === 0 ? (
                    <p className="text-sm text-foreground/70">Belum ada pesan.</p>
                  ) : null}
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
                            message.senderRole === "user" ? "imessage-row-user" : "imessage-row-peer"
                          }`}
                        >
                          <div
                            className={`imessage-bubble ${
                              message.senderRole === "user" ? "imessage-bubble-user" : "imessage-bubble-peer"
                            }`}
                          >
                            <p className="text-[11px] opacity-80">{message.senderRole === "user" ? "Kamu" : "Admin"}</p>
                            <p className="imessage-message-text">{message.text}</p>
                            <p className="imessage-meta">{formatTimestamp(message.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedThread.status === "resolved" ? (
                  <button
                    type="button"
                    onClick={() => void onReopenResolvedThread()}
                    className="button-outline mb-3 inline-flex w-fit"
                  >
                    Buka Ulang Tiket
                  </button>
                ) : null}

                <div className="imessage-composer grid gap-2 sm:grid-cols-[1fr,auto]">
                  <textarea
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    rows={2}
                    className="input-luxury"
                    placeholder="Tulis pesan ke admin..."
                  />
                  <button
                    type="button"
                    onClick={() => void onSendMessage()}
                    disabled={isSendingMessage}
                    className="imessage-send-button"
                    aria-label="Kirim pesan"
                    title="Kirim pesan"
                  >
                    {isSendingMessage ? (
                      "..."
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                        <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </section>
  );
}
