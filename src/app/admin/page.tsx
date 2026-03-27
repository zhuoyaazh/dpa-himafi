"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseAuth, db } from "@/lib/firebase";

type VoteWeightValue = 1 | 1.5 | 2;

const ALLOWED_VOTE_WEIGHTS: VoteWeightValue[] = [1, 1.5, 2];

function normalizeNim(rawNim: string) {
  return rawNim.trim().replace(/\D/g, "");
}

function isValidWeightUpdateNim(nim: string) {
  return /^\d{8}$/.test(nim);
}

function parseVoteWeight(rawWeight: string): VoteWeightValue | null {
  const parsedWeight = Number(rawWeight);

  if (parsedWeight === 1 || parsedWeight === 1.5 || parsedWeight === 2) {
    return parsedWeight;
  }

  return null;
}

type AuditLog = {
  actorEmail?: string;
  actorUid?: string;
  eventType?: string;
  metadata?: {
    passwordLength?: number;
  };
  changedAt?: { seconds?: number };
};

type HearingSettingsForm = {
  sessionName: string;
  isActive: boolean;
  presensiAwalAktif: boolean;
  presensiAkhirAktif: boolean;
  presensiAwalToken: string;
  presensiAkhirToken: string;
};

type HearingSessionSummary = {
  id: string;
  name: string;
  updatedAt?: Timestamp;
  isActive: boolean;
};

type AnnouncementHistory = {
  id: string;
  title: string;
  content: string;
  updatedAt?: Timestamp;
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [totalVoteWeight, setTotalVoteWeight] = useState(0);
  const [message, setMessage] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [isSavingResultsVisibility, setIsSavingResultsVisibility] = useState(false);
  const [isSavingVotingGate, setIsSavingVotingGate] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [hearingSessions, setHearingSessions] = useState<HearingSessionSummary[]>([]);
  const [deletingSessionId, setDeletingSessionId] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("Informasi Penting");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [announcementHistory, setAnnouncementHistory] = useState<AnnouncementHistory[]>([]);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState("");
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState("");
  const [showCandidateBreakdownPublic, setShowCandidateBreakdownPublic] = useState(false);
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [hearingSettings, setHearingSettings] = useState<HearingSettingsForm>({
    sessionName: "",
    isActive: false,
    presensiAwalAktif: true,
    presensiAkhirAktif: true,
    presensiAwalToken: "",
    presensiAkhirToken: "",
  });
  const [manualWeightNim, setManualWeightNim] = useState("");
  const [manualWeightValue, setManualWeightValue] = useState<`${VoteWeightValue}`>("1");
  const [bulkWeightInput, setBulkWeightInput] = useState("");
  const [isSavingManualWeight, setIsSavingManualWeight] = useState(false);
  const [isSavingBulkWeight, setIsSavingBulkWeight] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState("");
  const [togglingSessionId, setTogglingSessionId] = useState("");

  const mapSessionToForm = useCallback((data: {
    name?: string;
    isActive?: boolean;
    presensiAwalAktif?: boolean;
    presensiAkhirAktif?: boolean;
    presensiAwalToken?: string;
    presensiAkhirToken?: string;
    checkInToken?: string;
    checkOutToken?: string;
  }): HearingSettingsForm => {
    return {
      sessionName: data.name?.trim() ?? "",
      isActive: Boolean(data.isActive),
      presensiAwalAktif: Boolean(data.presensiAwalAktif ?? true),
      presensiAkhirAktif: Boolean(data.presensiAkhirAktif ?? true),
      presensiAwalToken: data.presensiAwalToken ?? data.checkInToken ?? "",
      presensiAkhirToken: data.presensiAkhirToken ?? data.checkOutToken ?? "",
    };
  }, []);

  const loadSessionById = useCallback(async (sessionId: string) => {
    const snapshot = await getDoc(doc(db, "hearing_sessions", sessionId));
    if (!snapshot.exists()) {
      return false;
    }

    const data = snapshot.data() as {
      name?: string;
      isActive?: boolean;
      presensiAwalAktif?: boolean;
      presensiAkhirAktif?: boolean;
      presensiAwalToken?: string;
      presensiAkhirToken?: string;
      checkInToken?: string;
      checkOutToken?: string;
    };

    setHearingSettings(mapSessionToForm(data));
    setSelectedSessionId(sessionId);
    setEditingSessionId(sessionId);
    return true;
  }, [mapSessionToForm]);

  const loadHearingSettingsAndHistory = useCallback(async () => {
    const [settingsSnapshot, sessionsSnapshot] = await Promise.all([
      getDoc(doc(db, "hearing_settings", "current")),
      getDocs(query(collection(db, "hearing_sessions"), orderBy("updatedAt", "desc"), limit(50))),
    ]);

    const sessions = sessionsSnapshot.docs.map((sessionDoc) => {
      const data = sessionDoc.data() as { name?: string; updatedAt?: Timestamp; isActive?: boolean };

      return {
        id: sessionDoc.id,
        name: data.name ?? `Sesi ${sessionDoc.id}`,
        updatedAt: data.updatedAt,
        isActive: Boolean(data.isActive),
      };
    });

    setHearingSessions(sessions);

    const currentData = settingsSnapshot.exists()
      ? (settingsSnapshot.data() as { activeSessionId?: string })
      : undefined;

    const currentSessionId = currentData?.activeSessionId ?? "";
    setActiveSessionId(currentSessionId);

    if (currentSessionId) {
      const loaded = await loadSessionById(currentSessionId);
      if (loaded) {
        return;
      }
    }

    if (sessions.length > 0) {
      await loadSessionById(sessions[0].id);
    } else {
      setSelectedSessionId("");
      setActiveSessionId("");
    }
  }, [loadSessionById]);

  const loadAnnouncementHistory = useCallback(async () => {
    const snapshot = await getDocs(
      query(collection(db, "site_announcements"), orderBy("updatedAt", "desc"), limit(50))
    );

    const announcements = snapshot.docs.map((doc) => {
      const data = doc.data() as { title?: string; content?: string; updatedAt?: Timestamp };

      return {
        id: doc.id,
        title: data.title?.trim() ?? "Informasi Penting",
        content: data.content?.trim() ?? "",
        updatedAt: data.updatedAt,
      };
    });

    setAnnouncementHistory(announcements);

    const currentDoc = announcements.find((a) => a.id === "current");
    if (currentDoc) {
      setAnnouncementTitle(currentDoc.title);
      setAnnouncementContent(currentDoc.content);
      setSelectedAnnouncementId("current");
    } else if (announcements.length > 0) {
      setAnnouncementTitle(announcements[0].title);
      setAnnouncementContent(announcements[0].content);
      setSelectedAnnouncementId(announcements[0].id);
    }
  }, []);

  const loadResultsVisibility = useCallback(async () => {
    const snapshot = await getDoc(doc(db, "site_settings", "results_visibility"));

    if (!snapshot.exists()) {
      setShowCandidateBreakdownPublic(false);
      return;
    }

    const data = snapshot.data() as { showCandidateBreakdownPublic?: boolean };
    setShowCandidateBreakdownPublic(Boolean(data.showCandidateBreakdownPublic));
  }, []);

  const loadVotingGateSettings = useCallback(async () => {
    const snapshot = await getDoc(doc(db, "site_settings", "voting_gate"));

    if (!snapshot.exists()) {
      setIsVotingOpen(true);
      return;
    }

    const data = snapshot.data() as { isOpen?: boolean };
    setIsVotingOpen(data.isOpen !== false);
  }, []);

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
        await Promise.all([
          loadHearingSettingsAndHistory(),
          loadAnnouncementHistory(),
          loadResultsVisibility(),
          loadVotingGateSettings(),
        ]);
        setMessage("Audit log berhasil dimuat.");
      } catch {
        setMessage("Gagal memuat panel admin.");
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [loadAnnouncementHistory, loadHearingSettingsAndHistory, loadResultsVisibility, loadVotingGateSettings]);

  async function onToggleVotingGate(nextValue: boolean) {
    if (!user || !isAdmin) {
      setMessage("Hanya admin aktif yang bisa mengatur gate voting.");
      return;
    }

    try {
      setIsSavingVotingGate(true);

      await setDoc(
        doc(db, "site_settings", "voting_gate"),
        {
          isOpen: nextValue,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
          updatedByEmail: user.email,
        },
        { merge: true },
      );

      setIsVotingOpen(nextValue);
      setMessage(nextValue
        ? "Gate voting berhasil dibuka. Mahasiswa bisa submit voting sekarang."
        : "Gate voting berhasil ditutup. Submit voting ditahan sampai dibuka lagi.");
    } catch {
      setMessage("Gagal mengubah status gate voting.");
    } finally {
      setIsSavingVotingGate(false);
    }
  }

  async function onToggleResultsVisibility(nextValue: boolean) {
    if (!user || !isAdmin) {
      setMessage("Hanya admin aktif yang bisa mengatur visibilitas hasil voting.");
      return;
    }

    try {
      setIsSavingResultsVisibility(true);

      await setDoc(
        doc(db, "site_settings", "results_visibility"),
        {
          showCandidateBreakdownPublic: nextValue,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
          updatedByEmail: user.email,
        },
        { merge: true },
      );

      setShowCandidateBreakdownPublic(nextValue);
      setMessage(nextValue
        ? "Live count per calon kini tampil untuk publik."
        : "Live count per calon kini disembunyikan untuk publik.");
    } catch {
      setMessage("Gagal mengubah visibilitas hasil voting.");
    } finally {
      setIsSavingResultsVisibility(false);
    }
  }

  async function onSaveAnnouncement() {
    if (!user || !isAdmin) {
      setMessage("Hanya admin aktif yang bisa menyimpan informasi penting.");
      return;
    }

    if (!announcementContent.trim()) {
      setMessage("Isi informasi penting tidak boleh kosong.");
      return;
    }

    try {
      setIsSavingAnnouncement(true);

      await setDoc(
        doc(db, "site_announcements", "current"),
        {
          title: announcementTitle.trim() || "Informasi Penting",
          content: announcementContent.trim(),
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
          updatedByEmail: user.email,
        },
        { merge: true },
      );

      setSelectedAnnouncementId("current");
      await loadAnnouncementHistory();
      setMessage("Informasi penting berhasil diumumkan ke dashboard.");
    } catch {
      setMessage("Gagal menyimpan informasi penting.");
    } finally {
      setIsSavingAnnouncement(false);
    }
  }

  async function onLoadAnnouncement(announcementId: string) {
    const announcement = announcementHistory.find((a) => a.id === announcementId);
    if (!announcement) {
      return;
    }

    setAnnouncementTitle(announcement.title);
    setAnnouncementContent(announcement.content);
    setSelectedAnnouncementId(announcementId);
  }

  async function onDeleteAnnouncement(announcementId: string, announcementTitle: string) {
    if (!user || !isAdmin) {
      setMessage("Hanya admin aktif yang bisa menghapus informasi penting.");
      return;
    }

    const agreed = window.confirm(`Hapus pengumuman "${announcementTitle}"?`);
    if (!agreed) {
      return;
    }

    try {
      setDeletingAnnouncementId(announcementId);

      await deleteDoc(doc(db, "site_announcements", announcementId));

      if (selectedAnnouncementId === announcementId) {
        setAnnouncementTitle("Informasi Penting");
        setAnnouncementContent("");
        setSelectedAnnouncementId("");
      }

      await loadAnnouncementHistory();
      setMessage(`Pengumuman "${announcementTitle}" berhasil dihapus.`);
    } catch {
      setMessage("Gagal menghapus pengumuman.");
    } finally {
      setDeletingAnnouncementId("");
    }
  }

  async function onSaveHearingSettings() {
    if (!user || !isAdmin) {
      setMessage("Hanya admin aktif yang bisa menyimpan pengaturan presensi.");
      return;
    }

    let targetSessionId = selectedSessionId;

    // Validasi: Kalau presensi awal aktif, tokennya wajib dipilih (tapi bisa kosong isinya)
    // Kalau belum pilih awal/akhir, auto-enable presensi awal
    if (!hearingSettings.presensiAwalAktif && !hearingSettings.presensiAkhirAktif) {
      setHearingSettings((prev) => ({
        ...prev,
        presensiAwalAktif: true,
      }));
      return;
    }

    try {
      setIsSavingSettings(true);

      if (!targetSessionId) {
        const createdRef = doc(collection(db, "hearing_sessions"));
        targetSessionId = createdRef.id;
      }

      const normalizedSessionName = hearingSettings.sessionName.trim() || `Sesi Hearing ${new Date().toLocaleString()}`;

      await setDoc(
        doc(db, "hearing_sessions", targetSessionId),
        {
          name: normalizedSessionName,
          isActive: hearingSettings.isActive,
          presensiAwalAktif: hearingSettings.presensiAwalAktif,
          presensiAkhirAktif: hearingSettings.presensiAkhirAktif,
          presensiAwalToken: hearingSettings.presensiAwalToken.trim(),
          presensiAkhirToken: hearingSettings.presensiAkhirToken.trim(),
          checkInToken: hearingSettings.presensiAwalToken.trim(),
          checkOutToken: hearingSettings.presensiAkhirToken.trim(),
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
          updatedByEmail: user.email,
        },
        { merge: true },
      );

      await setDoc(
        doc(db, "hearing_settings", "current"),
        {
          activeSessionId: hearingSettings.isActive ? targetSessionId : "",
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
          updatedByEmail: user.email,
        },
        { merge: true },
      );

      setSelectedSessionId(targetSessionId);
      setActiveSessionId(hearingSettings.isActive ? targetSessionId : "");
      await loadHearingSettingsAndHistory();
      setEditingSessionId("");
      setMessage(
        hearingSettings.isActive
          ? "Sesi presensi hearing berhasil disimpan dan diaktifkan."
          : "Sesi presensi hearing berhasil disimpan dalam kondisi nonaktif.",
      );
    } catch {
      setMessage("Gagal menyimpan sesi presensi hearing.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function onSetSessionActiveState(session: HearingSessionSummary, shouldBeActive: boolean) {
    if (!user || !isAdmin) {
      setMessage("Hanya admin aktif yang bisa mengubah status sesi.");
      return;
    }

    try {
      setTogglingSessionId(session.id);

      if (shouldBeActive) {
        const batch = writeBatch(db);

        hearingSessions.forEach((candidateSession) => {
          batch.set(
            doc(db, "hearing_sessions", candidateSession.id),
            {
              isActive: candidateSession.id === session.id,
              updatedAt: serverTimestamp(),
              updatedByUid: user.uid,
              updatedByEmail: user.email,
            },
            { merge: true },
          );
        });

        batch.set(
          doc(db, "hearing_settings", "current"),
          {
            activeSessionId: session.id,
            updatedAt: serverTimestamp(),
            updatedByUid: user.uid,
            updatedByEmail: user.email,
          },
          { merge: true },
        );

        await batch.commit();
        setMessage(`Sesi \"${session.name}\" berhasil diaktifkan.`);
      } else {
        const batch = writeBatch(db);

        batch.set(
          doc(db, "hearing_sessions", session.id),
          {
            isActive: false,
            updatedAt: serverTimestamp(),
            updatedByUid: user.uid,
            updatedByEmail: user.email,
          },
          { merge: true },
        );

        if (activeSessionId === session.id) {
          batch.set(
            doc(db, "hearing_settings", "current"),
            {
              activeSessionId: "",
              updatedAt: serverTimestamp(),
              updatedByUid: user.uid,
              updatedByEmail: user.email,
            },
            { merge: true },
          );
        }

        await batch.commit();
        setMessage(`Sesi \"${session.name}\" berhasil dinonaktifkan.`);
      }

      // PENTING: Reload state setelah update berhasil
      await loadHearingSettingsAndHistory();
    } catch {
      setMessage("Gagal mengubah status sesi presensi.");
    } finally {
      setTogglingSessionId("");
    }
  }

  async function onDeleteSession(sessionId: string, sessionName: string) {
    if (!user || !isAdmin) {
      setMessage("Hanya admin aktif yang bisa menghapus sesi.");
      return;
    }

    const agreed = window.confirm(`Hapus sesi presensi "${sessionName}"?`);
    if (!agreed) {
      return;
    }

    try {
      setDeletingSessionId(sessionId);

      await deleteDoc(doc(db, "hearing_sessions", sessionId));

      if (activeSessionId === sessionId) {
        await setDoc(
          doc(db, "hearing_settings", "current"),
          {
            activeSessionId: "",
            updatedAt: serverTimestamp(),
            updatedByUid: user.uid,
            updatedByEmail: user.email,
          },
          { merge: true },
        );
      }

      await loadHearingSettingsAndHistory();
      setMessage(`Sesi presensi "${sessionName}" berhasil dihapus.`);
    } catch {
      setMessage("Gagal menghapus sesi presensi.");
    } finally {
      setDeletingSessionId("");
    }
  }

  async function onSaveManualVoteWeight() {
    if (!user || !isAdmin) {
      setMessage("Hanya admin aktif yang bisa mengubah bobot suara.");
      return;
    }

    const normalizedNim = normalizeNim(manualWeightNim);
    if (!isValidWeightUpdateNim(normalizedNim)) {
      setMessage("NIM tidak valid. Gunakan tepat 8 digit angka (contoh: 10224056).");
      return;
    }

    const parsedWeight = parseVoteWeight(manualWeightValue);
    if (!parsedWeight) {
      setMessage("Bobot suara harus 1, 1.5, atau 2.");
      return;
    }

    try {
      setIsSavingManualWeight(true);

      await setDoc(
        doc(db, "users", normalizedNim),
        {
          nim: normalizedNim,
          bobotSuara: parsedWeight,
          bobotUpdatedAt: serverTimestamp(),
          bobotUpdatedByUid: user.uid,
          bobotUpdatedByEmail: user.email,
        },
        { merge: true },
      );

      setMessage(`Bobot suara NIM ${normalizedNim} diset ke ${parsedWeight}.`);
      setManualWeightNim("");
    } catch {
      setMessage("Gagal menyimpan bobot suara manual.");
    } finally {
      setIsSavingManualWeight(false);
    }
  }

  async function onSaveBulkVoteWeight() {
    if (!user || !isAdmin) {
      setMessage("Hanya admin aktif yang bisa import bobot suara.");
      return;
    }

    const rawLines = bulkWeightInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (rawLines.length === 0) {
      setMessage("Data bulk kosong. Isi format: nim,bobot.");
      return;
    }

    const parsedRows: Array<{ nim: string; bobotSuara: VoteWeightValue }> = [];
    const invalidLines: string[] = [];

    for (const line of rawLines) {
      const normalizedLine = line.replace(/;/g, ",").replace(/\t/g, ",");
      const [nimRaw = "", weightRaw = ""] = normalizedLine.split(",").map((part) => part.trim());

      if (nimRaw.toLowerCase() === "nim" && weightRaw.toLowerCase().includes("bobot")) {
        continue;
      }

      const nim = normalizeNim(nimRaw);
      const bobotSuara = parseVoteWeight(weightRaw);

      if (!isValidWeightUpdateNim(nim) || !bobotSuara) {
        invalidLines.push(line);
        continue;
      }

      parsedRows.push({ nim, bobotSuara });
    }

    if (parsedRows.length === 0) {
      setMessage("Tidak ada data valid. Format: nim,bobot dengan NIM 8 digit (bobot: 1 | 1.5 | 2).");
      return;
    }

    if (invalidLines.length > 0) {
      setMessage(`Ada ${invalidLines.length} baris tidak valid. Pastikan format nim,bobot dan NIM tepat 8 digit.`);
      return;
    }

    try {
      setIsSavingBulkWeight(true);

      const batch = writeBatch(db);
      for (const row of parsedRows) {
        batch.set(
          doc(db, "users", row.nim),
          {
            nim: row.nim,
            bobotSuara: row.bobotSuara,
            bobotUpdatedAt: serverTimestamp(),
            bobotUpdatedByUid: user.uid,
            bobotUpdatedByEmail: user.email,
          },
          { merge: true },
        );
      }

      await batch.commit();
      setMessage(`Import bobot suara berhasil: ${parsedRows.length} NIM tersimpan.`);
      setBulkWeightInput("");
    } catch {
      setMessage("Gagal import bobot suara bulk.");
    } finally {
      setIsSavingBulkWeight(false);
    }
  }

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
        <p className="wrap-break-word">Status: {isLoading ? "Memuat..." : message || "-"}</p>

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

        {isAdmin ? (
          <section className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
            <div className="space-y-2">
              <p className="subtitle-strong">Visibilitas Hasil Voting</p>
              <p className="text-sm text-foreground/75">
                Atur apakah rincian suara per calon (live count) ditampilkan ke publik atau hanya admin.
              </p>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-[--gold-soft] bg-[rgb(255_250_240/0.9)] p-4">
              <p className="text-sm">
                Status saat ini:{" "}
                <span className="font-semibold text-[--maroon]">
                  {showCandidateBreakdownPublic ? "Publik Bisa Lihat" : "Hanya Admin"}
                </span>
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onToggleResultsVisibility(false)}
                  disabled={isSavingResultsVisibility || !showCandidateBreakdownPublic}
                  className="button-outline inline-flex w-full justify-center disabled:opacity-60 sm:w-fit"
                >
                  Hide untuk Publik
                </button>
                <button
                  type="button"
                  onClick={() => void onToggleResultsVisibility(true)}
                  disabled={isSavingResultsVisibility || showCandidateBreakdownPublic}
                  className="button-gold inline-flex w-full justify-center disabled:opacity-60 sm:w-fit"
                >
                  Show ke Publik
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
            <div className="space-y-2">
              <p className="subtitle-strong">Gate Voting (Open / Close)</p>
              <p className="text-sm text-foreground/75">
                Kontrol ini menentukan apakah mahasiswa bisa melakukan submit voting saat ini.
              </p>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-[--gold-soft] bg-[rgb(255_250_240/0.9)] p-4">
              <p className="text-sm">
                Status saat ini:{" "}
                <span className="font-semibold text-[--maroon]">
                  {isVotingOpen ? "Voting Dibuka" : "Voting Ditutup"}
                </span>
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onToggleVotingGate(true)}
                  disabled={isSavingVotingGate || isVotingOpen}
                  className="button-gold inline-flex w-full justify-center disabled:opacity-60 sm:w-fit"
                >
                  Open Gate
                </button>
                <button
                  type="button"
                  onClick={() => void onToggleVotingGate(false)}
                  disabled={isSavingVotingGate || !isVotingOpen}
                  className="button-outline inline-flex w-full justify-center disabled:opacity-60 sm:w-fit"
                >
                  Close Gate
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
            <div className="space-y-2">
              <p className="subtitle-strong">Kelola Bobot Suara Manual</p>
              <p className="text-sm text-foreground/75">
                Gunakan bobot 1 (tidak hadir), 1.5 (hadir online), atau 2 (hadir offline). Jika bobot belum diisi, sistem pakai default 1.
              </p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="grid gap-3 rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
                <p className="font-semibold text-[--maroon]">Update Per NIM</p>

                <label className="grid gap-1">
                  <span className="font-semibold">NIM</span>
                  <input
                    value={manualWeightNim}
                    onChange={(event) => setManualWeightNim(event.target.value)}
                    className="input-luxury"
                    placeholder="Contoh: 10224056 (8 digit)"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="font-semibold">Bobot</span>
                  <select
                    value={manualWeightValue}
                    onChange={(event) => setManualWeightValue(event.target.value as `${VoteWeightValue}`)}
                    className="input-luxury"
                  >
                    {ALLOWED_VOTE_WEIGHTS.map((weight) => (
                      <option key={weight} value={String(weight)}>{weight}</option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => void onSaveManualVoteWeight()}
                  disabled={isSavingManualWeight}
                  className="button-gold inline-flex w-full justify-center disabled:opacity-60 sm:w-fit"
                >
                  {isSavingManualWeight ? "Menyimpan..." : "Simpan Bobot NIM"}
                </button>
              </section>

              <section className="grid gap-3 rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
                <p className="font-semibold text-[--maroon]">Import Bulk (CSV/Paste)</p>
                <p className="text-xs text-foreground/70">
                  Format per baris: nim,bobot dengan NIM tepat 8 digit. Contoh: 10224001,2 atau 10224002,1.5
                </p>

                <textarea
                  value={bulkWeightInput}
                  onChange={(event) => setBulkWeightInput(event.target.value)}
                  className="input-luxury min-h-40"
                  placeholder={"nim,bobot\n10224001,2\n10224002,1.5\n10224003,1"}
                />

                <button
                  type="button"
                  onClick={() => void onSaveBulkVoteWeight()}
                  disabled={isSavingBulkWeight}
                  className="button-outline inline-flex w-full justify-center disabled:opacity-60 sm:w-fit"
                >
                  {isSavingBulkWeight ? "Importing..." : "Import Bobot Bulk"}
                </button>
              </section>
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
            <div className="space-y-2">
              <p className="subtitle-strong">Informasi Penting Dashboard</p>
              <p className="text-sm text-foreground/75">
                Isi pengumuman di sini untuk ditampilkan pada card Informasi Penting di dashboard.
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="font-semibold">Judul</span>
                <input
                  value={announcementTitle}
                  onChange={(event) => setAnnouncementTitle(event.target.value)}
                  className="input-luxury"
                  placeholder="Contoh: Informasi Penting"
                />
              </label>

              <label className="grid gap-1">
                <span className="font-semibold">Isi Informasi</span>
                <textarea
                  value={announcementContent}
                  onChange={(event) => setAnnouncementContent(event.target.value)}
                  className="input-luxury min-h-28"
                  placeholder="Tulis pengumuman untuk dashboard"
                />
              </label>

              <button
                type="button"
                onClick={() => void onSaveAnnouncement()}
                disabled={isSavingAnnouncement}
                className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60 sm:w-fit"
              >
                {isSavingAnnouncement ? "Menyimpan..." : "Simpan Pengumuman"}
              </button>

              <section className="grid gap-2 rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
                <p className="font-semibold text-[--maroon]">Riwayat Pengumuman</p>
                {announcementHistory.length > 0 ? (
                  <div className="grid gap-2">
                    {announcementHistory.map((announcement) => {
                      const isSelected = selectedAnnouncementId === announcement.id;

                      return (
                        <div
                          key={announcement.id}
                          className={`rounded-2xl border px-4 py-3 ${
                            isSelected
                              ? "border-[--maroon] bg-[rgb(56_6_9/0.08)]"
                              : "border-[--gold-soft] bg-white/80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => void onLoadAnnouncement(announcement.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="font-semibold text-[--maroon]">{announcement.title}</p>
                              <p className="mt-1 text-xs text-foreground/70">
                                {announcement.updatedAt
                                  ? announcement.updatedAt.toDate().toLocaleString()
                                  : "Belum ada waktu update"}
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void onDeleteAnnouncement(announcement.id, announcement.title)
                              }
                              disabled={deletingAnnouncementId === announcement.id}
                              className="shrink-0 text-lg text-[--maroon] opacity-70 hover:opacity-100 disabled:opacity-50"
                              aria-label="Delete"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-foreground/60">Belum ada riwayat pengumuman.</p>
                )}
              </section>
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
            <div className="space-y-2">
              <p className="subtitle-strong">Pengaturan Presensi Hearing</p>
                <p className="text-sm text-foreground/75">
                  Status sesi aktif saat ini: <span className="font-semibold text-[--maroon]">{activeSessionId ? "Aktif" : "Tidak ada sesi aktif"}</span>
                </p>
            </div>

            <div className="mt-4 grid gap-4">
              <section className="grid gap-3 rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
                <p className="font-semibold text-[--maroon]">Buat Sesi Presensi Baru</p>
                {editingSessionId ? (
                  <p className="text-xs text-[--maroon] font-medium bg-[rgb(220_180_160/0.3)] rounded px-2 py-1">
                    Mode Edit: Anda sedang mengubah session yang ada. Klik &quot;Simpan Perubahan&quot; untuk menyimpan.
                  </p>
                ) : null}

                <label className="grid gap-1">
                  <span className="font-semibold">Nama Sesi</span>
                  <input
                    value={hearingSettings.sessionName}
                    onChange={(event) =>
                      setHearingSettings((previous) => ({
                        ...previous,
                        sessionName: event.target.value,
                      }))
                    }
                    className="input-luxury"
                    placeholder="Contoh: Hearing 27 Maret Sore"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="font-semibold">Token Presensi Awal</span>
                  <input
                    value={hearingSettings.presensiAwalToken}
                    onChange={(event) =>
                      setHearingSettings((previous) => ({
                        ...previous,
                        presensiAwalToken: event.target.value,
                      }))
                    }
                    className="input-luxury"
                    placeholder="Contoh: AWAL-HEARING (atau kosongkan jika tidak gunakan)"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="font-semibold">Token Presensi Akhir</span>
                  <input
                    value={hearingSettings.presensiAkhirToken}
                    onChange={(event) =>
                      setHearingSettings((previous) => ({
                        ...previous,
                        presensiAkhirToken: event.target.value,
                      }))
                    }
                    className="input-luxury"
                    placeholder="Contoh: AKHIR-HEARING (atau kosongkan jika tidak gunakan)"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void onSaveHearingSettings()}
                  disabled={isSavingSettings}
                  className="button-gold inline-flex w-full items-center justify-center disabled:opacity-60 sm:w-fit"
                >
                  {isSavingSettings ? (editingSessionId ? "Menyimpan..." : "Membuat...") : (editingSessionId ? "Simpan Perubahan" : "Buat Sesi Baru")}
                </button>

                {editingSessionId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSessionId("");
                      setHearingSettings({
                        sessionName: "",
                        isActive: false,
                        presensiAwalAktif: true,
                        presensiAkhirAktif: true,
                        presensiAwalToken: "",
                        presensiAkhirToken: "",
                      });
                      setSelectedSessionId("");
                    }}
                    className="button-outline inline-flex w-full items-center justify-center sm:w-fit"
                  >
                    Batal Edit
                  </button>
                ) : null}
              </section>

              {hearingSessions.length > 0 ? (
                <section className="grid gap-2 rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
                  <p className="font-semibold text-[--maroon]">Riwayat Sesi Presensi</p>
                  <div className="grid gap-2">
                    {hearingSessions.map((session) => {
                      const isSelected = selectedSessionId === session.id;
                      const isActive = activeSessionId === session.id;

                      return (
                        <div
                          key={session.id}
                          className={`rounded-2xl border px-4 py-3 ${isSelected ? "border-[--maroon] bg-[rgb(56_6_9/0.08)]" : "border-[--gold-soft] bg-white/80"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                void loadSessionById(session.id);
                              }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="font-semibold text-[--maroon]">{session.name}</p>
                              <p className="mt-1 text-xs text-foreground/70">
                                {session.updatedAt ? session.updatedAt.toDate().toLocaleString() : "Belum ada waktu update"}
                              </p>
                              {isActive ? (
                                <p className="mt-1 text-xs font-semibold text-[--maroon]">Sedang Aktif</p>
                              ) : null}
                            </button>

                            <button
                              type="button"
                              onClick={() => void onSetSessionActiveState(session, true)}
                              disabled={togglingSessionId === session.id}
                              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-[--gold-soft] bg-white px-3 text-xs font-semibold text-[--maroon] transition hover:bg-[rgb(56_6_9/0.08)] disabled:opacity-60"
                              title="Aktifkan sesi ini"
                            >
                              {togglingSessionId === session.id ? "..." : "Aktifkan"}
                            </button>

                            <button
                              type="button"
                              onClick={() => void onSetSessionActiveState(session, false)}
                              disabled={togglingSessionId === session.id}
                              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-[--gold-soft] bg-white px-3 text-xs font-semibold text-[--maroon] transition hover:bg-[rgb(56_6_9/0.08)] disabled:opacity-60"
                              title="Nonaktifkan sesi"
                            >
                              {togglingSessionId === session.id ? "..." : "Nonaktifkan"}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                void loadSessionById(session.id);
                              }}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[--gold-soft] bg-white text-lg text-[--maroon] transition hover:bg-[rgb(56_6_9/0.08)]"
                              aria-label={`Edit sesi ${session.name}`}
                              title="Edit sesi (form di atas)"
                            >
                              ✎
                            </button>

                            <button
                              type="button"
                              onClick={() => void onDeleteSession(session.id, session.name)}
                              disabled={deletingSessionId === session.id}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[--gold-soft] bg-white text-lg text-[--maroon] transition hover:bg-[rgb(56_6_9/0.08)] disabled:opacity-60"
                              aria-label={`Hapus sesi ${session.name}`}
                              title="Hapus sesi"
                            >
                              {deletingSessionId === session.id ? "…" : "🗑"}
                            </button>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </section>
        ) : null}

        {user ? (
          <div className="min-w-0 rounded-2xl border border-[--gold-soft] bg-white/60 p-4">
            <p>Email login: <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom font-semibold">{user.email}</span></p>
            <p>UID login: <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom font-semibold">{user.uid}</span></p>
            {!isAdmin ? (
              <p className="mt-2 text-sm text-foreground/75">
                Akses admin hanya untuk orang DPA yang didaftarkan manual di collection <span className="font-semibold">admin_users</span>
                {' '}dengan ID <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom font-semibold">{user.uid}</span> dan field <span className="font-semibold">active: true</span>.
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
                  <p className="mt-2 wrap-break-word">Actor: <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom font-semibold">{log.actorEmail ?? "-"}</span></p>
                  <p className="wrap-break-word">UID: <span className="inline-block max-w-full overflow-x-auto whitespace-nowrap align-bottom font-semibold">{log.actorUid ?? "-"}</span></p>
                  <p className="wrap-break-word">
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