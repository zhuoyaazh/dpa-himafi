import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CAMPUS_DOMAIN = "mahasiswa.itb.ac.id";
const DEFAULT_DELAY_MS = 400;
const PROGRESS_FILE = ".auth-sync-progress.json";

function parseEnv(raw) {
  const env = {};
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

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

function getFirestoreFieldValue(field) {
  if (!field || typeof field !== "object") return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return field.integerValue;
  if ("doubleValue" in field) return field.doubleValue;
  if ("booleanValue" in field) return field.booleanValue;
  return undefined;
}

function normalizeNim(value) {
  return String(value ?? "").trim().replace(/\D/g, "");
}

function toCampusEmail(nim) {
  return `${nim}@${DEFAULT_CAMPUS_DOMAIN}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllUsers(projectId, apiKey) {
  const users = [];
  let pageToken = "";

  while (true) {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`,
    );
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gagal baca Firestore users: ${response.status} ${text}`);
    }

    const data = await response.json();
    const documents = data.documents ?? [];

    for (const document of documents) {
      const fields = document.fields ?? {};
      const nim = normalizeNim(getFirestoreFieldValue(fields.nim));
      const token = String(getFirestoreFieldValue(fields.token) ?? "").trim();
      users.push({ nim, token });
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  users.sort((a, b) => a.nim.localeCompare(b.nim));
  return users;
}

async function isAuthUserRegistered(apiKey, email) {
  let response;
  let payload;

  try {
    response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: email,
          continueUri: "http://localhost",
        }),
      },
    );

    payload = await response.json();
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "NETWORK_ERROR",
    };
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? "UNKNOWN";
    return { ok: false, reason: message };
  }

  return { ok: true, registered: Boolean(payload.registered) };
}

async function createAuthUser(apiKey, email, password) {
  let response;
  let payload;

  try {
    response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: false }),
      },
    );

    payload = await response.json();
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "NETWORK_ERROR",
    };
  }

  if (response.ok) return { status: "created" };

  const message = payload?.error?.message ?? "UNKNOWN";
  if (message === "EMAIL_EXISTS") return { status: "exists" };
  if (message === "TOO_MANY_ATTEMPTS_TRY_LATER") {
    return { status: "rate_limited", reason: message };
  }

  return { status: "failed", reason: message };
}

async function readProgress(cwd) {
  try {
    const raw = await readFile(path.join(cwd, PROGRESS_FILE), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed.nextIndex === "number" ? parsed.nextIndex : 0;
  } catch {
    return 0;
  }
}

async function writeProgress(cwd, nextIndex) {
  await writeFile(
    path.join(cwd, PROGRESS_FILE),
    JSON.stringify({ nextIndex, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

function parseDelayArg() {
  const arg = process.argv.find((item) => item.startsWith("--delay="));
  if (!arg) return DEFAULT_DELAY_MS;

  const value = Number(arg.split("=")[1]);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_DELAY_MS;
  return value;
}

async function main() {
  const cwd = process.cwd();
  const delayMs = parseDelayArg();

  const envPath = path.join(cwd, ".env.local");
  const envRaw = await readFile(envPath, "utf8");
  const env = parseEnv(envRaw);

  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY / NEXT_PUBLIC_FIREBASE_PROJECT_ID belum terisi di .env.local");
  }

  console.log("Mengambil data users dari Firestore...");
  const users = await fetchAllUsers(projectId, apiKey);
  const startIndex = await readProgress(cwd);

  console.log(`Total users: ${users.length}`);
  console.log(`Mulai dari index: ${startIndex}`);
  console.log(`Delay per akun: ${delayMs}ms`);

  let created = 0;
  let exists = 0;
  let skipped = 0;
  let failed = 0;

  for (let index = startIndex; index < users.length; index += 1) {
    const user = users[index];

    if (!user.nim || !user.token) {
      skipped += 1;
      await writeProgress(cwd, index + 1);
      continue;
    }

    const email = toCampusEmail(user.nim);

    const existsCheck = await isAuthUserRegistered(apiKey, email);
    if (!existsCheck.ok) {
      failed += 1;
      console.log(`Cek user gagal ${email}: ${existsCheck.reason}`);
      await writeProgress(cwd, index + 1);
      await sleep(delayMs);
      continue;
    }

    if (existsCheck.registered) {
      exists += 1;
      await writeProgress(cwd, index + 1);
      await sleep(delayMs);
      continue;
    }

    const result = await createAuthUser(apiKey, email, user.token);

    if (result.status === "created") {
      created += 1;
    } else if (result.status === "exists") {
      exists += 1;
    } else if (result.status === "rate_limited") {
      console.log(`Rate limited di ${email}. Stop dulu, jalankan lagi beberapa menit lagi.`);
      await writeProgress(cwd, index);
      break;
    } else {
      failed += 1;
      console.log(`Gagal buat ${email}: ${result.reason}`);
    }

    await writeProgress(cwd, index + 1);
    await sleep(delayMs);
  }

  const nextIndex = await readProgress(cwd);

  console.log("Selesai batch sinkronisasi Auth.");
  console.log(`Created: ${created}`);
  console.log(`Exists : ${exists}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed : ${failed}`);
  console.log(`Next index untuk lanjut: ${nextIndex}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
