"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { normalizeNim } from "@/lib/voter-identity";

type HearingPhase = "presensiAwal" | "presensiAkhir";

type HearingSettings = {
  sessionId?: string;
  sessionName?: string;
  isActive: boolean;
  presensiAwalAktif: boolean;
  presensiAkhirAktif: boolean;
  presensiAwalToken: string;
  presensiAkhirToken: string;
};

const UPLOAD_TIMEOUT_MS = 30000;

type HearingAttendance = {
  checkInAt?: Timestamp;
  checkOutAt?: Timestamp;
  presensiAwalAt?: Timestamp;
  presensiAkhirAt?: Timestamp;
};

function getNimFromEmail(email: string | null | undefined) {
  if (!email) {
    return "";
  }

  const [localPart = ""] = email.split("@");
  return normalizeNim(localPart);
}

async function uploadBuktiKehadiran(fileBukti: File) {
  const formData = new FormData();
  formData.append("file", fileBukti);
  formData.append(
    "upload_preset",
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET as string,
  );

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
        signal: controller.signal,
      },
    );

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message || "Upload bukti kehadiran gagal.");
    }

    return data.secure_url as string;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Upload bukti kehadiran timeout (lebih dari 30 detik).");
    }

    throw error instanceof Error ? error : new Error("Upload bukti kehadiran gagal.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function HearingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phase, setPhase] = useState<HearingPhase>("presensiAwal");
  const [token, setToken] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<HearingSettings | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const nimFromEmail = useMemo(() => getNimFromEmail(user?.email), [user?.email]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);
    });

    return unsubscribe;
  }, []);

  const mapRawSettings = useCallback((data: {
    sessionName?: string;
    isActive?: boolean;
    presensiAwalAktif?: boolean;
    presensiAkhirAktif?: boolean;
    presensiAwalToken?: string;
    presensiAkhirToken?: string;
    checkInToken?: string;
    checkOutToken?: string;
  }): HearingSettings => {
    return {
      sessionName: data.sessionName,
      isActive: Boolean(data.isActive),
      presensiAwalAktif: Boolean(data.presensiAwalAktif ?? true),
      presensiAkhirAktif: Boolean(data.presensiAkhirAktif ?? true),
      presensiAwalToken: String(data.presensiAwalToken ?? data.checkInToken ?? ""),
      presensiAkhirToken: String(data.presensiAkhirToken ?? data.checkOutToken ?? ""),
    };
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setIsLoadingSettings(true);
      const currentSnapshot = await getDoc(doc(db, "hearing_settings", "current"));

      if (currentSnapshot.exists()) {
        const currentData = currentSnapshot.data() as {
          activeSessionId?: string;
          isActive?: boolean;
          presensiAwalAktif?: boolean;
          presensiAkhirAktif?: boolean;
          presensiAwalToken?: string;
          presensiAkhirToken?: string;
          checkInToken?: string;
          checkOutToken?: string;
        };

        const activeSessionId = currentData.activeSessionId?.trim() ?? "";

        if (activeSessionId) {
          const sessionSnapshot = await getDoc(doc(db, "hearing_sessions", activeSessionId));

          if (sessionSnapshot.exists()) {
            const sessionData = sessionSnapshot.data() as {
              name?: string;
              isActive?: boolean;
              presensiAwalAktif?: boolean;
              presensiAkhirAktif?: boolean;
              presensiAwalToken?: string;
              presensiAkhirToken?: string;
              checkInToken?: string;
              checkOutToken?: string;
            };

            setSettings({
              ...mapRawSettings({ ...sessionData, sessionName: sessionData.name }),
              sessionId: activeSessionId,
            });
            setStatusMessage("Pengaturan presensi berhasil dimuat.");
            return;
          }

          setSettings(null);
          setStatusMessage("Sesi aktif tidak ditemukan. Minta admin simpan ulang sesi presensi.");
          return;
        }

        const hasLegacyCurrentConfig = Boolean(
          currentData.presensiAwalToken
          || currentData.presensiAkhirToken
          || currentData.checkInToken
          || currentData.checkOutToken,
        );

        if (hasLegacyCurrentConfig) {
          setSettings({
            ...mapRawSettings({ ...currentData, isActive: true }),
            sessionId: "legacy-current",
            sessionName: "Konfigurasi Lama",
          });
          setStatusMessage("Pengaturan presensi dimuat dari konfigurasi lama.");
          return;
        }

        setSettings(null);
        setStatusMessage("Presensi belum diaktifkan admin. Pilih sesi lalu klik Simpan di halaman admin.");
        return;
      }

      const latestSessions = await getDocs(
        query(collection(db, "hearing_sessions"), orderBy("updatedAt", "desc"), limit(20)),
      );

      if (!latestSessions.empty) {
        const activeDoc = latestSessions.docs.find((sessionDoc) => {
          const sessionData = sessionDoc.data() as { isActive?: boolean };
          return sessionData.isActive === true;
        });

        if (!activeDoc) {
          setSettings(null);
          setStatusMessage("Belum ada sesi presensi yang aktif.");
          return;
        }

        const latestData = activeDoc.data() as {
          name?: string;
          isActive?: boolean;
          presensiAwalAktif?: boolean;
          presensiAkhirAktif?: boolean;
          presensiAwalToken?: string;
          presensiAkhirToken?: string;
          checkInToken?: string;
          checkOutToken?: string;
        };

        setSettings({
          ...mapRawSettings({ ...latestData, sessionName: latestData.name }),
          sessionId: activeDoc.id,
        });
        setStatusMessage("Pengaturan presensi dimuat dari sesi aktif terbaru.");
        return;
      }

      setSettings(null);
      setStatusMessage("Pengaturan presensi hearing belum tersedia. Minta admin buat dan aktifkan sesi presensi dulu.");
    } catch {
      setStatusMessage("Gagal memuat pengaturan presensi hearing.");
    } finally {
      setIsLoadingSettings(false);
    }
  }, [mapRawSettings]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadSettings();
  }, [user, loadSettings]);

  function onChangeProofFile(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setProofFile(selectedFile);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.email) {
      setStatusMessage("Kamu harus login dulu untuk presensi hearing.");
      return;
    }

    if (!nimFromEmail) {
      setStatusMessage("NIM tidak bisa dibaca dari email akun.");
      return;
    }

    if (!settings) {
      setStatusMessage("Pengaturan presensi belum tersedia. Minta admin aktifkan sesi presensi dulu.");
      return;
    }

    if (!settings.isActive) {
      setStatusMessage("Presensi hearing sedang nonaktif.");
      return;
    }

    const phaseActive =
      phase === "presensiAwal" ? settings.presensiAwalAktif : settings.presensiAkhirAktif;
    if (!phaseActive) {
      setStatusMessage(
        phase === "presensiAwal"
          ? "Presensi awal sedang nonaktif."
          : "Presensi akhir sedang nonaktif.",
      );
      return;
    }

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setStatusMessage("Token presensi wajib diisi.");
      return;
    }

    const expectedToken = phase === "presensiAwal" ? settings.presensiAwalToken : settings.presensiAkhirToken;
    if (trimmedToken !== expectedToken) {
      setStatusMessage("Token tidak valid untuk fase presensi ini.");
      return;
    }

    if (!proofFile) {
      setStatusMessage("Upload Bukti Kehadiran wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage("Mengunggah bukti kehadiran...");

      const proofUrl = await uploadBuktiKehadiran(proofFile);
      const attendanceRef = doc(db, "hearing_attendance", nimFromEmail);

      await runTransaction(db, async (transaction) => {
        const attendanceSnapshot = await transaction.get(attendanceRef);
        const attendanceData = attendanceSnapshot.data() as HearingAttendance | undefined;

        const alreadyPresensiAwal = Boolean(attendanceData?.presensiAwalAt ?? attendanceData?.checkInAt);
        const alreadyPresensiAkhir = Boolean(attendanceData?.presensiAkhirAt ?? attendanceData?.checkOutAt);

        if (phase === "presensiAwal" && alreadyPresensiAwal) {
          throw new Error("Presensi awal sudah pernah tercatat.");
        }

        if (phase === "presensiAkhir" && alreadyPresensiAkhir) {
          throw new Error("Presensi akhir sudah pernah tercatat.");
        }

        const hasPresensiAwal = phase === "presensiAwal" || alreadyPresensiAwal;
        const hasPresensiAkhir = phase === "presensiAkhir" || alreadyPresensiAkhir;

        const classification = hasPresensiAwal && hasPresensiAkhir
          ? "awal_akhir"
          : hasPresensiAwal
            ? "awal_only"
            : hasPresensiAkhir
              ? "akhir_only"
              : "tidak_valid";

        const isStatusHearing = hasPresensiAwal && hasPresensiAkhir;

        transaction.set(
          attendanceRef,
          {
            nim: nimFromEmail,
            uid: user.uid,
            email: user.email,
            statusHearing: isStatusHearing,
            status_hearing: isStatusHearing,
            classification,
            updatedAt: serverTimestamp(),
            ...(phase === "presensiAwal"
              ? {
                  presensiAwalAt: serverTimestamp(),
                  presensiAwalProofUrl: proofUrl,
                  presensiAwalTokenUsed: trimmedToken,
                  checkInAt: serverTimestamp(),
                  checkInProofUrl: proofUrl,
                  checkInTokenUsed: trimmedToken,
                }
              : {
                  presensiAkhirAt: serverTimestamp(),
                  presensiAkhirProofUrl: proofUrl,
                  presensiAkhirTokenUsed: trimmedToken,
                  checkOutAt: serverTimestamp(),
                  checkOutProofUrl: proofUrl,
                  checkOutTokenUsed: trimmedToken,
                }),
          },
          { merge: true },
        );
      });

      setProofFile(null);
      setToken("");
      setStatusMessage("Presensi hearing berhasil tercatat.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Presensi hearing gagal diproses.";
      setStatusMessage(text);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 overflow-x-hidden">
      <header className="space-y-2">
        <p className="section-kicker">Hearing Attendance</p>
        <h1 className="section-title">Presensi Hearing</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
          Presensi awal dan presensi akhir wajib menggunakan token panitia serta Upload Bukti Kehadiran.
        </p>
      </header>

      {isCheckingAuth ? (
        <div className="gold-card overflow-hidden p-4 text-sm">Mengecek status login...</div>
      ) : null}

      {!isCheckingAuth && !user ? (
        <div className="gold-card space-y-3 overflow-hidden p-4 text-sm">
          <p>Kamu harus login dulu untuk melakukan presensi hearing.</p>
          <Link href="/login" className="button-gold inline-flex w-fit">
            Login Sekarang
          </Link>
        </div>
      ) : null}

      {user ? (
        <form onSubmit={onSubmit} className="gold-card grid gap-4 overflow-hidden p-4 text-sm sm:p-6">
          <div className="rounded-2xl border border-[--gold-soft] bg-white/65 p-4 text-foreground/80">
            Login sebagai: <span className="break-all font-semibold">{user.email}</span>
            <br />
            NIM terdeteksi: <span className="font-semibold">{nimFromEmail || "-"}</span>
            {settings?.sessionName ? (
              <>
                <br />
                Sesi aktif: <span className="font-semibold">{settings.sessionName}</span>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPhase("presensiAwal")}
              className={phase === "presensiAwal" ? "button-gold inline-flex w-full justify-center sm:w-fit" : "button-outline inline-flex w-full justify-center sm:w-fit"}
            >
              Presensi Awal
            </button>
            <button
              type="button"
              onClick={() => setPhase("presensiAkhir")}
              className={phase === "presensiAkhir" ? "button-gold inline-flex w-full justify-center sm:w-fit" : "button-outline inline-flex w-full justify-center sm:w-fit"}
            >
              Presensi Akhir
            </button>
          </div>

          <label className="grid min-w-0 gap-1">
            <span className="font-semibold text-[--maroon]">Token Presensi</span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="input-luxury"
              placeholder={phase === "presensiAwal" ? "Masukkan token presensi awal" : "Masukkan token presensi akhir"}
              required
            />
          </label>

          <label className="grid min-w-0 gap-1">
            <span className="font-semibold text-[--maroon]">Upload Bukti Kehadiran</span>
            <input
              type="file"
              accept="image/*"
              className="input-luxury"
              onChange={onChangeProofFile}
              required
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting || isLoadingSettings}
              className="button-gold inline-flex w-full justify-center disabled:opacity-60 sm:w-fit"
            >
              {isSubmitting ? "Memproses..." : phase === "presensiAwal" ? "Kirim Presensi Awal" : "Kirim Presensi Akhir"}
            </button>
            <button
              type="button"
              onClick={() => void loadSettings()}
              className="button-outline inline-flex w-full justify-center disabled:opacity-60 sm:w-fit"
              disabled={isLoadingSettings}
            >
              {isLoadingSettings ? "Memuat..." : "Refresh Pengaturan"}
            </button>
          </div>

          <p className="wrap-break-word text-foreground/80">Status: {statusMessage || "-"}</p>
        </form>
      ) : null}
    </section>
  );
}
