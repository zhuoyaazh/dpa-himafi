"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
  type User,
} from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, db } from "@/lib/firebase";
import { isCampusEmail } from "@/lib/voter-identity";

function getPasswordChangeError(message: string) {
  if (message.includes("auth/invalid-credential")) {
    return "Password lama tidak cocok.";
  }

  if (message.includes("auth/weak-password")) {
    return "Password baru terlalu lemah. Gunakan minimal 6 karakter.";
  }

  if (message.includes("auth/requires-recent-login")) {
    return "Sesi login sudah terlalu lama. Silakan login ulang dulu.";
  }

  return "Gagal mengganti password. Coba lagi.";
}

export default function SettingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.email) {
      setMessage("Kamu harus login dulu untuk mengganti password.");
      return;
    }

    if (!isCampusEmail(user.email)) {
      setMessage("Akun ini bukan email kampus yang valid.");
      return;
    }

    const cleanCurrentPassword = currentPassword.trim();
    const cleanNewPassword = newPassword.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    if (!cleanCurrentPassword || !cleanNewPassword || !cleanConfirmPassword) {
      setMessage("Semua field password wajib diisi.");
      return;
    }

    if (cleanNewPassword !== cleanConfirmPassword) {
      setMessage("Konfirmasi password baru tidak cocok.");
      return;
    }

    if (cleanCurrentPassword === cleanNewPassword) {
      setMessage("Password baru harus berbeda dari password lama.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("Memproses perubahan password...");

      const credential = EmailAuthProvider.credential(
        user.email,
        cleanCurrentPassword,
      );

      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, cleanNewPassword);

      await addDoc(collection(db, "developer_audit_logs"), {
        actorUid: user.uid,
        actorEmail: user.email,
        eventType: "PASSWORD_CHANGED",
        changedAt: serverTimestamp(),
        metadata: {
          passwordLength: cleanNewPassword.length,
        },
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password berhasil diganti. Event sudah dicatat ke audit log.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Gagal update password.";
      setMessage(getPasswordChangeError(text));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 overflow-x-hidden">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[--gold]">
          Account Settings
        </p>
        <h1 className="font-display text-4xl text-[--maroon]">Ganti Password / Token</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
        </p>
      </header>

      <div className="gold-card space-y-4 overflow-hidden p-4 sm:p-6">
        {isLoading ? <p>Mengecek sesi login...</p> : null}

        {!isLoading && !user ? (
          <p className="text-sm text-foreground/75">
            Kamu harus login dulu sebelum bisa mengganti password.
          </p>
        ) : null}

        {user ? (
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="rounded-xl border border-[--gold-soft] bg-white/60 p-4 text-sm text-foreground/80">
              Login sebagai <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom font-semibold">{user.email}</span>
            </div>

            <label className="grid min-w-0 gap-1">
              <span className="font-semibold">Password Lama</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="input-luxury"
                required
              />
            </label>

            <label className="grid min-w-0 gap-1">
              <span className="font-semibold">Password Baru</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="input-luxury"
                required
                minLength={6}
              />
            </label>

            <label className="grid min-w-0 gap-1">
              <span className="font-semibold">Konfirmasi Password Baru</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="input-luxury"
                required
                minLength={6}
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60 sm:w-fit"
            >
              {isSubmitting ? "Memproses..." : "Simpan Password Baru"}
            </button>
          </form>
        ) : null}

        <p className="break-words text-sm text-foreground/75">Status: {message || "-"}</p>
      </div>
    </section>
  );
}