import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_OUTPUT_DIR = "exports";
const DEFAULT_COLLECTION_PAGE_SIZE = 300;
const DEFAULT_FETCH_RETRY = 4;
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.message} ${(error.cause && error.cause.message) || ""}`.toLowerCase();

  return (
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("network") ||
    message.includes("fetch failed")
  );
}

async function fetchJsonWithRetry(url, collectionName) {
  let lastError;

  for (let attempt = 1; attempt <= DEFAULT_FETCH_RETRY; attempt += 1) {
    try {
      const response = await fetch(url);

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

async function fetchCollection(projectId, apiKey, collectionName) {
  const rows = [];
  let pageToken = "";
  let hasRetriedFromFirstPage = false;

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
      payload = await fetchJsonWithRetry(url, collectionName);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (!hasRetriedFromFirstPage && message.includes("Invalid page token")) {
        console.log("Token pagination kedaluwarsa. Mengulang fetch dari halaman pertama...");
        rows.length = 0;
        pageToken = "";
        hasRetriedFromFirstPage = true;
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

function buildRecapRows(users, attendanceRows) {
  const usersByNim = new Map();
  const attendanceByNim = new Map();

  for (const user of users) {
    const nim = normalizeNim(user.nim ?? user.id);
    if (!nim) continue;
    usersByNim.set(nim, user);
  }

  for (const attendance of attendanceRows) {
    const nim = normalizeNim(attendance.nim ?? attendance.id);
    if (!nim) continue;
    attendanceByNim.set(nim, attendance);
  }

  const allNims = new Set([...usersByNim.keys(), ...attendanceByNim.keys()]);
  const rows = [];

  for (const nim of allNims) {
    const user = usersByNim.get(nim);
    const attendance = attendanceByNim.get(nim);

    const presensiAwalAt = toIsoDateString(attendance?.presensiAwalAt ?? attendance?.checkInAt);
    const presensiAkhirAt = toIsoDateString(attendance?.presensiAkhirAt ?? attendance?.checkOutAt);

    const row = {
      nim,
      angkatan: user?.angkatan == null ? "" : String(user.angkatan),
      email: String(attendance?.email ?? user?.email ?? user?.voterEmail ?? ""),
      uid: String(attendance?.uid ?? user?.uid ?? user?.voterUid ?? ""),
      statusHearing: Boolean(attendance?.statusHearing ?? attendance?.status_hearing),
      classification: String(attendance?.classification ?? ""),
      presensiAwalAt,
      presensiAkhirAt,
      presensiAwalProofUrl: String(attendance?.presensiAwalProofUrl ?? attendance?.checkInProofUrl ?? ""),
      presensiAkhirProofUrl: String(attendance?.presensiAkhirProofUrl ?? attendance?.checkOutProofUrl ?? ""),
      sudahVote: Boolean(user?.sudahVote ?? user?.sudah_vote),
      bobotSuara: Number(user?.bobotSuara ?? 1),
      hasAttendanceDoc: Boolean(attendance),
      hasUserDoc: Boolean(user),
      attendanceDocId: String(attendance?.id ?? ""),
      userDocId: String(user?.id ?? ""),
    };

    rows.push(row);
  }

  rows.sort((a, b) => a.nim.localeCompare(b.nim));
  return rows;
}

function makeSummary(rows) {
  const withAttendance = rows.filter((row) => row.hasAttendanceDoc);
  const hadirLengkap = rows.filter((row) => row.classification === "awal_akhir");
  const awalOnly = rows.filter((row) => row.classification === "awal_only");
  const akhirOnly = rows.filter((row) => row.classification === "akhir_only");

  return {
    totalBarisRekap: rows.length,
    totalPesertaDenganAttendanceDoc: withAttendance.length,
    totalHadirLengkapAwalAkhir: hadirLengkap.length,
    totalHadirAwalSaja: awalOnly.length,
    totalHadirAkhirSaja: akhirOnly.length,
    totalStatusHearingTrue: rows.filter((row) => row.statusHearing).length,
    totalAnomaliAttendanceTanpaUserDoc: rows.filter((row) => row.hasAttendanceDoc && !row.hasUserDoc).length,
    generatedAt: new Date().toISOString(),
  };
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

  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_API_KEY dan NEXT_PUBLIC_FIREBASE_PROJECT_ID harus ada di .env.local",
    );
  }

  console.log("Mengambil data users...");
  const users = await fetchCollection(projectId, apiKey, "users");

  console.log("Mengambil data hearing_attendance...");
  const attendanceRows = await fetchCollection(projectId, apiKey, "hearing_attendance");

  const rows = buildRecapRows(users, attendanceRows);
  const summary = makeSummary(rows);

  const outputDir = path.join(cwd, DEFAULT_OUTPUT_DIR);
  await mkdir(outputDir, { recursive: true });

  const stamp = getTimestampToken();
  const jsonPath = path.join(outputDir, `hearing-recap-${stamp}.json`);
  const csvPath = path.join(outputDir, `hearing-recap-${stamp}.csv`);

  const columns = [
    "nim",
    "angkatan",
    "email",
    "uid",
    "statusHearing",
    "classification",
    "presensiAwalAt",
    "presensiAkhirAt",
    "presensiAwalProofUrl",
    "presensiAkhirProofUrl",
    "sudahVote",
    "bobotSuara",
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

  console.log("Rekap hearing berhasil dibuat.");
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV : ${csvPath}`);
  console.log("Ringkasan:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
