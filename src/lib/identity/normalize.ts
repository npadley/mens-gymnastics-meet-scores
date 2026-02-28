/**
 * Normalizes a gymnast name for fuzzy matching.
 * Handles common variations from different scoring platforms:
 * - PDF "Last, First" format
 * - Apostrophes (O'Brien)
 * - Hyphens (Smith-Jones)
 * - Accented characters
 * - Suffixes (Jr, Sr, II, III)
 */
export function normalizeName(raw: string): string {
  let name = raw.trim();

  // Handle "Last, First" format from PDFs
  const commaParts = name.split(",");
  if (commaParts.length === 2) {
    name = `${commaParts[1].trim()} ${commaParts[0].trim()}`;
  }

  return name
    .normalize("NFD") // Decompose accented characters (é → e + combining accent)
    .replace(/[\u0300-\u036f]/g, "") // Strip combining diacritics
    .toLowerCase()
    .replace(/[''`]/g, "") // Remove apostrophes (O'Brien → obrien)
    .replace(/-/g, " ") // Hyphens to spaces (Smith-Jones → smith jones)
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "") // Strip name suffixes
    .replace(/[^a-z\s]/g, "") // Strip all non-alpha, non-space
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Converts a name to title case for display.
 */
export function toTitleCase(name: string): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Derives a canonical display name from a raw name.
 * Handles PDF "Last, First" inversion and applies title case.
 */
export function toCanonicalName(raw: string): string {
  let name = raw.trim();

  // Handle "Last, First" format from PDFs
  const commaParts = name.split(",");
  if (commaParts.length === 2) {
    name = `${commaParts[1].trim()} ${commaParts[0].trim()}`;
  }

  return toTitleCase(name);
}
