"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { normalizeNim } from "@/lib/voter-identity";

type UserBiodata = {
  nim?: string;
  angkatan?: number;
  statusHearing?: boolean;
  sudahVote?: boolean;
  selfieUrl?: string;
  voterEmail?: string;
  voterUid?: string;
};

type RawUserBiodata = {
  nim?: string;
  angkatan?: number;
  statusHearing?: boolean;
  status_hearing?: boolean;
  sudahVote?: boolean;
  sudah_vote?: boolean;
  selfieUrl?: string;
  foto_selfie_url?: string;
  voterEmail?: string;
  voter_email?: string;
  voterUid?: string;
  voter_uid?: string;
};

function getNimFromEmail(email: string | null | undefined) {
  if (!email) {
    return "";
  }

  const [localPart = ""] = email.split("@");
  return normalizeNim(localPart);
}

export default function ProfilPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [biodata, setBiodata] = useState<UserBiodata | null>(null);

  const nimFromEmail = useMemo(() => getNimFromEmail(user?.email), [user?.email]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    async function loadBiodata() {
      if (!user) {
        setBiodata(null);
        setStatusMessage("Silakan login untuk melihat profil user.");
        return;
      }

      if (!nimFromEmail) {
        setBiodata(null);
        setStatusMessage("NIM tidak bisa dibaca dari email akun.");
        return;
      }

      try {
        setIsLoadingData(true);
        setStatusMessage("Mengambil biodata...");

        const snapshot = await getDoc(doc(db, "users", nimFromEmail));

        if (!snapshot.exists()) {
          setBiodata(null);
          setStatusMessage("Data biodata belum ditemukan untuk akun ini.");
          return;
        }

        const data = snapshot.data() as RawUserBiodata;
        setBiodata({
          nim: data.nim ?? nimFromEmail,
          angkatan: typeof data.angkatan === "number" ? data.angkatan : undefined,
          statusHearing: Boolean(data.statusHearing ?? data.status_hearing),
          sudahVote: Boolean(data.sudahVote ?? data.sudah_vote),
          selfieUrl: data.selfieUrl ?? data.foto_selfie_url,
          voterEmail: data.voterEmail ?? data.voter_email,
          voterUid: data.voterUid ?? data.voter_uid,
        });
        setStatusMessage("Biodata berhasil dimuat.");
      } catch {
        setBiodata(null);
        setStatusMessage("Gagal mengambil biodata user.");
      } finally {
        setIsLoadingData(false);
      }
    }

    void loadBiodata();
  }, [user, nimFromEmail]);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 overflow-x-hidden">
      <header className="space-y-2">
        <p className="section-kicker">User Account</p>
        <h1 className="section-title">Profil User</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
          Halaman ini menampilkan biodata singkat akun kamu setelah login.
        </p>
      </header>

      {isCheckingAuth ? (
        <div className="gold-card overflow-hidden p-4 text-sm">Mengecek status login...</div>
      ) : null}

      {!isCheckingAuth && !user ? (
        <div className="gold-card space-y-3 overflow-hidden p-4 text-sm">
          <p>Kamu harus login dulu untuk membuka profil user.</p>
          <Link href="/login" className="button-gold inline-flex w-fit">
            Login Sekarang
          </Link>
        </div>
      ) : null}

      {user ? (
        <div className="gold-card grid gap-4 overflow-hidden p-4 text-sm sm:p-6">
          <div className="min-w-0 rounded-2xl border border-[--gold-soft] bg-white/70 p-4 leading-7">
            <p>Email Login: <span className="break-all">{user.email ?? "-"}</span></p>
            <p>UID Auth: <span className="break-all">{user.uid}</span></p>
            <p>NIM dari Email: {nimFromEmail || "-"}</p>
          </div>

          {isLoadingData ? <p>Memuat biodata...</p> : null}

          {biodata ? (
            <div className="min-w-0 rounded-2xl border border-[--gold-soft] bg-white/70 p-4 leading-7">
              <p>NIM: {biodata.nim ?? "-"}</p>
              <p>Angkatan: {biodata.angkatan ?? "-"}</p>
              <p>Status Hearing: {biodata.statusHearing ? "Hadir" : "Tidak hadir"}</p>
              <p>Sudah Vote: {biodata.sudahVote ? "Ya" : "Belum"}</p>
              <p>Selfie Verifikasi: {biodata.selfieUrl ? "Tersimpan" : "Belum ada"}</p>
              <p>Voter Email Tercatat: <span className="break-all">{biodata.voterEmail ?? "-"}</span></p>
              <p>Voter UID Tercatat: <span className="break-all">{biodata.voterUid ?? "-"}</span></p>
            </div>
          ) : null}

          <p className="break-words text-foreground/80">Status: {statusMessage || "-"}</p>
        </div>
      ) : null}
    </section>
  );
}
