// Formats d'affichage (fuseau du Maroc, français).
export const TZ = "Africa/Casablanca";

const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const partsFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" });

const clean = (s: string) => s.replace(".", "");

export function dayLabel(d: Date) {
  const s = dayFmt.format(d);
  return clean(s.charAt(0).toUpperCase() + s.slice(1));
}

export function timeLabel(d: Date) {
  return timeFmt.format(d);
}

/** Pastille date d'une carte : { dow: "SAM", day: "17", mon: "OCT" } */
export function dateStamp(d: Date) {
  const parts = Object.fromEntries(partsFmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    dow: clean(parts.weekday ?? "").toUpperCase(),
    day: parts.day ?? "",
    mon: clean(parts.month ?? "").toUpperCase(),
  };
}

/** « Sam 17 oct · 09:00 » ou « Sam 17 → Dim 18 oct » */
export function rangeLabel(debut: Date, fin: Date) {
  const sameDay = dayLabel(debut) === dayLabel(fin);
  return sameDay ? `${dayLabel(debut)} · ${timeLabel(debut)}` : `${dayLabel(debut)} → ${dayLabel(fin)}`;
}

export function priceLabel(prix: number) {
  return prix === 0 ? "0 DH" : `${Number.isInteger(prix) ? prix : prix.toFixed(2)} DH`;
}

export const CATEGORIES = {
  CONFERENCE: "Conférence",
  FORMATION: "Formation",
  ATELIER: "Atelier",
  COMPETITION: "Compétition",
  CULTUREL: "Culturel",
  SPORTIF: "Sport",
  SOIREE: "Soirée",
  SORTIE: "Sortie",
  AUTRE: "Autre",
} as const;
export type CategorieKey = keyof typeof CATEGORIES;

export const LIEU_LABEL = (code: string, nom: string, precision?: string | null) =>
  code === "AUTRE" ? precision || "Autre lieu" : nom;
