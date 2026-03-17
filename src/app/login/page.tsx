"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  isCampusEmail,
  nimToCampusEmail,
  PRIMARY_CAMPUS_EMAIL_DOMAIN,
} from "@/lib/voter-identity";

function resolveLoginEmail(identifier: string) {
  const trimmedIdentifier = identifier.trim().toLowerCase();

  if (!trimmedIdentifier) {
    return "";
  }

  if (trimmedIdentifier.includes("@")) {
    return trimmedIdentifier;
  }

  return nimToCampusEmail(trimmedIdentifier);
}

function mapLoginError(message: string) {
  if (message.includes("auth/invalid-credential")) {
    return "NIM/password tidak cocok, atau akun Auth untuk NIM ini belum dibuat.";
  }

  if (message.includes("auth/operation-not-allowed")) {
    return "Provider Email/Password belum aktif di Firebase Authentication.";
  }

  if (message.includes("auth/too-many-requests")) {
    return "Terlalu banyak percobaan login. Coba lagi beberapa menit.";
  }

  return "Login gagal. Coba cek NIM dan password kamu.";
}

export default function LoginPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  async function onLoginWithCredentials() {
    const loginEmail = resolveLoginEmail(identifier);
    const cleanPassword = password.trim();

    if (!loginEmail) {
      setMessage("NIM atau email ITB wajib diisi dengan format yang valid.");
      return;
    }

    if (!cleanPassword) {
      setMessage("Password wajib diisi.");
      return;
    }

    if (!isCampusEmail(loginEmail)) {
      setMessage("Gunakan NIM atau email ITB yang valid.");
      return;
    }

    try {
      const auth = getFirebaseAuth();
      setIsSigningIn(true);
      setMessage("Memproses login...");
      await signInWithEmailAndPassword(auth, loginEmail, cleanPassword);
      setMessage("Login berhasil.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Login gagal.";
      setMessage(mapLoginError(text));
    } finally {
      setIsSigningIn(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onLoginWithCredentials();
  }

  async function onLogout() {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      setMessage("Logout berhasil.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Logout gagal.";
      setMessage(text);
    }
  }

  return (
    <section className="mx-auto w-full min-w-0 max-w-3xl space-y-6 overflow-x-hidden px-1">
      <header className="min-w-0 space-y-2">
        <p className="section-kicker">Exclusive Entry</p>
        <h1 className="section-title">Login / Logout</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
        Login diperlukan untuk submit voting. Halaman lain tetap bisa diakses
        tanpa login. Gunakan akun kampus ITB dengan format email NIM.
        </p>
      </header>

      <div className="gold-card min-w-0 space-y-4 overflow-hidden p-4 text-sm sm:p-6">
        {isLoading ? <p>Mengecek status login...</p> : null}

        {!isLoading && !user ? (
          <form className="grid min-w-0 w-full gap-3" onSubmit={onSubmit}>
            <div className="grid min-w-0 w-full gap-2">
              <label className="grid min-w-0 gap-1">
                <span className="font-semibold text-[--maroon]">NIM / Email ITB</span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="102xxxxx atau 102xxxxx@mahasiswa.itb.ac.id"
                  required
                  className="input-luxury"
                />
              </label>
              <label className="grid min-w-0 gap-1">
                <span className="font-semibold text-[--maroon]">Password</span>
                <div className="relative min-w-0 w-full">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Masukkan password"
                    required
                    className="input-luxury pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none text-[--maroon]"
                    aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                    title={showPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </label>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-[--gold-soft] bg-white/60 p-4 text-foreground/75">
                <p className="subtitle-strong">Format Login</p>
                <p className="mt-2 break-words text-sm">
                Login menggunakan NIM atau email ITB
                </p>
                <div className="mt-1 w-full min-w-0 overflow-x-auto">
                  <p className="whitespace-nowrap text-sm">
                    (ex: 102xxxxx atau 102xxxxx@{PRIMARY_CAMPUS_EMAIL_DOMAIN})
                  </p>
                </div>
                <p className="mt-2 text-sm">
                  Jika tetap gagal, cek apakah akun ini sudah ada di Firebase Authentication.
                </p>
              </div>
              <button
                type="submit"
                disabled={isSigningIn}
                className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60 sm:w-fit"
              >
                {isSigningIn ? "Memproses..." : "Login dengan NIM + Password"}
              </button>
            </div>
          </form>
        ) : null}

        {!isLoading && user ? (
          <div className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-[--gold-soft] bg-white/60 p-4">
            <div className="min-w-0">
              Login sebagai:{" "}
              <span className="inline-block max-w-full min-w-0 align-bottom">
                <span className="block w-full max-w-full overflow-x-auto whitespace-nowrap font-medium">
                  {user.email}
                </span>
              </span>
            </div>
            {!isCampusEmail(user.email ?? "") ? (
              <p className="text-foreground/80">
                Email ini bukan domain kampus ITB. Voting akan ditolak.
              </p>
            ) : null}
            <button
              type="button"
              onClick={onLogout}
              className="button-outline inline-flex w-fit"
            >
              Logout
            </button>
          </div>
        ) : null}

        <p className="break-words text-foreground/80">Status: {message || "-"}</p>
      </div>
    </section>
  );
}