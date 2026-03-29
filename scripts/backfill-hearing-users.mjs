import { readFile } from "node:fs/promises";
import path from "node:path";
import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const BATCH_LIMIT = 400;

function parseEnv(raw) {
  const env = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function normalizeNim(value) {
  return String(value ?? "").trim().replace(/\D/g, "");
}

function classifyAttendance(attendance) {
  const hasPresensiAwal = Boolean(attendance?.presensiAwalAt ?? attendance?.checkInAt);
  const hasPresensiAkhir = Boolean(attendance?.presensiAkhirAt ?? attendance?.checkOutAt);

  const classification = hasPresensiAwal && hasPresensiAkhir
    ? "awal_akhir"
    : hasPresensiAwal
      ? "awal_only"
      : hasPresensiAkhir
        ? "akhir_only"
        : "tidak_valid";

  return {
    hasPresensiAwal,
    hasPresensiAkhir,
    classification,
    isStatusHearing: hasPresensiAwal && hasPresensiAkhir,
  };
}

async function main() {
  const cwd = process.cwd();
  const envRaw = await readFile(path.join(cwd, ".env.local"), "utf8");
  const env = parseEnv(envRaw);

  const firebaseConfig = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };

  const adminEmail = env.RECAP_ADMIN_EMAIL;
  const adminPassword = env.RECAP_ADMIN_PASSWORD;

  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
    throw new Error("Konfigurasi Firebase belum lengkap di .env.local.");
  }

  if (!adminEmail || !adminPassword) {
    throw new Error("Isi RECAP_ADMIN_EMAIL dan RECAP_ADMIN_PASSWORD di .env.local.");
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

  console.log("Mengambil data hearing_attendance...");
  const attendanceSnapshot = await getDocs(
    query(collection(db, "hearing_attendance"), orderBy("updatedAt", "desc"), limit(5000)),
  );

  if (attendanceSnapshot.empty) {
    console.log("Tidak ada data hearing_attendance untuk dibackfill.");
    return;
  }

  let processed = 0;
  let batch = writeBatch(db);
  let pending = 0;

  for (const attendanceDoc of attendanceSnapshot.docs) {
    const attendance = attendanceDoc.data();
    const nim = normalizeNim(attendance.nim ?? attendanceDoc.id);

    if (!nim) {
      continue;
    }

    const summary = classifyAttendance(attendance);

    batch.set(
      doc(db, "users", nim),
      {
        nim,
        statusHearing: summary.isStatusHearing,
        status_hearing: summary.isStatusHearing,
        hearingClassification: summary.classification,
        hearingUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        presensiAwalAt: attendance.presensiAwalAt ?? attendance.checkInAt ?? null,
        presensiAkhirAt: attendance.presensiAkhirAt ?? attendance.checkOutAt ?? null,
        presensiAwalProofUrl: attendance.presensiAwalProofUrl ?? attendance.checkInProofUrl ?? "",
        presensiAkhirProofUrl: attendance.presensiAkhirProofUrl ?? attendance.checkOutProofUrl ?? "",
        checkInAt: attendance.checkInAt ?? attendance.presensiAwalAt ?? null,
        checkOutAt: attendance.checkOutAt ?? attendance.presensiAkhirAt ?? null,
        checkInProofUrl: attendance.checkInProofUrl ?? attendance.presensiAwalProofUrl ?? "",
        checkOutProofUrl: attendance.checkOutProofUrl ?? attendance.presensiAkhirProofUrl ?? "",
      },
      { merge: true },
    );

    pending += 1;
    processed += 1;

    if (pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      pending = 0;
      console.log(`Progress backfill: ${processed}/${attendanceSnapshot.size}`);
    }
  }

  if (pending > 0) {
    await batch.commit();
  }

  console.log(`Backfill selesai. Users diupdate: ${processed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
