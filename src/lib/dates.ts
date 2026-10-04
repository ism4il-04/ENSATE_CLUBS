import { TZ } from "./format";

/** Décalage (ms) du fuseau `tz` à l'instant `utcMs` (gère le passage à UTC+0 du Maroc pendant le Ramadan). */
function tzOffset(utcMs: number, tz = TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - utcMs;
}

/** « 2026-10-17 » + « 09:30 » (heure de Tétouan) → Date UTC. */
export function zonedToUtc(date: string, time: string, tz = TZ) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffset(guess, tz);
  return new Date(guess - tzOffset(first, tz));
}

/** Date UTC → { date: "2026-10-17", time: "09:30" } à l'heure de Tétouan. */
export function utcToZoned(dt: Date, tz = TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(dt)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Date du jour à Tétouan, « AAAA-MM-JJ ». */
export function aujourdhui() {
  return utcToZoned(new Date()).date;
}
