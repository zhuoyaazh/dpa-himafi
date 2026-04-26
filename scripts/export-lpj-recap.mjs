import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const DEFAULT_OUTPUT_DIR = "exports";
const DEFAULT_COLLECTION_PAGE_SIZE = 300;
const DEFAULT_FETCH_RETRY = 4;
const RETRY_BASE_DELAY_MS = 500;
const MAX_INVALID_PAGE_TOKEN_RECOVERY = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.message} ${(error.cause && error.cause.message) || ""}`.toLowerCase();

  return (
    message.includes("econnreset")
    || message.includes("etimedout")
    || message.includes("network")
    || message.includes("fetch failed")
  );
}

async function fetchJsonWithRetry(url, collectionName, authToken = "") {
  let lastError;

  for (let attempt = 1; attempt <= DEFAULT_FETCH_RETRY; attempt += 1) {
    try {
      const headers = authToken
        ? {
            Authorization: `Bearer ${authToken}`,
          }
        : undefined;

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Gagal mengambil collection ${collectionName}: ${response.status} ${body}`,
        );
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      if (!isRetryableFetchError(error) || attempt === DEFAULT_FETCH_RETRY) {
        throw error;
      }

      const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.log(
        `Koneksi ke Firestore sempat gagal (percobaan ${attempt}/${DEFAULT_FETCH_RETRY}). Ulang dalam ${delayMs}ms...`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

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

function normalizeNim(value) {
  return String(value ?? "").trim().replace(/\D/g, "");
}

function parseFirestoreValue(value) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;

  if ("mapValue" in value) {
    const fields = value.mapValue?.fields ?? {};
    const result = {};

    for (const [key, innerValue] of Object.entries(fields)) {
      result[key] = parseFirestoreValue(innerValue);
    }

    return result;
  }

  if ("arrayValue" in value) {
    const values = value.arrayValue?.values ?? [];
    return values.map((item) => parseFirestoreValue(item));
  }

  return undefined;
}

function parseFirestoreDocument(doc) {
  const fields = doc?.fields ?? {};
  const parsed = {};

  for (const [key, value] of Object.entries(fields)) {
    parsed[key] = parseFirestoreValue(value);
  }

  const name = String(doc?.name ?? "");
  const id = name.split("/").pop() ?? "";

  return { id, ...parsed };
}

async function fetchCollection(projectId, apiKey, collectionName, authToken = "") {
  const rows = [];
  let pageToken = "";
  let invalidPageTokenRecoveryCount = 0;

  while (true) {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`,
    );

    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", String(DEFAULT_COLLECTION_PAGE_SIZE));

    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    let payload;

    try {
      payload = await fetchJsonWithRetry(url, collectionName, authToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (
        message.includes("Invalid page token")
        && invalidPageTokenRecoveryCount < MAX_INVALID_PAGE_TOKEN_RECOVERY
      ) {
        console.log("Token pagination kedaluwarsa. Mengulang fetch dari halaman pertama...");
        rows.length = 0;
        pageToken = "";
        invalidPageTokenRecoveryCount += 1;
        continue;
      }

      throw error;
    }

    const documents = payload.documents ?? [];

    for (const document of documents) {
      rows.push(parseFirestoreDocument(document));
    }

    if (!payload.nextPageToken) {
      break;
    }

    pageToken = payload.nextPageToken;
  }

  return rows;
}

async function resolveAuthToken(env, firebaseConfig) {
  const adminEmail = env.RECAP_ADMIN_EMAIL?.trim() ?? "";
  const adminPassword = env.RECAP_ADMIN_PASSWORD?.trim() ?? "";
  const fallbackToken = env.FIREBASE_ID_TOKEN?.trim() ?? "";

  if (adminEmail && adminPassword) {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const credential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    return credential.user.getIdToken();
  }

  return fallbackToken;
}

function toIsoDateString(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toISOString();
}

function toCsv(rows, columns) {
  const escapeCell = (value) => {
    const text = value == null ? "" : String(value);
    const escaped = text.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const header = columns.map((column) => escapeCell(column)).join(",");
  const body = rows
    .map((row) => columns.map((column) => escapeCell(row[column])).join(","))
    .join("\n");

  return `${header}\n${body}`;
}

function classifyLpjAttendance(attendance) {
  return attendance?.mode === "akhir" ? "presensiAkhir" : "presensiAwal";
}

function extractSessionIdFromAttendanceId(attendanceId) {
  const raw = String(attendanceId ?? "");
  const lastUnderscore = raw.lastIndexOf("_");
  if (lastUnderscore <= 0) {
    return "";
  }

  const beforeMode = raw.slice(0, lastUnderscore);
  const secondLastUnderscore = beforeMode.lastIndexOf("_");
  if (secondLastUnderscore <= 0) {
    return "";
  }

  return beforeMode.slice(0, secondLastUnderscore);
}

function buildRecapRows(users, attendanceRows) {
  const usersByNim = new Map();
  const attendanceByKey = new Map();

  for (const user of users) {
    const nim = normalizeNim(user.nim ?? user.id);
    if (!nim) continue;
    usersByNim.set(nim, user);
  }

  for (const attendance of attendanceRows) {
    const nim = normalizeNim(attendance.nim ?? attendance.id);
    if (!nim) continue;

    const mode = String(attendance.mode ?? "awal");
    attendanceByKey.set(`${nim}_${mode}`, attendance);
  }

  const rows = [];

  for (const [key, attendance] of attendanceByKey.entries()) {
    const [nim] = key.split("_");
    const user = usersByNim.get(nim);

    const submittedAt = toIsoDateString(attendance?.submittedAt);
    const attendanceMode = String(attendance?.mode ?? "awal");
    const sessionId = String(attendance?.sessionId ?? attendance?.recordId?.split("_")?.[0] ?? "");
    const sessionName = String(attendance?.sessionName ?? "");

    const row = {
      nim,
      nama: String(attendance?.nama ?? user?.nama ?? user?.nickName ?? ""),
      email: String(user?.email ?? ""),
      uid: String(user?.uid ?? ""),
      sessionId: sessionId || extractSessionIdFromAttendanceId(attendance?.id),
      sessionName,
      mode: attendanceMode,
      modeField: classifyLpjAttendance(attendance),
      photoUrl: String(attendance?.photoUrl ?? ""),
      submittedAt,
      hasAttendanceDoc: Boolean(attendance),
      hasUserDoc: Boolean(user),
      attendanceDocId: String(attendance?.id ?? ""),
      userDocId: String(user?.id ?? ""),
    };

    rows.push(row);
  }

  rows.sort((a, b) => a.nim.localeCompare(b.nim) || a.mode.localeCompare(b.mode));
  return rows;
}

function makeSummary(rows) {
  const attendanceOnlyRows = rows.filter((row) => row.hasAttendanceDoc);

  return {
    totalBarisRekap: rows.length,
    totalPesertaDenganAttendanceDoc: attendanceOnlyRows.length,
    totalPresensiAwal: rows.filter((row) => row.mode === "awal").length,
    totalPresensiAkhir: rows.filter((row) => row.mode === "akhir").length,
    totalAnomaliAttendanceTanpaUserDoc: rows.filter((row) => row.hasAttendanceDoc && !row.hasUserDoc).length,
    generatedAt: new Date().toISOString(),
  };
}

function parseRecapMode(argv) {
  const modeArgIndex = argv.findIndex((value) => value === "--mode" || value === "-m");
  const rawMode = modeArgIndex >= 0 ? String(argv[modeArgIndex + 1] ?? "") : "";
  const normalizedMode = rawMode.trim().toLowerCase();

  if (!normalizedMode) {
    return "all";
  }

  if (normalizedMode === "all" || normalizedMode === "awal" || normalizedMode === "akhir") {
    return normalizedMode;
  }

  throw new Error("Mode recap LPJ harus salah satu dari: all, awal, akhir.");
}

function filterRowsByMode(rows, mode) {
  if (mode === "all") {
    return rows;
  }

  return rows.filter((row) => row.mode === mode);
}

function getModeLabel(mode) {
  return mode === "all" ? "all" : mode;
}

function getTimestampToken() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ];

  return parts.join("");
}

async function main() {
  const cwd = process.cwd();
  const envRaw = await readFile(path.join(cwd, ".env.local"), "utf8");
  const env = parseEnv(envRaw);
  const mode = parseRecapMode(process.argv.slice(2));

  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const firebaseIdToken = await resolveAuthToken(env, {
    apiKey,
    authDomain,
    projectId,
  });

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, dan NEXT_PUBLIC_FIREBASE_PROJECT_ID harus ada di .env.local",
    );
  }

  console.log("Mengambil data users...");
  const users = await fetchCollection(projectId, apiKey, "users", firebaseIdToken);

  console.log("Mengambil data lpj_attendance...");
  let attendanceRows = [];

  try {
    attendanceRows = await fetchCollection(projectId, apiKey, "lpj_attendance", firebaseIdToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const isPermissionDenied =
      message.includes("PERMISSION_DENIED")
      || message.includes("Missing or insufficient permissions");

    if (!isPermissionDenied) {
      throw error;
    }

    console.warn(
      "Akses lpj_attendance ditolak oleh Firestore Rules. Lanjutkan export memakai fallback data users.",
    );

    if (!firebaseIdToken) {
      console.warn(
        "Tip: set FIREBASE_ID_TOKEN (akun admin) di .env.local untuk recap LPJ lengkap termasuk detail presensi.",
      );
    }
  }

  const rows = filterRowsByMode(buildRecapRows(users, attendanceRows), mode);
  const summary = {
    ...makeSummary(rows),
    mode,
  };

  const outputDir = path.join(cwd, DEFAULT_OUTPUT_DIR);
  await mkdir(outputDir, { recursive: true });

  const stamp = getTimestampToken();
  const modeLabel = getModeLabel(mode);
  const jsonPath = path.join(outputDir, `lpj-recap-${modeLabel}-${stamp}.json`);
  const csvPath = path.join(outputDir, `lpj-recap-${modeLabel}-${stamp}.csv`);

  const columns = [
    "nim",
    "nama",
    "email",
    "uid",
    "sessionId",
    "sessionName",
    "mode",
    "modeField",
    "photoUrl",
    "submittedAt",
    "hasAttendanceDoc",
    "hasUserDoc",
    "attendanceDocId",
    "userDocId",
  ];

  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        summary,
        rows,
      },
      null,
      2,
    ),
    "utf8",
  );

  const csv = toCsv(rows, columns);
  await writeFile(csvPath, csv, "utf8");

  console.log("Rekap LPJ berhasil dibuat.");
  console.log(`Mode: ${mode}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV : ${csvPath}`);
  console.log("Ringkasan:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});