import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { aujourdhui } from "@/lib/dates";
import { getDb, schema as s } from "@/server/db";

// BF-67 : périodes bloquées (examens, vacances). Un club ne peut pas soumettre de créneau dedans ;
// le coordinateur, lui, peut toujours créer ou valider (il est seulement averti).

export type Periode = { id: string; libelle: string; debut: string; fin: string; motif: string | null };

export class PeriodeError extends Error {}

export const PeriodeSchema = z
  .object({
    libelle: z.string().trim().min(3, "Nom trop court.").max(60, "Nom trop long."),
    debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début invalide."),
    fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide."),
    motif: z.string().trim().max(200).optional().default(""),
  })
  .refine((p) => p.debut <= p.fin, "La fin doit être après le début.");

/** Périodes en cours ou à venir (les passées n'ont plus d'effet). */
export async function periodesActives(): Promise<Periode[]> {
  return getDb()
    .select({ id: s.periodeBloquee.id, libelle: s.periodeBloquee.libelle, debut: s.periodeBloquee.debut, fin: s.periodeBloquee.fin, motif: s.periodeBloquee.motif })
    .from(s.periodeBloquee)
    .where(gte(s.periodeBloquee.fin, aujourdhui()))
    .orderBy(asc(s.periodeBloquee.debut));
}

export async function creerPeriode(input: z.input<typeof PeriodeSchema>, createurId: string) {
  const parsed = PeriodeSchema.safeParse(input);
  if (!parsed.success) throw new PeriodeError(parsed.error.issues[0]?.message ?? "Période invalide.");
  const d = parsed.data;
  await getDb().insert(s.periodeBloquee).values({ libelle: d.libelle, debut: d.debut, fin: d.fin, motif: d.motif || null, idCreateur: createurId });
  return d.libelle;
}

export async function supprimerPeriode(id: string) {
  const [row] = await getDb().delete(s.periodeBloquee).where(eq(s.periodeBloquee.id, id)).returning({ libelle: s.periodeBloquee.libelle });
  if (!row) throw new PeriodeError("Période introuvable.");
  return row.libelle;
}

/** La période qui contient cette date (« AAAA-MM-JJ »), ou null. */
export function periodeDe(dateIso: string, periodes: Periode[]) {
  return periodes.find((p) => p.debut <= dateIso && dateIso <= p.fin) ?? null;
}

/** Périodes qui chevauchent l'intervalle de dates donné. */
export async function periodesEntre(du: string, au: string): Promise<Periode[]> {
  return getDb()
    .select({ id: s.periodeBloquee.id, libelle: s.periodeBloquee.libelle, debut: s.periodeBloquee.debut, fin: s.periodeBloquee.fin, motif: s.periodeBloquee.motif })
    .from(s.periodeBloquee)
    .where(and(lte(s.periodeBloquee.debut, au), gte(s.periodeBloquee.fin, du)));
}
