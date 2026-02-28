/**
 * Shared with the Next.js app — duplicated here to avoid cross-package imports.
 */

export function normalizeName(raw: string): string {
  let name = raw.trim();

  // Handle "Last, First" format from PDFs
  const commaParts = name.split(",");
  if (commaParts.length === 2) {
    name = `${commaParts[1].trim()} ${commaParts[0].trim()}`;
  }

  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/-/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toTitleCase(name: string): string {
  return name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function toCanonicalName(raw: string): string {
  let name = raw.trim();
  const commaParts = name.split(",");
  if (commaParts.length === 2) {
    name = `${commaParts[1].trim()} ${commaParts[0].trim()}`;
  }
  return toTitleCase(name);
}
