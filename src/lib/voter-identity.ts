const CAMPUS_EMAIL_PATTERN = /^[^@]+@([a-z0-9-]+\.)*itb\.ac\.id$/i;

export const PRIMARY_CAMPUS_EMAIL_DOMAIN = "mahasiswa.itb.ac.id";

function getEmailParts(email: string) {
  const trimmedEmail = email.trim().toLowerCase();
  const [localPart = "", domain = ""] = trimmedEmail.split("@");
  return { localPart, domain };
}

export function normalizeNim(nim: string) {
  return nim.trim().replace(/\D/g, "");
}

export function nimToCampusEmail(nim: string) {
  const normalizedNim = normalizeNim(nim);
  if (!normalizedNim) {
    return "";
  }

  return `${normalizedNim}@${PRIMARY_CAMPUS_EMAIL_DOMAIN}`;
}

export function isCampusEmail(email: string) {
  const trimmedEmail = email.trim();
  return CAMPUS_EMAIL_PATTERN.test(trimmedEmail);
}

export function extractNimFromCampusEmail(email: string | null | undefined) {
  if (!email) {
    return "";
  }

  const { localPart } = getEmailParts(email);
  const leadingDigits = localPart.match(/^\d+/)?.[0] ?? "";
  return normalizeNim(leadingDigits);
}

export function doesNimMatchCampusEmail(nim: string, email: string) {
  const normalizedNim = normalizeNim(nim);
  const { localPart } = getEmailParts(email);

  if (!normalizedNim || !localPart) {
    return false;
  }

  return localPart.startsWith(normalizedNim);
}

export function getVoterIdentityError(nim: string, email: string | null | undefined) {
  if (!email) {
    return "Email akun tidak ditemukan. Silakan login ulang.";
  }

  if (!isCampusEmail(email)) {
    return "Gunakan email kampus ITB (domain *.itb.ac.id) untuk voting.";
  }

  if (!doesNimMatchCampusEmail(nim, email)) {
    return "NIM harus sesuai bagian awal email kampus kamu.";
  }

  return null;
}
