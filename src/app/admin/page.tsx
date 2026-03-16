"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getFirebaseAuth, db } from "@/lib/firebase";

type AuditLog = {
  actorEmail?: string;
  actorUid?: string;
  eventType?: string;
  metadata?: {
    passwordLength?: number;
  };
  changedAt?: { seconds?: number };
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [totalVoteWeight, setTotalVoteWeight] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setIsAdmin(false);
        setLogs([]);
        setMessage("Login diperlukan untuk membuka panel admin.");
        setIsLoading(false);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, "admin_users", currentUser.uid));
        const adminActive = adminDoc.exists() && adminDoc.data().active === true;

        setIsAdmin(adminActive);

        if (!adminActive) {
          setMessage("Akun ini belum terdaftar sebagai admin aktif.");
          setLogs([]);
          setIsLoading(false);
          return;
        }

        const snapshot = await getDocs(
          query(
            collection(db, "developer_audit_logs"),
            orderBy("changedAt", "desc"),
            limit(25),
          ),
        );

        const voteSnapshot = await getDocs(collection(db, "suara_masuk"));
        const voteRows = voteSnapshot.docs.map((voteDoc) => voteDoc.data() as { bobotSuara?: number });
        const voteWeight = voteRows.reduce(
          (accumulator, vote) => accumulator + Number(vote.bobotSuara ?? 0),
          0,
        );

        setLogs(snapshot.docs.map((log) => log.data() as AuditLog));
        setTotalVotes(voteRows.length);
        setTotalVoteWeight(voteWeight);
        setMessage("Audit log berhasil dimuat.");
      } catch {
        setMessage("Gagal memuat panel admin.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <section className="page-shell">
      <header className="space-y-2">
        <p className="section-kicker">Developer Vault</p>
        <h1 className="section-title">Admin Audit Log</h1>
        <p className="max-w-3xl text-sm text-foreground/75">
          Panel ini dipakai untuk memantau jejak perubahan password/token pengguna dan pemeriksaan operasional lainnya.
        </p>
      </header>

      <div className="gold-card space-y-4 overflow-hidden p-4 text-sm text-foreground/80 sm:p-6">
        <p className="break-words">Status: {isLoading ? "Memuat..." : message || "-"}</p>

        {isAdmin ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
              <p className="subtitle-strong">Total Audit Event</p>
              <p className="font-display mt-2 text-3xl text-[--maroon]">{logs.length}</p>
            </div>
            <div className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
              <p className="subtitle-strong">Total Vote Terekam</p>
              <p className="font-display mt-2 text-3xl text-[--maroon]">{totalVotes}</p>
            </div>
            <div className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
              <p className="subtitle-strong">Total Bobot</p>
              <p className="font-display mt-2 text-3xl text-[--maroon]">{totalVoteWeight}</p>
            </div>
          </div>
        ) : null}

        {user ? (
          <div className="min-w-0 rounded-2xl border border-[--gold-soft] bg-white/60 p-4">
            <p>Email login: <span className="break-all font-semibold">{user.email}</span></p>
            <p>UID login: <span className="break-all font-semibold">{user.uid}</span></p>
            {!isAdmin ? (
              <p className="mt-2 text-sm text-foreground/75">
                Akses admin hanya untuk orang DPA yang didaftarkan manual di collection <span className="font-semibold">admin_users</span>
                {' '}dengan ID <span className="break-all font-semibold">{user.uid}</span> dan field <span className="font-semibold">active: true</span>.
              </p>
            ) : null}
          </div>
        ) : null}

        {isAdmin ? (
          <div className="grid gap-3">
            {logs.length === 0 ? (
              <div className="rounded-2xl border border-[--gold-soft] bg-white/60 p-4">
                Belum ada event audit yang tercatat.
              </div>
            ) : (
              logs.map((log, index) => (
                <article
                  key={`${log.actorUid}-${log.changedAt?.seconds ?? index}`}
                  className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="subtitle-strong">{log.eventType ?? "UNKNOWN_EVENT"}</p>
                    <p className="text-xs text-foreground/60">
                      {log.changedAt?.seconds
                        ? new Date(log.changedAt.seconds * 1000).toLocaleString()
                        : "Waktu tidak tersedia"}
                    </p>
                  </div>
                  <p className="mt-2 break-words">Actor: <span className="break-all font-semibold">{log.actorEmail ?? "-"}</span></p>
                  <p className="break-words">UID: <span className="break-all font-semibold">{log.actorUid ?? "-"}</span></p>
                  <p className="break-words">
                    Metadata: panjang password baru {log.metadata?.passwordLength ?? "-"} karakter
                  </p>
                </article>
              ))
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}