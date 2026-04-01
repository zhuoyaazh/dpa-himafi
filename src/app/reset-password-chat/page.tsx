"use client";

import { FormEvent, useMemo, useState } from "react";
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
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isCampusEmail, nimToCampusEmail } from "@/lib/voter-identity";
import { ToastContainer, useToast } from "@/components/toast-notification";

type TicketStatus = "open" | "in_review" | "resolved";

type PasswordResetChat = {
  id: string;
  requesterNim: string;
  requesterEmail: string;
  status: TicketStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastMessage?: string;
  lastSenderRole?: "user" | "admin";
};

type PasswordResetMessage = {
  id: string;
  text: string;
  senderRole: "user" | "admin";
  senderEmail: string;
  createdAt?: Timestamp;
};

function resolveIdentifierToEmail(value: string) {
  const clean = value.trim().toLowerCase();
  if (!clean) return "";
  if (clean.includes("@")) return clean;
  return nimToCampusEmail(clean);
}

function normalizeNim(value: string) {
  return value.trim().replace(/\D/g, "");
}

function generateTicketCode() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PR-${Date.now().toString().slice(-6)}-${random}`;
}

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

export default function ResetPasswordChatPage() {
  const [identifier, setIdentifier] = useState("");
  const [openingMessage, setOpeningMessage] = useState("");
  const [ticketCodeInput, setTicketCodeInput] = useState("");
  const [followupMessage, setFollowupMessage] = useState("");
  const [activeTicket, setActiveTicket] = useState<PasswordResetChat | null>(null);
  const [messages, setMessages] = useState<PasswordResetMessage[]>([]);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isLoadingTicket, setIsLoadingTicket] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const requesterEmail = useMemo(() => resolveIdentifierToEmail(identifier), [identifier]);
  const requesterNim = useMemo(() => normalizeNim(identifier), [identifier]);

  async function loadMessages(ticketId: string) {
    const snapshot = await getDocs(
      query(
        collection(db, "password_reset_chats", ticketId, "messages"),
        orderBy("createdAt", "asc"),
        limit(200),
      ),
    );

    const loaded = snapshot.docs.map((messageDoc) => {
      const data = messageDoc.data() as Omit<PasswordResetMessage, "id">;
      return { id: messageDoc.id, ...data };
    });

    setMessages(loaded);
  }

  async function onCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = requesterEmail;
    const cleanNim = requesterNim;
    const cleanOpeningMessage = openingMessage.trim();

    if (!cleanEmail || !isCampusEmail(cleanEmail)) {
      addToast("Gunakan NIM atau email kampus ITB yang valid.", "warning");
      return;
    }

    if (!cleanNim) {
      addToast("NIM wajib diisi untuk verifikasi reset password.", "warning");
      return;
    }

    if (!cleanOpeningMessage) {
      addToast("Pesan kendala wajib diisi.", "warning");
      return;
    }

    try {
      setIsCreatingTicket(true);

      const ticketId = generateTicketCode();
      const threadRef = doc(db, "password_reset_chats", ticketId);

      await setDoc(threadRef, {
        requesterNim: cleanNim,
        requesterEmail: cleanEmail,
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: cleanOpeningMessage,
        lastSenderRole: "user",
      });

      await addDoc(collection(db, "password_reset_chats", ticketId, "messages"), {
        text: cleanOpeningMessage,
        senderRole: "user",
        senderEmail: cleanEmail,
        createdAt: serverTimestamp(),
      });

      const createdTicket: PasswordResetChat = {
        id: ticketId,
        requesterNim: cleanNim,
        requesterEmail: cleanEmail,
        status: "open",
      };

      setActiveTicket(createdTicket);
      setTicketCodeInput(ticketId);
      setOpeningMessage("");
      setFollowupMessage("");
      await loadMessages(ticketId);
      addToast(`Tiket reset berhasil dibuat. Simpan kode: ${ticketId}`, "success", 7000);
    } catch {
      addToast("Gagal membuat tiket reset password.", "error");
    } finally {
      setIsCreatingTicket(false);
    }
  }

  async function onLoadTicketByCode() {
    const code = ticketCodeInput.trim();

    if (!code) {
      addToast("Masukkan kode tiket dulu.", "warning");
      return;
    }

    try {
      setIsLoadingTicket(true);

      const snapshot = await getDoc(doc(db, "password_reset_chats", code));
      if (!snapshot.exists()) {
        addToast("Kode tiket tidak ditemukan.", "error");
        return;
      }

      const data = snapshot.data() as Omit<PasswordResetChat, "id">;
      const ticket = { id: snapshot.id, ...data };

      setActiveTicket(ticket);
      setIdentifier(ticket.requesterNim || ticket.requesterEmail);
      await loadMessages(ticket.id);
      addToast("Tiket berhasil dimuat.", "success");
    } catch {
      addToast("Gagal memuat tiket.", "error");
    } finally {
      setIsLoadingTicket(false);
    }
  }

  async function onSendFollowupMessage() {
    if (!activeTicket) {
      return;
    }

    const cleanMessage = followupMessage.trim();
    if (!cleanMessage) {
      addToast("Pesan tidak boleh kosong.", "warning");
      return;
    }

    try {
      setIsSendingMessage(true);

      await addDoc(collection(db, "password_reset_chats", activeTicket.id, "messages"), {
        text: cleanMessage,
        senderRole: "user",
        senderEmail: activeTicket.requesterEmail,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "password_reset_chats", activeTicket.id), {
        lastMessage: cleanMessage,
        lastSenderRole: "user",
        status: activeTicket.status === "resolved" ? "in_review" : activeTicket.status,
        updatedAt: serverTimestamp(),
      });

      setFollowupMessage("");
      await Promise.all([onLoadTicketByCode(), loadMessages(activeTicket.id)]);
    } catch {
      addToast("Gagal mengirim pesan lanjutan.", "error");
    } finally {
      setIsSendingMessage(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="section-kicker">Recovery Desk</p>
        <h1 className="section-title">Reset Password via Chat Admin</h1>
        <p className="max-w-3xl text-sm text-foreground/75">
          Alurnya dibuat singkat: isi NIM/email + kendala, kirim tiket, lalu lanjut chat sampai reset selesai.
        </p>
      </header>

      <div className="grid gap-6">
        <section className="gold-card space-y-4 p-5 sm:p-6">
          <h2 className="subtitle-strong">1) Buat Tiket Reset</h2>
          <form className="grid gap-3" onSubmit={onCreateTicket}>
            <label className="grid gap-1 text-sm">
              <span>NIM / Email ITB</span>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="input-luxury"
                placeholder="102xxxxx atau 102xxxxx@mahasiswa.itb.ac.id"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span>Pesan kendala</span>
              <textarea
                value={openingMessage}
                onChange={(event) => setOpeningMessage(event.target.value)}
                rows={3}
                className="input-luxury"
                placeholder="Contoh: Saya lupa password dan tidak bisa login"
              />
            </label>

            <button
              type="submit"
              disabled={isCreatingTicket}
              className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60"
            >
              {isCreatingTicket ? "Membuat tiket..." : "Buat Tiket Recovery"}
            </button>
              <p className="text-xs text-foreground/70">
                Setelah tiket dibuat, kode tiket otomatis muncul di bawah.
              </p>
          </form>
        </section>

        <section className="gold-card space-y-4 p-5 sm:p-6">
          <h2 className="subtitle-strong">2) Lanjutkan Chat Tiket</h2>
          <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
            <input
              value={ticketCodeInput}
              onChange={(event) => setTicketCodeInput(event.target.value.toUpperCase())}
              className="input-luxury"
              placeholder="Masukkan kode tiket (PR-...)"
            />
            <button
              type="button"
              onClick={() => void onLoadTicketByCode()}
              disabled={isLoadingTicket}
              className="button-outline inline-flex items-center justify-center disabled:opacity-60"
            >
              {isLoadingTicket ? "Memuat..." : "Buka Tiket"}
            </button>
          </div>

          {activeTicket ? (
            <div className="space-y-3 rounded-2xl border border-[--gold-soft] bg-white/70 p-3">
              <p className="text-sm">
                <span className="font-semibold text-[--maroon]">Kode:</span> {activeTicket.id}
              </p>
              <p className="text-sm">Status: {activeTicket.status}</p>
              <p className="text-sm text-foreground/70">Update terakhir: {formatTimestamp(activeTicket.updatedAt)}</p>

              <div className="imessage-thread max-h-64">
                {messages.length === 0 ? <p className="text-sm text-foreground/70">Belum ada pesan.</p> : null}
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
                          <p className="text-[11px] opacity-80">{message.senderRole === "user" ? "Kamu" : "Admin Recovery"}</p>
                          <p className="imessage-message-text">{message.text}</p>
                          <p className="imessage-meta">{formatTimestamp(message.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="imessage-composer grid gap-2 sm:grid-cols-[1fr,auto]">
                <textarea
                  value={followupMessage}
                  onChange={(event) => setFollowupMessage(event.target.value)}
                  rows={2}
                  className="input-luxury"
                  placeholder="Kirim pesan lanjutan ke admin recovery..."
                />
                <button
                  type="button"
                  onClick={() => void onSendFollowupMessage()}
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
            </div>
          ) : (
            <p className="text-sm text-foreground/70">Belum ada tiket yang dibuka.</p>
          )}
        </section>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </section>
  );
}
