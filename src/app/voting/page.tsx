"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { submitVote } from "@/lib/voting";
import { getFirebaseAuth } from "@/lib/firebase";
import { getVoterIdentityError, normalizeNim } from "@/lib/voter-identity";
import { CANDIDATES } from "@/lib/candidates";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1280;
const UPLOAD_TIMEOUT_MS = 30000;

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("File gambar tidak bisa dibaca."));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Gagal memproses gambar."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function optimizeImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("File selfie harus berupa gambar.");
  }

  const image = await loadImage(file);
  const ratio = Math.min(MAX_DIMENSION / image.width, MAX_DIMENSION / image.height, 1);
  const targetWidth = Math.max(1, Math.round(image.width * ratio));
  const targetHeight = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Browser tidak mendukung proses kompresi gambar.");
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const qualitySteps = [0.9, 0.82, 0.74, 0.66, 0.58];

  let bestBlob = await canvasToBlob(canvas, qualitySteps[0]);

  for (const quality of qualitySteps) {
    const compressedBlob = await canvasToBlob(canvas, quality);
    bestBlob = compressedBlob;

    if (compressedBlob.size <= MAX_IMAGE_BYTES) {
      break;
    }
  }

  if (bestBlob.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `Ukuran foto setelah kompres masih terlalu besar (${formatBytes(bestBlob.size)}). Gunakan foto lebih kecil dari 2 MB.`,
    );
  }

  return new File([bestBlob], `selfie-${Date.now()}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export default function VotingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [nim, setNim] = useState("");
  const [candidateId, setCandidateId] = useState(CANDIDATES[0].id);
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

  const uploadFotoKeCloudinary = async (fileFoto: File) => {
    const formData = new FormData();
    formData.append("file", fileFoto);
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
        throw new Error(data.error?.message || "Upload Cloudinary gagal.");
      }

      return data.secure_url as string;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Upload foto timeout (lebih dari 30 detik). Coba foto lebih kecil atau cek koneksi.");
      }

      const message = error instanceof Error ? error.message : "Gagal mengunggah foto.";
      throw new Error(message);
    } finally {
      window.clearTimeout(timeoutId);
    }

  };

  function onSelfieChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) {
      setSelfieFile(null);
      return null;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setSelfieFile(null);
      setStatusMessage("File yang dipilih harus berupa gambar.");
      return;
    }

    setStatusMessage(`Foto dipilih: ${formatBytes(selectedFile.size)}. Akan dikompres saat submit.`);
    setSelfieFile(selectedFile);
  }

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
      setStatusMessage("Mengompres selfie...");
      const optimizedSelfieFile = await optimizeImageForUpload(selfieFile);

      setStatusMessage(`Mengunggah selfie (${formatBytes(optimizedSelfieFile.size)})...`);

      const selfieUrl = await uploadFotoKeCloudinary(optimizedSelfieFile);
      if (!selfieUrl) {
        setStatusMessage("Upload selfie gagal. Coba lagi.");
        return;
      }

      setStatusMessage("Mengirim suara...");

      await submitVote({
        nim: sanitizedNim,
        candidateId,
        selfieFile: optimizedSelfieFile,
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
    <section className="mx-auto w-full max-w-3xl space-y-6 overflow-x-hidden">
      <header className="space-y-2">
        <p className="section-kicker">Golden Ballot</p>
        <h1 className="section-title">Halaman Voting</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
        Submit voting dilakukan dengan upload selfie verifikasi. Data identitas
        disimpan di koleksi terpisah dari data suara untuk menjaga anonimitas.
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
          <li>Upload selfie verifikasi dan klik Submit Voting satu kali.</li>
        </ol>
      </article>

      {user ? (
        <form
          onSubmit={onSubmit}
          className="gold-card grid gap-4 overflow-hidden p-4 text-sm sm:p-6"
        >
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

        <label className="grid min-w-0 gap-1">
          <span className="font-semibold text-[--maroon]">Upload Selfie Verifikasi</span>
          <input
            type="file"
            accept="image/*"
            required
            onChange={onSelfieChange}
            className="input-luxury w-full min-w-0 max-w-full"
          />
          <p className="text-xs text-foreground/70">
            Foto otomatis dikompres (maks 2 MB) agar upload lebih cepat.
          </p>
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60 sm:w-fit"
        >
          {isSubmitting ? "Mengirim..." : "Submit Voting"}
        </button>

        <p className="break-words text-sm text-foreground/80">Status: {statusMessage || "-"}</p>
        </form>
      ) : null}
    </section>
  );
}

