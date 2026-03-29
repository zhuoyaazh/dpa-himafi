import { readFile } from "node:fs/promises";
import path from "node:path";
import { initializeApp } from "firebase/app";
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
    throw new Error("Konfigurasi Firebase wajib lengkap di .env.local (API key, auth domain, project id).");
  }

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Isi RECAP_ADMIN_EMAIL dan RECAP_ADMIN_PASSWORD di .env.local untuk generate FIREBASE_ID_TOKEN.",
    );
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  const credential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
  const idToken = await credential.user.getIdToken();

  console.log("Copy token berikut ke .env.local sebagai FIREBASE_ID_TOKEN:");
  console.log(idToken);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
