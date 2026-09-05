const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Client-side mirror of the backend's parser (backend/src/services/csv.ts), used only to
// preview recipient chips before upload — the server re-parses the file authoritatively.
export function parseRecipientsCsv(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/).map((l) => l.split(","));
  const header = lines[0]?.map((h) => h.trim().toLowerCase());
  const emailColumnIndex = header?.findIndex((h) => h.includes("email"));

  const emails = new Set<string>();

  if (emailColumnIndex !== undefined && emailColumnIndex >= 0) {
    for (const row of lines.slice(1)) {
      const value = row[emailColumnIndex]?.trim();
      if (value && EMAIL_RE.test(value)) emails.add(value);
    }
  } else {
    for (const row of lines) {
      const value = row[0]?.trim();
      if (value && EMAIL_RE.test(value)) emails.add(value);
    }
  }

  return Array.from(emails);
}
