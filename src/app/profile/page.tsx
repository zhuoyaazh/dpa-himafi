"use client";

import { FormEvent, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeNim } from "@/lib/voter-identity";

type UserStatus = {
  nim: string;
  sudahVote: boolean;
  hasPresensiAwal: boolean;
  hasPresensiAkhir: boolean;
  hearingClassification: "awal_akhir" | "awal_only" | "akhir_only" | "tidak_valid";
  bobotSuara: number;
  angkatan?: number;
};

type RawUserStatus = {
  nim?: string;
  sudahVote?: boolean;
  sudah_vote?: boolean;
  statusHearing?: boolean;
  status_hearing?: boolean;
  hearingClassification?: "awal_akhir" | "awal_only" | "akhir_only" | "tidak_valid";
  presensiAwalAt?: unknown;
  presensiAkhirAt?: unknown;
  checkInAt?: unknown;
  checkOutAt?: unknown;
  bobotSuara?: number;
  angkatan?: number;
};

type RawHearingAttendance = {
  presensiAwalAt?: unknown;
  presensiAkhirAt?: unknown;
  checkInAt?: unknown;
  checkOutAt?: unknown;
  classification?: "awal_akhir" | "awal_only" | "akhir_only" | "tidak_valid";
};

function getHearingClassificationLabel(value: UserStatus["hearingClassification"]) {
  if (value === "awal_akhir") {
    return "Hadir Awal + Akhir";
  }

  if (value === "awal_only") {
    return "Hanya Presensi Awal";
  }

  if (value === "akhir_only") {
    return "Hanya Presensi Akhir";
  }

  return "Belum/Tidak Valid";
}

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

      const [snapshot, attendanceSnapshot] = await Promise.all([
        getDoc(doc(db, "users", normalizedNim)),
        getDoc(doc(db, "hearing_attendance", normalizedNim)),
      ]);

      if (!snapshot.exists() && !attendanceSnapshot.exists()) {
        setMessage("Data user belum ditemukan.");
        return;
      }

      const data = snapshot.exists() ? (snapshot.data() as RawUserStatus) : undefined;
      const attendance = attendanceSnapshot.exists()
        ? (attendanceSnapshot.data() as RawHearingAttendance)
        : undefined;

      const hasPresensiAwal = Boolean(
        attendance?.presensiAwalAt
        ?? attendance?.checkInAt
        ?? data?.presensiAwalAt
        ?? data?.checkInAt,
      );
      const hasPresensiAkhir = Boolean(
        attendance?.presensiAkhirAt
        ?? attendance?.checkOutAt
        ?? data?.presensiAkhirAt
        ?? data?.checkOutAt,
      );
      const hearingClassification = attendance?.classification
        ?? (hasPresensiAwal && hasPresensiAkhir
          ? "awal_akhir"
          : hasPresensiAwal
            ? "awal_only"
            : hasPresensiAkhir
              ? "akhir_only"
              : (data?.hearingClassification ?? "tidak_valid"));

      const parsedWeight = Number(data?.bobotSuara);
      const bobotSuara = parsedWeight === 1 || parsedWeight === 1.5 || parsedWeight === 2 ? parsedWeight : 1;

      setStatus({
        nim: data?.nim ?? normalizedNim,
        sudahVote: Boolean(data?.sudahVote ?? data?.sudah_vote),
        hasPresensiAwal,
        hasPresensiAkhir,
        hearingClassification,
        bobotSuara,
        angkatan:
          typeof data?.angkatan === "number" && !Number.isNaN(data.angkatan)
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
        Menampilkan status akun pemilih: sudah voting/belum dan status hearing.
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

        <p className="wrap-break-word text-foreground/80">{message || "-"}</p>

        {status ? (
          <div className="min-w-0 rounded-2xl border border-[--gold-soft] bg-white/70 p-4 leading-7">
            <p>NIM: {status.nim}</p>
            <p>Angkatan: {status.angkatan ?? "-"}</p>
            <p>Sudah Vote: {status.sudahVote ? "Ya" : "Belum"}</p>
            <p>Presensi Awal: {status.hasPresensiAwal ? "Hadir" : "Belum"}</p>
            <p>Presensi Akhir: {status.hasPresensiAkhir ? "Hadir" : "Belum"}</p>
            <p>Kategori Hearing: {getHearingClassificationLabel(status.hearingClassification)}</p>
            <p>Nilai Bobot: {status.bobotSuara}</p>
          </div>
        ) : null}
      </form>
    </section>
  );
}