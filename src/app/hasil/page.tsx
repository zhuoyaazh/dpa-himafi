"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, getFirebaseAuth } from "@/lib/firebase";
import { CANDIDATES } from "@/lib/candidates";
import { normalizeNim } from "@/lib/voter-identity";

type VoteRow = {
  nim?: string;
  candidateId?: string;
  bobotSuara?: number;
};

type UserRow = {
  nim?: string;
  sudahVote?: boolean;
  bobotSuara?: number;
};

export default function HasilPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [notVotedCount, setNotVotedCount] = useState(0);
  const [weightByNim, setWeightByNim] = useState<Record<string, number>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCandidateBreakdownPublic, setShowCandidateBreakdownPublic] = useState(false);

  useEffect(() => {
    async function loadResults() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const voteSnapshot = await getDocs(collection(db, "suara_masuk"));
        setVotes(voteSnapshot.docs.map((row) => row.data() as VoteRow));

        const userSnapshot = await getDocs(collection(db, "users"));
        const nextWeightByNim: Record<string, number> = {};
        const belumVoteCount = userSnapshot.docs.reduce((accumulator, row) => {
          const data = row.data() as UserRow;
          const nim = normalizeNim(data.nim ?? row.id);

          const parsedWeight = Number(data.bobotSuara);
          if (nim && (parsedWeight === 1 || parsedWeight === 1.5 || parsedWeight === 2)) {
            nextWeightByNim[nim] = parsedWeight;
          }

          return accumulator + (data.sudahVote === true ? 0 : 1);
        }, 0);
        setNotVotedCount(belumVoteCount);
        setWeightByNim(nextWeightByNim);
      } catch (error) {
        console.error("Error loading results:", error);
        setErrorMessage("Gagal memuat hasil voting. Coba refresh halaman.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadResults();

    // Real-time listener for users bobot updates
    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const nextWeightByNim: Record<string, number> = {};
        let belumVoteCount = 0;

        snapshot.docs.forEach((userDoc) => {
          const data = userDoc.data() as UserRow;
          const nim = normalizeNim(data.nim ?? userDoc.id);

          const parsedWeight = Number(data.bobotSuara);
          if (nim && (parsedWeight === 1 || parsedWeight === 1.5 || parsedWeight === 2)) {
            nextWeightByNim[nim] = parsedWeight;
          }

          if (data.sudahVote !== true) {
            belumVoteCount += 1;
          }
        });

        setWeightByNim(nextWeightByNim);
        setNotVotedCount(belumVoteCount);
      },
      (error) => {
        console.error("Error listening to users collection:", error);
      },
    );

    // Real-time listener for vote updates
    const unsubscribeVotes = onSnapshot(
      collection(db, "suara_masuk"),
      (snapshot) => {
        setVotes(snapshot.docs.map((row) => row.data() as VoteRow));
      },
      (error) => {
        console.error("Error listening to suara_masuk collection:", error);
      },
    );

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
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setIsAdmin(false);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, "admin_users", currentUser.uid));
        setIsAdmin(adminDoc.exists() && adminDoc.data().active === true);
      } catch {
        setIsAdmin(false);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeVotes();
      unsubscribeAuth();
    };
  }, []);

  async function refreshResults() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const voteSnapshot = await getDocs(collection(db, "suara_masuk"));
      setVotes(voteSnapshot.docs.map((row) => row.data() as VoteRow));

      const userSnapshot = await getDocs(collection(db, "users"));
      const nextWeightByNim: Record<string, number> = {};
      const belumVoteCount = userSnapshot.docs.reduce((accumulator, row) => {
        const data = row.data() as UserRow;
        const nim = normalizeNim(data.nim ?? row.id);

        const parsedWeight = Number(data.bobotSuara);
        if (nim && (parsedWeight === 1 || parsedWeight === 1.5 || parsedWeight === 2)) {
          nextWeightByNim[nim] = parsedWeight;
        }

        return accumulator + (data.sudahVote === true ? 0 : 1);
      }, 0);
      setNotVotedCount(belumVoteCount);
      setWeightByNim(nextWeightByNim);
    } catch (error) {
      console.error("Error refreshing results:", error);
      setErrorMessage("Gagal memuat hasil voting. Coba refresh halaman.");
    } finally {
      setIsLoading(false);
    }
  }

  const summary = useMemo(() => {
    const totalWeight = votes.reduce((accumulator, vote) => {
      const nim = normalizeNim(vote.nim ?? "");
      const effectiveWeight = Number(weightByNim[nim] ?? vote.bobotSuara ?? 1);
      return accumulator + effectiveWeight;
    },
      0,
    );

    return CANDIDATES.map((candidate) => {
      const candidateVotes = votes.filter((vote) => vote.candidateId === candidate.id);
      const voteCount = candidateVotes.length;
      const weightedVotes = candidateVotes.reduce(
        (accumulator, vote) => {
          const nim = normalizeNim(vote.nim ?? "");
          const effectiveWeight = Number(weightByNim[nim] ?? vote.bobotSuara ?? 1);
          return accumulator + effectiveWeight;
        },
        0,
      );
      const percentage = totalWeight > 0 ? (weightedVotes / totalWeight) * 100 : 0;

      return {
        ...candidate,
        voteCount,
        weightedVotes,
        percentage,
      };
    });
  }, [votes, weightByNim]);

  const totalVoters = votes.length;
  const invalidVotes = notVotedCount;
  const totalWeight = summary.reduce(
    (accumulator, candidate) => accumulator + candidate.weightedVotes,
    0,
  );
  const sortedSummary = [...summary].sort(
    (left, right) => right.weightedVotes - left.weightedVotes,
  );
  const topCandidate = sortedSummary[0];
  const canViewCandidateBreakdown = isAdmin || showCandidateBreakdownPublic;

  return (
    <section className="page-shell">
      <header className="space-y-2 overflow-hidden">
        <p className="section-kicker">Result Tableau</p>
        <h1 className="section-title">Hasil Voting</h1>
        <p className="max-w-3xl text-sm text-foreground/75">
        </p>
        <button
          type="button"
          onClick={refreshResults}
          className="button-outline inline-flex w-full justify-center sm:w-fit"
          disabled={isLoading}
        >
          {isLoading ? "Memuat..." : "Refresh Hasil"}
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="gold-card p-5">
          <p className="subtitle-strong text-xs sm:text-sm">Total Pemilih</p>
          <p className="font-display mt-3 text-3xl text-[--maroon] sm:text-4xl">{totalVoters}</p>
        </div>
        <div className="gold-card p-5">
          <p className="subtitle-strong text-xs sm:text-sm">Total Bobot Suara</p>
          <p className="font-display mt-3 text-3xl text-[--maroon] sm:text-4xl">{totalWeight}</p>
        </div>
        <div className="gold-card p-5">
          <p className="subtitle-strong text-xs sm:text-sm">Total Belum Vote</p>
          <p className="font-display mt-3 text-3xl text-[--maroon] sm:text-4xl">{invalidVotes}</p>
          <p className="mt-2 text-xs text-foreground/60">Berubah saat user submit vote.</p>
        </div>
        <div className="gold-card p-5">
          <p className="subtitle-strong text-xs sm:text-sm">Status</p>
          <p className="mt-3 text-sm text-foreground/75">
            {isLoading ? "Memuat rekap suara..." : errorMessage || "Rekap berhasil dimuat."}
          </p>
        </div>
      </div>

      {topCandidate && canViewCandidateBreakdown ? (
        <section className="gold-card overflow-hidden p-6">
          <p className="subtitle-strong">Peringkat Sementara</p>
          <h2 className="font-display mt-2 wrap-break-word text-3xl text-[--maroon]">
            {topCandidate.name} memimpin dengan bobot {topCandidate.weightedVotes}
          </h2>
          <p className="mt-2 text-sm text-foreground/75">
            Persentase bobot saat ini: {topCandidate.percentage.toFixed(1)}% dari total bobot suara.
          </p>
        </section>
      ) : null}

      {canViewCandidateBreakdown ? (
        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-2">
          {sortedSummary.map((candidate, index) => (
            <article key={candidate.id} className="gold-card overflow-hidden p-6">
              <div className={`rounded-3xl bg-linear-to-br ${candidate.accent} p-5 text-[#fffaf0]`}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-80">
                      Rank #{index + 1} · Candidate {candidate.ballotNumber}
                    </p>
                    <h2 className="font-display mt-3 wrap-break-word text-4xl">{candidate.name}</h2>
                    <p className="mt-2 wrap-break-word text-sm opacity-85">{candidate.title}</p>
                  </div>
                  <span className="font-display shrink-0 text-4xl">{candidate.suit}</span>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm text-foreground/80">
                <div className="flex items-center justify-between">
                  <span>Jumlah suara masuk</span>
                  <span className="font-bold text-[--maroon]">{candidate.voteCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total bobot</span>
                  <span className="font-bold text-[--maroon]">{candidate.weightedVotes}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Persentase bobot</span>
                    <span className="font-bold text-[--maroon]">{candidate.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[rgb(196_154_108/0.18)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${candidate.percentage <= 0 ? 0 : Math.min(Math.max(candidate.percentage, 4), 100)}%`,
                        background:
                          candidate.id === "calon-1"
                            ? "linear-gradient(90deg, var(--ink), var(--gold))"
                            : "linear-gradient(90deg, var(--maroon), var(--gold))",
                      }}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="gold-card overflow-hidden p-6">
          <p className="subtitle-strong">Mode Netral</p>
          <p className="mt-2 text-sm text-foreground/75">
            Perolehan suara per calon disembunyikan sementara. Halaman ini hanya menampilkan total suara umum.
          </p>
        </section>
      )}
    </section>
  );
}
