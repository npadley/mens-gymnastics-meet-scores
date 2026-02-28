import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: string | number | null): string {
  if (score === null || score === undefined) return "—";
  const n = typeof score === "string" ? parseFloat(score) : score;
  if (isNaN(n)) return "—";
  return n.toFixed(3);
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function levelLabel(level: string): string {
  const labels: Record<string, string> = {
    elite: "Elite",
    junior_elite: "Jr. Elite",
    level_10: "Level 10",
    level_9: "Level 9",
    level_8: "Level 8",
    level_7: "Level 7",
    level_6: "Level 6",
    ncaa: "NCAA",
    gymact: "GymACT",
    naigc: "NAIGC",
    development: "Development",
  };
  return labels[level] ?? level;
}

export function levelColor(level: string): string {
  const colors: Record<string, string> = {
    elite: "bg-yellow-100 text-yellow-800",
    junior_elite: "bg-orange-100 text-orange-800",
    level_10: "bg-blue-100 text-blue-800",
    level_9: "bg-blue-100 text-blue-700",
    level_8: "bg-sky-100 text-sky-700",
    level_7: "bg-cyan-100 text-cyan-700",
    level_6: "bg-teal-100 text-teal-700",
    ncaa: "bg-purple-100 text-purple-800",
    gymact: "bg-pink-100 text-pink-700",
    naigc: "bg-gray-100 text-gray-700",
    development: "bg-green-100 text-green-700",
  };
  return colors[level] ?? "bg-gray-100 text-gray-700";
}

export const APPARATUS = ["FX", "PH", "SR", "VT", "PB", "HB", "AA"] as const;
export type Apparatus = (typeof APPARATUS)[number];

export const APPARATUS_LABELS: Record<Apparatus, string> = {
  FX: "Floor",
  PH: "Pommel",
  SR: "Rings",
  VT: "Vault",
  PB: "P-Bars",
  HB: "High Bar",
  AA: "All-Around",
};
