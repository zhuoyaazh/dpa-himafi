"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { submitVote } from "@/lib/voting";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { getVoterIdentityError, normalizeNim } from "@/lib/voter-identity";
import { CANDIDATES } from "@/lib/candidates";

export default function VotingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [nim, setNim] = useState("");
  const [candidateId, setCandidateId] = useState(CANDIDATES[0].id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [isCheckingVotingGate, setIsCheckingVotingGate] = useState(true);

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setStatusMessage("Kamu harus login dulu sebelum voting.");
      return;
    }

    if (!isVotingOpen) {
      setStatusMessage("Voting sedang ditutup oleh panitia. Tunggu gate dibuka.");
      return;
    }

    if (!nim.trim()) {
      setStatusMessage("NIM wajib diisi.");
      return;
    }

    const sanitizedNim = normalizeNim(nim);
    if (!sanitizedNim) {
      setStatusMessage("NIM tidak valid.");
      return;
    }

    const voterIdentityError = getVoterIdentityError(sanitizedNim, user.email);
    if (voterIdentityError) {
      setStatusMessage(voterIdentityError);
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage("Mengirim suara...");

      await submitVote({
        nim: sanitizedNim,
        candidateId,
      });

      setStatusMessage("Voting berhasil disubmit. Terima kasih!");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kendala saat submit voting.";
      setStatusMessage(message);
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
          <li>Isi NIM sesuai awal email login, lalu pilih kandidat.</li>
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
          . NIM wajib sesuai bagian awal email kampus.
        </div>
        <label className="grid min-w-0 gap-1">
          <span className="font-semibold text-[--maroon]">NIM</span>
          <input
            value={nim}
            onChange={(event) => setNim(event.target.value)}
            required
            className="input-luxury w-full min-w-0"
            placeholder="Masukkan NIM"
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
          disabled={isSubmitting || !isVotingOpen || isCheckingVotingGate}
          className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting ? "Mengirim..." : "Submit Voting"}
        </button>

        <p className="wrap-break-word text-foreground/80">Status: {statusMessage || "-"}</p>
        </form>
      ) : null}
    </section>
  );
}

