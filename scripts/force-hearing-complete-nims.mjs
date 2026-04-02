import { readFile } from "node:fs/promises";
import path from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

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
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
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
    throw new Error("Konfigurasi Firebase belum lengkap di .env.local");
  }

  if (!adminEmail || !adminPassword) {
    throw new Error("Isi RECAP_ADMIN_EMAIL dan RECAP_ADMIN_PASSWORD di .env.local");
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

  const uniqueNims = [...new Set(TARGET_NIMS.map((nim) => nim.trim()))].filter(Boolean);
  let successCount = 0;

  for (const nim of uniqueNims) {
    await setDoc(
      doc(db, "users", nim),
      {
        nim,
        statusHearing: true,
        status_hearing: true,
        hearingClassification: "awal_akhir",
        hearingUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        presensiAwalAt: serverTimestamp(),
        presensiAkhirAt: serverTimestamp(),
        checkInAt: serverTimestamp(),
        checkOutAt: serverTimestamp(),
        hearingManualOverride: true,
      },
      { merge: true },
    );

    successCount += 1;
    console.log(`OK ${nim}`);
  }

  console.log(`Selesai. Total NIM dipaksa hearing lengkap: ${successCount}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
