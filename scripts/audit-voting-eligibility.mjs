import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = "exports";
const FETCH_RETRY = 4;
const RETRY_BASE_DELAY_MS = 500;
const CAMPUS_DOMAINS = [
  "mahasiswa.itb.ac.id",
  "student.itb.ac.id",
  "itb.ac.id",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("timedout") ||
    message.includes("network")
  );
}

async function fetchWithRetry(url, options) {
  let lastError;

  for (let attempt = 1; attempt <= FETCH_RETRY; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;

      if (!isRetryableFetchError(error) || attempt === FETCH_RETRY) {
        throw error;
      }

      const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function parseEnv(raw) {
  const env = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
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
  if (!value || typeof value !== "object") return undefined;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;

  if ("mapValue" in value) {
    const out = {};
    const fields = value.mapValue?.fields ?? {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = parseFirestoreValue(v);
    }
    return out;
  }

  if ("arrayValue" in value) {
    return (value.arrayValue?.values ?? []).map((item) => parseFirestoreValue(item));
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
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetchWithRetry(url);
    if (!response.ok) {
      const body = await response.text();

      if (!hasRetriedFromFirstPage && body.includes("Invalid page token")) {
        hasRetriedFromFirstPage = true;
        rows.length = 0;
        pageToken = "";
        continue;
      }

      throw new Error(`Gagal mengambil ${collectionName}: ${response.status} ${body}`);
    }

    const payload = await response.json();
    for (const doc of payload.documents ?? []) {
      rows.push(parseFirestoreDocument(doc));
    }

    if (!payload.nextPageToken) break;
    pageToken = payload.nextPageToken;
  }

  return rows;
}

async function checkAuthEmailRegistered(apiKey, email) {
  const response = await fetchWithRetry(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, continueUri: "http://localhost" }),
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      registered: false,
      reason: payload?.error?.message ?? "UNKNOWN",
    };
  }

  return {
    ok: true,
    registered: Boolean(payload.registered),
    reason: "",
  };
}

function getTimestampToken() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
}

async function main() {
  const cwd = process.cwd();
  const envRaw = await readFile(path.join(cwd, ".env.local"), "utf8");
  const env = parseEnv(envRaw);

  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY dan NEXT_PUBLIC_FIREBASE_PROJECT_ID wajib terisi di .env.local");
  }

  const [users, votes] = await Promise.all([
    fetchCollection(projectId, apiKey, "users"),
    fetchCollection(projectId, apiKey, "suara_masuk"),
  ]);

  const usersByNim = new Map();
  for (const user of users) {
    const nim = normalizeNim(user.nim ?? user.id);
    if (!nim) continue;
    usersByNim.set(nim, user);
  }

  const votesByNim = new Map();
  for (const vote of votes) {
    const nim = normalizeNim(vote.nim ?? vote.id);
    if (!nim) continue;
    votesByNim.set(nim, vote);
  }

  const allNims = [...usersByNim.keys()].sort((a, b) => a.localeCompare(b));
  const authCache = new Map();
  const rows = [];

  for (const nim of allNims) {
    const user = usersByNim.get(nim);
    const vote = votesByNim.get(nim);
    const sudahVoteUser = Boolean(user?.sudahVote ?? user?.sudah_vote);
    const hasVoteDoc = Boolean(vote);
    const reasons = [];

    if (nim.length < 5 || nim.length > 20) {
      reasons.push("nim_tidak_valid_aturan_firestore");
    }

    if (sudahVoteUser && !hasVoteDoc) {
      reasons.push("user_flag_sudah_vote_tanpa_vote_doc");
    }

    if (hasVoteDoc && !sudahVoteUser) {
      reasons.push("vote_doc_ada_tapi_user_flag_belum_vote");
    }

    let hasRegisteredCampusAuth = false;
    const authMatches = [];

    for (const domain of CAMPUS_DOMAINS) {
      const email = `${nim}@${domain}`;

      if (!authCache.has(email)) {
        authCache.set(email, await checkAuthEmailRegistered(apiKey, email));
      }

      const result = authCache.get(email);
      if (result.ok && result.registered) {
        hasRegisteredCampusAuth = true;
        authMatches.push(email);
      }
    }

    if (!hasVoteDoc && !hasRegisteredCampusAuth) {
      reasons.push("akun_auth_email_kampus_tidak_ditemukan");
    }

    rows.push({
      nim,
      hasUserDoc: Boolean(user),
      hasVoteDoc,
      sudahVoteUser,
      canVoteNowByDataCheck: !hasVoteDoc && reasons.length === 0,
      hasRegisteredCampusAuth,
      registeredCampusEmails: authMatches,
      candidateId: String(vote?.candidateId ?? ""),
      reasons,
    });
  }

  const summary = {
    totalUsers: rows.length,
    totalSudahVoteByUserFlag: rows.filter((r) => r.sudahVoteUser).length,
    totalVoteDocs: rows.filter((r) => r.hasVoteDoc).length,
    totalCanVoteNowByDataCheck: rows.filter((r) => r.canVoteNowByDataCheck).length,
    totalBlockedByDataCheck: rows.filter((r) => !r.canVoteNowByDataCheck && !r.hasVoteDoc).length,
    totalSyncAnomalies: rows.filter((r) => r.reasons.includes("user_flag_sudah_vote_tanpa_vote_doc") || r.reasons.includes("vote_doc_ada_tapi_user_flag_belum_vote")).length,
    totalMissingAuthForUnvoted: rows.filter((r) => r.reasons.includes("akun_auth_email_kampus_tidak_ditemukan")).length,
    generatedAt: new Date().toISOString(),
  };

  const outputDir = path.join(cwd, OUTPUT_DIR);
  await mkdir(outputDir, { recursive: true });

  const stamp = getTimestampToken();
  const outPath = path.join(outputDir, `voting-eligibility-audit-${stamp}.json`);

  await writeFile(
    outPath,
    JSON.stringify({ summary, rows }, null, 2),
    "utf8",
  );

  console.log("Audit voting eligibility selesai.");
  console.log(`Output: ${outPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Audit gagal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
