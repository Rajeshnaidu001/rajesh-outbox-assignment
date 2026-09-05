import { parse } from "csv-parse/sync";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Accepts either a bare list of emails (one per line, optional header) or a CSV
// with an "email" column, since lead-list exports vary in shape.
export function parseRecipientsCsv(buffer: Buffer): string[] {
  const text = buffer.toString("utf-8").trim();
  if (!text) return [];

  const emails = new Set<string>();

  let rows: Record<string, string>[] = [];
  try {
    rows = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    rows = [];
  }

  const emailColumn = rows.length > 0 ? Object.keys(rows[0]).find((k) => k.toLowerCase().includes("email")) : undefined;

  if (emailColumn) {
    for (const row of rows) {
      const value = row[emailColumn]?.trim();
      if (value && EMAIL_RE.test(value)) emails.add(value);
    }
  } else {
    // No recognizable header — treat every line's first comma-separated field as an email.
    for (const line of text.split(/\r?\n/)) {
      const value = line.split(",")[0]?.trim();
      if (value && EMAIL_RE.test(value)) emails.add(value);
    }
  }

  return Array.from(emails);
}
