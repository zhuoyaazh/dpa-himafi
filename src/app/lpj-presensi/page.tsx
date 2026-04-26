"use client";

import { useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { getFirebaseAuth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

type LpjSession = {
  id: string;
  name: string;
  isActive: boolean;
  presensiAwalAktif: boolean;
  presensiAkhirAktif: boolean;
  presensiAwalToken?: string;
  presensiAkhirToken?: string;
};

type LpjAttendanceRecord = {
  nim: string;
  nama: string;
  mode: "awal" | "akhir";
  photoUrl: string;
  submittedAt?: { seconds?: number };
};

export default function LpjPresensiPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [mode, setMode] = useState<"awal" | "akhir">("awal");
  const [session, setSession] = useState<LpjSession | null>(null);
  const [nim, setNim] = useState("");
  const [nama, setNama] = useState("");
  const [token, setToken] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [existingRecord, setExistingRecord] = useState<LpjAttendanceRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState("Memuat pengaturan presensi LPJ AT...");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedModeLabel = mode === "awal" ? "Presensi Awal" : "Presensi Akhir";
  const isCheckingAuth = !isAuthResolved;

  const uploadPrompt = photoPreview ? "Ganti Bukti Kehadiran" : "Upload Bukti Kehadiran";

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setCurrentUser(currentUser);
      setIsAuthResolved(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, "lpj_sessions"), where("isActive", "==", true)), (snapshot) => {
      if (!snapshot.empty) {
        const sessionDoc = snapshot.docs[0];
        setSession({
          id: sessionDoc.id,
          name: sessionDoc.data().name ?? "LPJ Session",
          isActive: sessionDoc.data().isActive ?? false,
          presensiAwalAktif: sessionDoc.data().presensiAwalAktif ?? false,
          presensiAkhirAktif: sessionDoc.data().presensiAkhirAktif ?? false,
          presensiAwalToken: sessionDoc.data().presensiAwalToken ?? sessionDoc.data().checkInToken ?? "",
          presensiAkhirToken: sessionDoc.data().presensiAkhirToken ?? sessionDoc.data().checkOutToken ?? "",
        });
        setStatusMessage("Pengaturan presensi LPJ AT berhasil dimuat.");
      } else {
        setSession(null);
        setStatusMessage("Belum ada sesi presensi LPJ AT yang aktif.");
      }
    }, () => {
      setStatusMessage("Gagal memuat pengaturan presensi LPJ AT.");
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!nim.trim() || !session) return;

    const checkExisting = async () => {
      try {
        const recordRef = doc(db, "lpj_attendance", `${session.id}_${nim}_${mode}`);
        const recordSnap = await getDoc(recordRef);

        if (recordSnap.exists()) {
          const data = recordSnap.data() as LpjAttendanceRecord;
          setExistingRecord(data);
          setNama(data.nama);
          setPhotoPreview(data.photoUrl);
        } else {
          setExistingRecord(null);
          setPhotoPreview("");
        }
      } catch {
        setExistingRecord(null);
      }
    };

    checkExisting();
  }, [nim, mode, session]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setMessage({ type: "error", text: "Format foto harus JPG, PNG, atau WebP" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Ukuran foto maksimal 5MB" });
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadPhotoToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
    formData.append("cloud_name", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Upload foto gagal");
    }

    const data = (await response.json()) as { secure_url?: string };
    return data.secure_url || "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!nim.trim()) {
      setMessage({ type: "error", text: "NIM harus diisi" });
      return;
    }

    if (!nama.trim()) {
      setMessage({ type: "error", text: "Nama harus diisi" });
      return;
    }

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setMessage({ type: "error", text: "Token presensi harus diisi" });
      return;
    }

    if (!photoFile && !existingRecord) {
      setMessage({ type: "error", text: "Foto kehadiran harus diupload" });
      return;
    }

    if (!session) {
      setMessage({ type: "error", text: "Sesi presensi tidak aktif. Hubungi admin." });
      return;
    }

    const expectedToken = mode === "awal" ? session.presensiAwalToken : session.presensiAkhirToken;
    if (trimmedToken !== expectedToken) {
      setMessage({ type: "error", text: "Token tidak valid untuk fase presensi ini" });
      return;
    }

    if (mode === "awal" && !session.presensiAwalAktif) {
      setMessage({ type: "error", text: "Presensi awal belum dibuka" });
      return;
    }

    if (mode === "akhir" && !session.presensiAkhirAktif) {
      setMessage({ type: "error", text: "Presensi akhir belum dibuka" });
      return;
    }

    setIsLoading(true);

    try {
      let photoUrl = photoPreview;

      if (photoFile) {
        photoUrl = await uploadPhotoToCloudinary(photoFile);
      }

      const recordId = `${session.id}_${nim}_${mode}`;
      await setDoc(
        doc(db, "lpj_attendance", recordId),
        {
          nim: nim.trim(),
          nama: nama.trim(),
          mode,
          photoUrl,
          submittedAt: new Date(),
        },
        { merge: false }
      );

      setMessage({ type: "success", text: `Presensi ${mode} berhasil disimpan!` });
      setPhotoFile(null);
      setPhotoPreview("");
      setNim("");
      setNama("");
      setToken("");
    } catch (error) {
      console.error("Submit error:", error);
      setMessage({ type: "error", text: "Terjadi error saat menyimpan. Coba lagi." });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthResolved) {
    return (
      <section className="page-shell">
        <div className="gold-card overflow-hidden p-4 text-sm">Mengecek status login...</div>
      </section>
    );
  }

  if (!currentUser) {
    return (
      <section className="page-shell">
        <div className="gold-card space-y-3 overflow-hidden p-4 text-sm">
          <p>Kamu harus login dulu untuk melakukan presensi LPJ AT.</p>
          <a href="/login" className="button-gold inline-flex w-fit">
            Login Sekarang
          </a>
        </div>
      </section>
    );
  }

  if (!session || (!session.presensiAwalAktif && !session.presensiAkhirAktif)) {
    return (
      <section className="page-shell">
        <div className="gold-card space-y-3 overflow-hidden p-4 text-sm">
          <p>Presensi LPJ AT belum dibuka. Hubungi admin jika ada pertanyaan.</p>
          <button type="button" onClick={() => window.location.reload()} className="button-outline inline-flex w-fit">
            Refresh Halaman
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 overflow-x-hidden">
      <header className="space-y-2">
        <p className="section-kicker">LPJ Attendance</p>
        <h1 className="section-title">Presensi LPJ Akhir Tahun</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
          Silakan pilih mode presensi, lalu isi NIM, nama, dan unggah bukti kehadiran.
        </p>
      </header>

      {isCheckingAuth ? (
        <div className="gold-card overflow-hidden p-4 text-sm">Mengecek status login...</div>
      ) : null}

      {!isCheckingAuth && !currentUser ? (
        <div className="gold-card space-y-3 overflow-hidden p-4 text-sm">
          <p>Kamu harus login dulu untuk melakukan presensi LPJ AT.</p>
          <a href="/login" className="button-gold inline-flex w-fit">
            Login Sekarang
          </a>
        </div>
      ) : null}

      {currentUser ? (
        <form onSubmit={handleSubmit} className="gold-card grid gap-4 overflow-hidden p-4 text-sm sm:p-6">
          <div className="rounded-2xl border border-[--gold-soft] bg-white/65 p-4 text-foreground/80">
            Login sebagai: <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom font-semibold">{currentUser.email}</span>
            <br />
            Sesi aktif: <span className="font-semibold text-[--maroon]">{session?.name ?? "-"}</span>
            <br />
            Mode aktif: <span className="font-semibold text-[--maroon]">{selectedModeLabel}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("awal")}
              className={mode === "awal" ? "button-gold inline-flex w-full justify-center sm:w-fit" : "button-outline inline-flex w-full justify-center sm:w-fit"}
            >
              Presensi Awal
            </button>
            <button
              type="button"
              onClick={() => setMode("akhir")}
              className={mode === "akhir" ? "button-gold inline-flex w-full justify-center sm:w-fit" : "button-outline inline-flex w-full justify-center sm:w-fit"}
            >
              Presensi Akhir
            </button>
          </div>

          <label className="grid min-w-0 gap-1">
            <span className="font-semibold text-[--maroon]">NIM</span>
            <input
              id="nim"
              type="text"
              value={nim}
              onChange={(e) => setNim(e.target.value)}
              placeholder="Masukkan NIM Anda"
              className="input-luxury"
            />
          </label>

          <label className="grid min-w-0 gap-1">
            <span className="font-semibold text-[--maroon]">Nama</span>
            <input
              id="nama"
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Masukkan nama lengkap"
              className="input-luxury"
            />
          </label>

          <label className="grid min-w-0 gap-1">
            <span className="font-semibold text-[--maroon]">Token Presensi</span>
            <input
              id="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Masukkan token presensi"
              className="input-luxury"
            />
          </label>

          <label className="grid min-w-0 gap-1">
            <span className="font-semibold text-[--maroon]">Bukti Kehadiran</span>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[--gold-soft] bg-white/65 p-5 text-center transition hover:border-[--maroon]"
            >
              {photoPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Preview" className="mb-3 max-h-48 rounded-2xl object-cover shadow-sm" />
                  <p className="text-xs text-foreground/60">Klik untuk mengganti foto</p>
                </>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[--gold-soft] bg-white/80 text-2xl text-[--maroon] shadow-sm">
                    📸
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[--maroon]">{uploadPrompt}</p>
                  <p className="mt-1 text-xs text-foreground/60">JPG, PNG, WebP • Max 5MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
              aria-label="Upload bukti kehadiran"
            />
          </label>

          <div className="rounded-2xl border border-[--gold-soft] bg-white/65 p-4 text-foreground/80">
            Status: {statusMessage}
          </div>

          {message && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                message.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          {existingRecord && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Data presensi {selectedModeLabel.toLowerCase()} sudah ada. Submit akan mengganti data sebelumnya.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="button-gold inline-flex w-full justify-center disabled:opacity-60 sm:w-fit"
            >
              {isLoading ? "Memproses..." : `Kirim ${selectedModeLabel}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusMessage("Menyegarkan halaman...");
                void window.location.reload();
              }}
              className="button-outline inline-flex w-full justify-center disabled:opacity-60 sm:w-fit"
            >
              Refresh Halaman
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
