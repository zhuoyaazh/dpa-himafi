"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { submitVote } from "@/lib/voting";
import { getFirebaseAuth } from "@/lib/firebase";
import { getVoterIdentityError, normalizeNim } from "@/lib/voter-identity";
import { CANDIDATES } from "@/lib/candidates";

export default function VotingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [nim, setNim] = useState("");
  const [candidateId, setCandidateId] = useState(CANDIDATES[0].id);
  const [isHearingAttendee, setIsHearingAttendee] = useState(false);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  const hearingWeight = useMemo<1 | 2>(
    () => (isHearingAttendee ? 2 : 1),
    [isHearingAttendee],
  );

  const uploadFotoKeCloudinary = async (fileFoto: File) => {
    const formData = new FormData();
    formData.append("file", fileFoto);
    formData.append(
      "upload_preset",
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET as string,
    );

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok || !data.secure_url) {
        throw new Error(data.error?.message || "Upload Cloudinary gagal.");
      }

      return data.secure_url as string;
    } catch (error) {
      console.error("Gagal upload ke Cloudinary:", error);
      alert("Gagal mengunggah foto. Pastikan koneksi stabil.");
      return null;
    }
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setStatusMessage("Kamu harus login dulu sebelum voting.");
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

    if (!selfieFile) {
      setStatusMessage("Selfie wajib diupload sebelum submit voting.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage("Mengunggah selfie...");

      const selfieUrl = await uploadFotoKeCloudinary(selfieFile);
      if (!selfieUrl) {
        setStatusMessage("Upload selfie gagal. Coba lagi.");
        return;
      }

      setStatusMessage("Mengirim suara...");

      await submitVote({
        nim: sanitizedNim,
        candidateId,
        hearingWeight,
        selfieFile,
        selfieUrl,
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
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="section-kicker">Golden Ballot</p>
        <h1 className="section-title">Halaman Voting</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
        Submit voting dilakukan dengan upload selfie verifikasi. Data identitas
        disimpan di koleksi terpisah dari data suara untuk menjaga anonimitas.
        </p>
      </header>

      {isCheckingAuth ? (
        <div className="gold-card p-4 text-sm">
          Mengecek status login...
        </div>
      ) : null}

      {!isCheckingAuth && !user ? (
        <div className="gold-card space-y-2 p-4 text-sm">
          <p>Kamu wajib login dulu untuk mengakses form voting.</p>
          <Link
            href="/login"
            className="button-gold inline-flex w-fit"
          >
            Login Sekarang
          </Link>
        </div>
      ) : null}

      {user ? (
        <form
          onSubmit={onSubmit}
          className="gold-card grid gap-4 p-6 text-sm"
        >
        <div className="rounded-2xl border border-[--gold-soft] bg-white/65 p-4 text-foreground/80">
          Login sebagai: <span className="font-semibold">{user.email}</span>. NIM wajib sesuai bagian awal email kampus.
        </div>
        <label className="grid gap-1">
          <span className="font-semibold text-[--maroon]">NIM</span>
          <input
            value={nim}
            onChange={(event) => setNim(event.target.value)}
            required
            className="input-luxury"
            placeholder="Masukkan NIM"
          />
        </label>

        <label className="grid gap-1">
          <span className="font-semibold text-[--maroon]">Pilih Kandidat</span>
          <select
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
            className="input-luxury"
          >
            {CANDIDATES.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.ballotNumber} · {candidate.name} — {candidate.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 rounded-2xl border border-[--gold-soft] bg-white/60 px-4 py-3">
          <input
            type="checkbox"
            checked={isHearingAttendee}
            onChange={(event) => setIsHearingAttendee(event.target.checked)}
          />
          <span>Peserta hearing (bobot suara 2)</span>
        </label>

        <label className="grid gap-1">
          <span className="font-semibold text-[--maroon]">Upload Selfie Verifikasi</span>
          <input
            type="file"
            accept="image/*"
            required
            onChange={(event) => setSelfieFile(event.target.files?.[0] ?? null)}
            className="input-luxury"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="button-gold inline-flex w-fit items-center justify-center disabled:opacity-60"
        >
          {isSubmitting ? "Mengirim..." : "Submit Voting"}
        </button>

        <p className="text-sm text-foreground/80">Status: {statusMessage || "-"}</p>
        </form>
      ) : null}
    </section>
  );
}

