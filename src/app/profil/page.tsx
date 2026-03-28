"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { normalizeNim } from "@/lib/voter-identity";

type UserBiodata = {
  nim?: string;
  angkatan?: number;
  statusHearing?: boolean;
  sudahVote?: boolean;
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
  voterEmail?: string;
  voter_email?: string;
  voterUid?: string;
  voter_uid?: string;
};

type UserDisplayProfile = {
  fullName: string;
  nickName: string;
  bio: string;
};

type RawUserDisplayProfile = {
  fullName?: string;
  nickName?: string;
  bio?: string;
};

function getProfileStorageKey(uid: string) {
  return `user_display_profile_${uid}`;
}

function readProfileFromLocalStorage(uid: string): UserDisplayProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getProfileStorageKey(uid));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as RawUserDisplayProfile;
    return {
      fullName: parsed.fullName?.trim() ?? "",
      nickName: parsed.nickName?.trim() ?? "",
      bio: parsed.bio?.trim() ?? "",
    };
  } catch {
    return null;
  }
}

function saveProfileToLocalStorage(uid: string, profile: UserDisplayProfile) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getProfileStorageKey(uid), JSON.stringify(profile));
}

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
  const [profileMessage, setProfileMessage] = useState("");
  const [biodata, setBiodata] = useState<UserBiodata | null>(null);
  const [profile, setProfile] = useState<UserDisplayProfile>({
    fullName: "",
    nickName: "",
    bio: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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

        const localProfile = readProfileFromLocalStorage(user.uid);
        if (localProfile) {
          setProfile(localProfile);
        }

        const snapshot = await getDoc(doc(db, "users", nimFromEmail));

        if (!snapshot.exists()) {
          setBiodata(null);
          setStatusMessage("Data biodata belum ditemukan untuk akun ini.");
        } else {
          const data = snapshot.data() as RawUserBiodata;
          setBiodata({
            nim: data.nim ?? nimFromEmail,
            angkatan: typeof data.angkatan === "number" ? data.angkatan : undefined,
            statusHearing: Boolean(data.statusHearing ?? data.status_hearing),
            sudahVote: Boolean(data.sudahVote ?? data.sudah_vote),
            voterEmail: data.voterEmail ?? data.voter_email,
            voterUid: data.voterUid ?? data.voter_uid,
          });
          setStatusMessage("Biodata berhasil dimuat.");
        }

        try {
          const profileSnapshot = await getDoc(doc(db, "user_profiles", user.uid));
          if (profileSnapshot.exists()) {
            const profileData = profileSnapshot.data() as RawUserDisplayProfile;
            const nextProfile = {
              fullName: profileData.fullName?.trim() ?? "",
              nickName: profileData.nickName?.trim() ?? "",
              bio: profileData.bio?.trim() ?? "",
            };
            setProfile(nextProfile);
            saveProfileToLocalStorage(user.uid, nextProfile);
          }
        } catch {
          // Keep local profile if Firestore profile read fails.
        }
      } catch {
        setBiodata(null);
        setStatusMessage("Gagal mengambil biodata user.");
      } finally {
        setIsLoadingData(false);
      }
    }

    void loadBiodata();
  }, [user, nimFromEmail]);

  async function onSaveDisplayProfile() {
    if (!user) {
      setProfileMessage("Kamu harus login dulu untuk menyimpan profil tampilan.");
      return;
    }

    const fullName = profile.fullName.trim();
    const nickName = profile.nickName.trim();
    const bio = profile.bio.trim();

    if (!nickName) {
      setProfileMessage("Nama panggilan wajib diisi.");
      return;
    }

    try {
      setIsSavingProfile(true);

      const nextProfile: UserDisplayProfile = {
        fullName,
        nickName,
        bio,
      };

      saveProfileToLocalStorage(user.uid, nextProfile);

      await setDoc(
        doc(db, "user_profiles", user.uid),
        {
          uid: user.uid,
          fullName,
          nickName,
          bio,
        },
        { merge: true },
      );

      setProfile(nextProfile);
      setProfileMessage("Profil tampilan berhasil disimpan.");
    } catch {
      setProfileMessage("Profil tampilan berhasil disimpan di perangkat ini.");
    } finally {
      setIsSavingProfile(false);
    }
  }

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
            <p>Email Login: <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom">{user.email ?? "-"}</span></p>
            <p>UID Auth: <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom">{user.uid}</span></p>
            <p>NIM dari Email: <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom">{nimFromEmail || "-"}</span></p>
          </div>

          {isLoadingData ? <p>Memuat biodata...</p> : null}

          {biodata ? (
            <div className="min-w-0 rounded-2xl border border-[--gold-soft] bg-white/70 p-4 leading-7">
              <p>NIM: {biodata.nim ?? "-"}</p>
              <p>Angkatan: {biodata.angkatan ?? "-"}</p>
              <p>Status Hearing: {biodata.statusHearing ? "Hadir" : "Tidak hadir"}</p>
              <p>Sudah Vote: {biodata.sudahVote ? "Ya" : "Belum"}</p>
              <p>Voter Email Tercatat: <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom">{biodata.voterEmail ?? "-"}</span></p>
              <p>Voter UID Tercatat: <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom">{biodata.voterUid ?? "-"}</span></p>
            </div>
          ) : null}

          <div className="min-w-0 rounded-2xl border border-[--gold-soft] bg-white/70 p-4 leading-7">
            <p className="subtitle-strong">Profil Tampilan Dashboard</p>
            <p className="mt-1 text-xs text-foreground/70">
              Data ini hanya untuk personalisasi tampilan (sapaan dashboard), tidak memengaruhi sistem voting.
            </p>

            <div className="mt-3 grid gap-3">
              <label className="grid min-w-0 gap-1">
                <span className="font-semibold text-[--maroon]">Nama Lengkap</span>
                <input
                  value={profile.fullName}
                  onChange={(event) => setProfile((prev) => ({ ...prev, fullName: event.target.value }))}
                  className="input-luxury"
                  placeholder="Contoh: Zhou Yiran"
                />
              </label>

              <label className="grid min-w-0 gap-1">
                <span className="font-semibold text-[--maroon]">Nama Panggilan</span>
                <input
                  value={profile.nickName}
                  onChange={(event) => setProfile((prev) => ({ ...prev, nickName: event.target.value }))}
                  className="input-luxury"
                  placeholder="Contoh: Yiran"
                />
              </label>

              <label className="grid min-w-0 gap-1">
                <span className="font-semibold text-[--maroon]">Bio Singkat (Opsional)</span>
                <textarea
                  value={profile.bio}
                  onChange={(event) => setProfile((prev) => ({ ...prev, bio: event.target.value }))}
                  className="input-luxury min-h-24 resize-y"
                  placeholder="Contoh: Semangat voting!"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onSaveDisplayProfile()}
                  disabled={isSavingProfile}
                  className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60 sm:w-fit"
                >
                  {isSavingProfile ? "Menyimpan..." : "Simpan Profil Tampilan"}
                </button>
              </div>

              <p className="wrap-break-word text-foreground/80">Status Profil Tampilan: {profileMessage || "-"}</p>
            </div>
          </div>

          <p className="wrap-break-word text-foreground/80">Status: {statusMessage || "-"}</p>
        </div>
      ) : null}
    </section>
  );
}
