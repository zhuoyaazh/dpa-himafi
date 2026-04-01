"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { submitVote } from "@/lib/voting";
import { db, getFirebaseAuth } from "@/lib/firebase";
import {
  extractNimFromCampusEmail,
  getVoterIdentityError,
} from "@/lib/voter-identity";
import { CANDIDATES } from "@/lib/candidates";
import { useToast, ToastContainer } from "@/components/toast-notification";
import { useVotingCountdown } from "@/lib/voting-countdown";

export default function VotingPage() {
  const countdown = useVotingCountdown();
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [candidateId, setCandidateId] = useState(CANDIDATES[0].id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [isCheckingVotingGate, setIsCheckingVotingGate] = useState(true);
  const { toasts, addToast, removeToast } = useToast();
  const derivedNim = useMemo(
    () => extractNimFromCampusEmail(user?.email),
    [user?.email],
  );

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    async function loadVotingGate() {
      try {
        setIsCheckingVotingGate(true);
        const gateSnapshot = await getDoc(doc(db, "site_settings", "voting_gate"));

        if (!gateSnapshot.exists()) {
          setIsVotingOpen(true);
          return;
        }

        const data = gateSnapshot.data() as { isOpen?: boolean };
        setIsVotingOpen(data.isOpen !== false);
      } catch {
        setIsVotingOpen(true);
      } finally {
        setIsCheckingVotingGate(false);
      }
    }

    void loadVotingGate();
  }, []);

  // Auto-close voting gate at 23:59
  useEffect(() => {
    if (countdown.isExpired && isVotingOpen) {
      async function autoCloseVotingGate() {
        try {
          await setDoc(
            doc(db, "site_settings", "voting_gate"),
            {
              isOpen: false,
              autoClosedAt: serverTimestamp(),
              closedReason: "Auto-closed at 2026-04-01 23:59 WIB",
            },
            { merge: true }
          );
          setIsVotingOpen(false);
          addToast("Voting otomatis ditutup sesuai jadwal. Terima kasih!", "info");
        } catch (error) {
          console.error("Failed to auto-close voting gate:", error);
        }
      }
      void autoCloseVotingGate();
    }
  }, [countdown.isExpired, isVotingOpen, addToast]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      const msg = "Kamu harus login dulu sebelum voting.";
      setStatusMessage(msg);
      addToast(msg, "error");
      return;
    }

    if (!isVotingOpen) {
      const msg = "Voting sedang ditutup oleh panitia. Tunggu gate dibuka.";
      setStatusMessage(msg);
      addToast(msg, "warning");
      return;
    }

    if (!derivedNim) {
      const msg = "Email login tidak memuat format NIM yang valid untuk voting.";
      setStatusMessage(msg);
      addToast(msg, "error");
      return;
    }

    const voterIdentityError = getVoterIdentityError(derivedNim, user.email);
    if (voterIdentityError) {
      setStatusMessage(voterIdentityError);
      addToast(voterIdentityError, "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const loadingMsg = "Mengirim suara...";
      setStatusMessage(loadingMsg);

      await submitVote({
        nim: derivedNim,
        candidateId,
      });

      const successMsg = "Voting berhasil disubmit. Terima kasih!";
      setStatusMessage(successMsg);
      addToast(successMsg, "success");
      setCandidateId(CANDIDATES[0].id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kendala saat submit voting.";
      setStatusMessage(message);
      addToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 overflow-x-hidden">
      <header className="space-y-2">
        <p className="section-kicker">Golden Ballot</p>
        <h1 className="section-title">Halaman Voting</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
        Submit voting dilakukan berdasarkan validasi akun yang sudah login dan NIM.
        Data suara tersimpan terpisah dari data identitas untuk menjaga anonimitas.
        </p>
      </header>

      {isCheckingAuth ? (
        <div className="gold-card overflow-hidden p-4 text-sm">
          Mengecek status login...
        </div>
      ) : null}

      {!isCheckingAuth && !user ? (
        <div className="gold-card space-y-2 overflow-hidden p-4 text-sm">
          <p>Kamu wajib login dulu untuk mengakses form voting.</p>
          <Link
            href="/login"
            className="button-gold inline-flex w-fit"
          >
            Login Sekarang
          </Link>
        </div>
      ) : null}

      <article className="gold-card overflow-hidden p-4 text-sm sm:p-6">
        <p className="subtitle-strong">Panduan Voting</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-foreground/80">
          <li>Pastikan sudah login dengan email kampus ITB yang valid.</li>
          <li>NIM akan terdeteksi otomatis dari email login, lalu pilih kandidat.</li>
          <li>Klik Submit Voting satu kali dan tunggu konfirmasi berhasil.</li>
        </ol>
      </article>

      {user ? (
        <form
          onSubmit={onSubmit}
          className="gold-card grid gap-4 overflow-hidden p-4 text-sm sm:p-6"
        >
        <div className="rounded-2xl border border-[--gold-soft] bg-white/65 p-4 text-foreground/80">
          Status Gate Voting: {isCheckingVotingGate
            ? "Mengecek..."
            : isVotingOpen
              ? "Dibuka"
              : "Ditutup"}
        </div>

        <div className="min-w-0 rounded-2xl border border-[--gold-soft] bg-white/65 p-4 text-foreground/80">
          Login sebagai:{" "}
          <span className="mt-1 block w-fit max-w-full font-semibold sm:mt-0 sm:inline whitespace-nowrap">
            {user.email}
          </span>
          . NIM terdeteksi otomatis dari bagian awal email kampus.
        </div>
        <label className="grid min-w-0 gap-1">
          <span className="font-semibold text-[--maroon]">NIM</span>
          <input
            value={derivedNim}
            readOnly
            className="input-luxury w-full min-w-0"
            placeholder="NIM otomatis dari email"
          />
        </label>

        <label className="grid min-w-0 gap-1">
          <span className="font-semibold text-[--maroon]">Pilih Kandidat</span>
          <select
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
            className="input-luxury w-full min-w-0"
          >
            {CANDIDATES.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.ballotNumber} · {candidate.name} — {candidate.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={isSubmitting || !isVotingOpen || isCheckingVotingGate || !derivedNim}
          className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting ? "Mengirim..." : "Submit Voting"}
        </button>

        <p className="wrap-break-word text-foreground/80">Status: {statusMessage || "-"}</p>
        </form>
      ) : null}
      
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </section>
  );
}

