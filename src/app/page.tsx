"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CANDIDATES } from "@/lib/candidates";
import { getFirebaseAuth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { normalizeNim } from "@/lib/voter-identity";

type ImportantInfo = {
  title: string;
  content: string;
  updatedAtLabel: string;
};

type VoteRow = {
  candidateId?: string;
  bobotSuara?: number;
};

type RawUserDisplayProfile = {
  nickName?: string;
};

function getProfileStorageKey(uid: string) {
  return `user_display_profile_${uid}`;
}

function readNickNameFromLocalStorage(uid: string) {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const raw = window.localStorage.getItem(getProfileStorageKey(uid));
    if (!raw) {
      return "";
    }

    const parsed = JSON.parse(raw) as RawUserDisplayProfile;
    return parsed.nickName?.trim() ?? "";
  } catch {
    return "";
  }
}

function getNimFromEmail(email: string | null | undefined) {
  if (!email) {
    return "";
  }

  const [localPart = ""] = email.split("@");
  return normalizeNim(localPart);
}

export default function Home() {
  const [importantInfo, setImportantInfo] = useState<ImportantInfo | null>(null);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCandidateBreakdownPublic, setShowCandidateBreakdownPublic] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [nickName, setNickName] = useState("");

  useEffect(() => {
    async function loadImportantInfo() {
      try {
        const snapshot = await getDoc(doc(db, "site_announcements", "current"));

        if (!snapshot.exists()) {
          setImportantInfo(null);
          return;
        }

        const data = snapshot.data() as {
          title?: string;
          content?: string;
          updatedAt?: { toDate?: () => Date };
        };

        const title = data.title?.trim() ?? "Informasi Penting";
        const content = data.content?.trim() ?? "Belum ada informasi terbaru dari admin.";
        const updatedAtDate = data.updatedAt?.toDate ? data.updatedAt.toDate() : null;

        setImportantInfo({
          title,
          content,
          updatedAtLabel: updatedAtDate ? updatedAtDate.toLocaleString() : "-",
        });
      } catch {
        setImportantInfo(null);
      }
    }

    void loadImportantInfo();

    async function loadVoteSummary() {
      try {
        const snapshot = await getDocs(collection(db, "suara_masuk"));
        setVotes(snapshot.docs.map((d) => d.data() as VoteRow));
      } catch {
        setVotes([]);
      }
    }

    void loadVoteSummary();

    async function loadResultsVisibility() {
      try {
        const snapshot = await getDoc(doc(db, "site_settings", "results_visibility"));
        if (!snapshot.exists()) {
          setShowCandidateBreakdownPublic(false);
          return;
        }

        const data = snapshot.data() as { showCandidateBreakdownPublic?: boolean };
        setShowCandidateBreakdownPublic(Boolean(data.showCandidateBreakdownPublic));
      } catch {
        setShowCandidateBreakdownPublic(false);
      }
    }

    void loadResultsVisibility();

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setCurrentUser(currentUser);

      if (!currentUser) {
        setIsAdmin(false);
        setNickName("");
        return;
      }

      const localNickName = readNickNameFromLocalStorage(currentUser.uid);
      if (localNickName) {
        setNickName(localNickName);
      }

      try {
        const adminDoc = await getDoc(doc(db, "admin_users", currentUser.uid));
        setIsAdmin(adminDoc.exists() && adminDoc.data().active === true);

        const profileDoc = await getDoc(doc(db, "user_profiles", currentUser.uid));
        const profileData = profileDoc.exists() ? (profileDoc.data() as RawUserDisplayProfile) : undefined;
        setNickName(profileData?.nickName?.trim() ?? localNickName);
      } catch {
        setIsAdmin(false);
        setNickName(localNickName);
      }
    });

    return unsubscribe;
  }, []);

  const canViewCandidateBreakdown = isAdmin || showCandidateBreakdownPublic;
  const greetingName = nickName || getNimFromEmail(currentUser?.email) || "Sobat HIMAFI";

  const voteSummary = useMemo(() => {
    const totalWeight = votes.reduce(
      (acc, v) => acc + Number(v.bobotSuara ?? 0),
      0,
    );

    return CANDIDATES.map((c) => {
      const candidateVotes = votes.filter((v) => v.candidateId === c.id);
      const weightedVotes = candidateVotes.reduce(
        (acc, v) => acc + Number(v.bobotSuara ?? 0),
        0,
      );
      const percentage = totalWeight > 0 ? (weightedVotes / totalWeight) * 100 : 0;

      return { ...c, voteCount: candidateVotes.length, weightedVotes, percentage };
    });
  }, [votes]);

  return (
    <section className="page-shell">
      <header className="gold-card space-y-5 overflow-hidden p-6 md:p-10">
        <h1 className="section-title max-w-4xl">
          DPA HIMAFI ITB
        </h1>
        {currentUser ? (
          <p className="text-sm text-foreground/75">
            Hai, Selamat Datang {greetingName}! Jangan lupa voting ya.
          </p>
        ) : (
          <p className="text-sm text-foreground/75">
            Hai, Selamat Datang! Login dulu untuk personalisasi dashboard kamu.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/login"
            className="button-gold"
          >
            Login
          </Link>
          <Link
            href="/hearing"
            className="button-outline"
          >
            Presensi Hearing
          </Link>
          <Link
            href="/voting"
            className="button-outline"
          >
            Voting
          </Link>
        </div>
      </header>

      <article className="gold-card overflow-hidden p-6">
        <p className="subtitle-strong">Informasi Penting</p>
        <h2 className="mt-2 font-display text-3xl text-[--maroon]">
          {importantInfo?.title ?? "Informasi Penting"}
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/80">
          {importantInfo?.content ?? "Belum ada informasi terbaru dari admin."}
        </p>
        <p className="mt-3 text-xs text-foreground/60">
          Update terakhir: {importantInfo?.updatedAtLabel ?? "-"}
        </p>
      </article>

      <article className="gold-card overflow-hidden p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="subtitle-strong">Overview Hasil Voting</p>
            <p className="mt-1 text-xs text-foreground/60">
              Total pemilih: {votes.length} · Total bobot:{" "}
              {votes.reduce((acc, v) => acc + Number(v.bobotSuara ?? 0), 0)}
            </p>
          </div>
          <Link href="/hasil" className="button-outline shrink-0 text-xs">
            Lihat Detail →
          </Link>
        </div>

        {canViewCandidateBreakdown ? (
          <div className="mt-5 space-y-3">
            {voteSummary.map((candidate, index) => {
              const fill = candidate.percentage <= 0 ? 0 : Math.min(Math.max(candidate.percentage, 4), 100);

              return (
                <div key={candidate.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[--maroon]">
                      {candidate.ballotNumber}. {candidate.name}
                    </span>
                    <span className="text-foreground/70">
                      {candidate.percentage.toFixed(1)}% · {candidate.weightedVotes} bobot
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[rgb(196_154_108/0.18)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${fill}%`,
                        background:
                          index === 0
                            ? "linear-gradient(90deg, var(--maroon), var(--gold))"
                            : "linear-gradient(90deg, var(--ink), var(--gold))",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-foreground/70">
            Live count per calon disembunyikan sementara untuk menjaga netralitas pemilihan.
          </p>
        )}
      </article>

      <article className="gold-card overflow-hidden p-6">
        <p className="subtitle-strong">Panduan Voting Singkat</p>
        <h2 className="mt-2 font-display text-3xl text-[--maroon]">Cara Voting</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-foreground/80">
          <li>Login dengan akun kampus ITB (NIM/email) di halaman Login.</li>
          <li>Buka Profil Calon untuk membaca visi-misi, draft, dan PPT kandidat.</li>
          <li>Masuk ke halaman Voting, pilih kandidat, lalu submit.</li>
        </ol>
        <p className="mt-3 text-xs text-foreground/65">
          Catatan: satu akun hanya bisa submit satu kali. Setelah submit, cek status di halaman Cek Status.
        </p>
      </article>
    </section>
  );
}
