import { readFile } from "node:fs/promises";
import path from "node:path";
import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

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
  console.log("Admin terautentikasi.");

  const TARGET_NIMS = [
    "10222013",
    "10223060",
    "10223075",
    "10222055",
    "10224070",
    "10224056",
    "10223039",
    "10223087",
    "10222059",
    "10223008",
    "10222034",
    "10223072",
  ];

  console.log(`Mengupdate bobot untuk ${TARGET_NIMS.length} NIM (bobot=2, offline attendance)...`);

  let batch = writeBatch(db);
  let pending = 0;

  for (const nimRaw of TARGET_NIMS) {
    const nim = normalizeNim(nimRaw);

    if (!nim) {
      console.log(`SKIP [invalid] ${nimRaw}`);
      continue;
    }

    batch.set(
      doc(db, "users", nim),
      {
        bobotSuara: 2,
        attendanceType: "offline",
        bobotUpdatedAt: serverTimestamp(),
        bobotManualOverride: true,
      },
      { merge: true },
    );

    pending += 1;
    console.log(`OK ${nim}`);

    if (pending >= 25) {
      await batch.commit();
      batch = writeBatch(db);
      pending = 0;
    }
  }

  if (pending > 0) {
    await batch.commit();
  }

  console.log(`Selesai. Total NIM bobot offline: ${TARGET_NIMS.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
