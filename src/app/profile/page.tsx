"use client";

import { FormEvent, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeNim } from "@/lib/voter-identity";

type UserStatus = {
  nim: string;
  sudahVote: boolean;
  statusHearing: boolean;
  selfieUrl?: string;
  angkatan?: number;
};

type RawUserStatus = {
  nim?: string;
  sudahVote?: boolean;
  sudah_vote?: boolean;
  statusHearing?: boolean;
  status_hearing?: boolean;
  selfieUrl?: string;
  foto_selfie_url?: string;
  angkatan?: number;
};

export default function ProfilePage() {
  const [nim, setNim] = useState("");
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onCheckStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsLoading(true);
      setMessage("Mengecek data...");
      setStatus(null);

      const normalizedNim = normalizeNim(nim);
      if (!normalizedNim) {
        setMessage("NIM tidak valid.");
        return;
      }

      const snapshot = await getDoc(doc(db, "users", normalizedNim));

      if (!snapshot.exists()) {
        setMessage("Data user belum ditemukan.");
        return;
      }

      const data = snapshot.data() as RawUserStatus;
      setStatus({
        nim: data.nim ?? normalizedNim,
        sudahVote: Boolean(data.sudahVote ?? data.sudah_vote),
        statusHearing: Boolean(data.statusHearing ?? data.status_hearing),
        selfieUrl: data.selfieUrl ?? data.foto_selfie_url,
        angkatan:
          typeof data.angkatan === "number" && !Number.isNaN(data.angkatan)
            ? data.angkatan
            : undefined,
      });
      setMessage("Data user ditemukan.");
    } catch {
      setMessage("Gagal mengambil data user.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 overflow-x-hidden">
      <header className="space-y-2">
        <p className="section-kicker">Voter Ledger</p>
        <h1 className="section-title">Cek Status</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
        Menampilkan status akun pemilih: sudah voting/belum, hearing, dan data
        verifikasi.
        </p>
      </header>

      <form
        onSubmit={onCheckStatus}
        className="gold-card grid gap-4 overflow-hidden p-4 text-sm sm:p-6"
      >
        <label className="grid min-w-0 gap-1">
          <span className="font-semibold text-[--maroon]">Masukkan NIM</span>
          <input
            value={nim}
            onChange={(event) => setNim(event.target.value)}
            required
            inputMode="numeric"
            className="input-luxury"
            placeholder="Contoh: 102xxxxx"
          />
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60 sm:w-fit"
        >
          {isLoading ? "Mengecek..." : "Cek Status"}
        </button>

        <p className="break-words text-foreground/80">{message || "-"}</p>

        {status ? (
          <div className="min-w-0 rounded-2xl border border-[--gold-soft] bg-white/70 p-4 leading-7">
            <p>NIM: {status.nim}</p>
            <p>Angkatan: {status.angkatan ?? "-"}</p>
            <p>Sudah Vote: {status.sudahVote ? "Ya" : "Belum"}</p>
            <p>Status Hearing: {status.statusHearing ? "Peserta" : "Non-peserta"}</p>
            <p>Bobot Suara: {status.statusHearing ? 2 : 1}</p>
            <p>
              Selfie Verifikasi: {status.selfieUrl ? "Tersimpan" : "Belum ada"}
            </p>
          </div>
        ) : null}
      </form>
    </section>
  );
}