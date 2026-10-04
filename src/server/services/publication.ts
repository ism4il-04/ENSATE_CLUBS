import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { schema as s } from "@/server/db";
import { withTx } from "@/server/db/tx";

export const PublicationSchema = z.object({
  description: z.string().trim().max(5000).default(""),
  afficheUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "L'adresse de l'affiche doit commencer par https://")
    .default(""),
  plannings: z
    .array(z.string().trim().max(500).regex(/^https:\/\/\S+$/, "Chaque photo du planning doit être un lien https://"))
    .max(6, "6 photos de planning au maximum.")
    .default([]),
  capacite: z.number().int().positive().nullable(),
  placesMembres: z.number().int().min(0).default(0),
  gratuit: z.boolean(),
  tarifs: z
    .array(z.object({ id: z.string().uuid().optional(), libelle: z.string().trim().max(40), prix: z.number().min(0).max(100000), affiche: z.boolean() }))
    .max(12)
    .default([]),
  ouvertExternes: z.boolean(),
  telephoneRequis: z.boolean(),
  modeInscription: z.enum(["EN_LIGNE", "STAND"]),
  inscriptionsOuvertes: z.boolean(),
  listeAttenteActive: z.boolean(),
});
export type PublicationInput = z.input<typeof PublicationSchema>;

export class PublicationError extends Error {
  constructor(public erreurs: string[]) {
    super(erreurs.join(" "));
  }
}

/**
 * Enregistre les détails d'un événement VALIDE ou PUBLIE (RG-09, RG-29, RG-36) et le publie si demandé.
 * Les créneaux ne sont jamais modifiés ici (RG-08).
 */
export async function savePublication(eventId: string, input: PublicationInput, opts: { publish: boolean }) {
  const parsed = PublicationSchema.safeParse(input);
  if (!parsed.success) throw new PublicationError(parsed.error.issues.map((i) => i.message));
  const d = parsed.data;

  return withTx(async (tx) => {
    const [evt] = await tx.select().from(s.evenement).where(eq(s.evenement.id, eventId)).for("update");
    if (!evt) throw new PublicationError(["Événement introuvable."]);
    if (evt.statut !== "VALIDE" && evt.statut !== "PUBLIE") throw new PublicationError(["L'événement doit être validé par le coordinateur avant d'être publié."]);
    const isProgramme = evt.structure === "PROGRAMME";
    const errs: string[] = [];

    if (!isProgramme) {
      const [{ publics, membres }] = await tx
        .select({
          publics: sql<number>`count(*) filter (where ${s.inscription.statut} = 'CONFIRMEE' and ${s.inscription.source} <> 'MEMBRE')`.mapWith(Number),
          membres: sql<number>`count(*) filter (where ${s.inscription.statut} = 'CONFIRMEE' and ${s.inscription.source} = 'MEMBRE')`.mapWith(Number),
        })
        .from(s.inscription)
        .where(eq(s.inscription.idEvenement, eventId));
      if (d.capacite !== null) {
        if (d.placesMembres > d.capacite) errs.push("Les places membres ne peuvent pas dépasser la capacité.");
        if (d.capacite - d.placesMembres < publics) errs.push(`Il y a déjà ${publics} confirmés : augmente les places publiques.`);
      }
      if (d.placesMembres < membres) errs.push(`${membres} places membres sont déjà attribuées.`);
      const shown = d.tarifs.filter((t) => t.affiche && t.libelle);
      if (!d.gratuit && !shown.length) errs.push("Ajoute au moins un tarif affiché, ou choisis « Gratuit ».");
      if (d.tarifs.some((t) => !t.libelle)) errs.push("Chaque tarif doit avoir un nom.");
      const names = d.tarifs.map((t) => t.libelle.toLowerCase());
      if (new Set(names).size !== names.length) errs.push("Deux tarifs portent le même nom.");
    }
    if (opts.publish && d.description.length < 30) errs.push("La description doit faire au moins 30 caractères.");
    if (errs.length) throw new PublicationError(errs);

    await tx
      .update(s.evenement)
      .set(
        isProgramme
          ? { description: d.description || null, afficheUrl: d.afficheUrl || null, ouvertExternes: d.ouvertExternes, dateMaj: new Date() }
          : {
              description: d.description || null,
              afficheUrl: d.afficheUrl || null,
              capacite: d.capacite,
              placesMembres: d.placesMembres,
              gratuit: d.gratuit,
              ouvertExternes: d.ouvertExternes,
              telephoneRequis: d.telephoneRequis,
              modeInscription: d.modeInscription,
              inscriptionsOuvertes: d.modeInscription === "EN_LIGNE" && d.inscriptionsOuvertes,
              listeAttenteActive: d.gratuit && d.listeAttenteActive,
              dateMaj: new Date(),
            },
      )
      .where(eq(s.evenement.id, eventId));

    // Planning : remplacé en bloc, dans l'ordre choisi.
    await tx.delete(s.media).where(and(eq(s.media.idEvenement, eventId), eq(s.media.type, "PLANNING")));
    if (d.plannings.length)
      await tx.insert(s.media).values(d.plannings.map((url, i) => ({ idEvenement: eventId, type: "PLANNING" as const, url, ordre: i, texteAlternatif: `Planning ${i + 1}` })));

    if (!isProgramme) {
      // Tarifs : un tarif déjà utilisé par une inscription payée ne peut qu'être masqué.
      const existing = await tx.select().from(s.tarif).where(eq(s.tarif.idEvenement, eventId));
      // Un tarif sans id mais de même nom qu'un tarif existant est une mise à jour (pas un doublon).
      const withIds = d.tarifs.map((t) => ({
        ...t,
        id: t.id ?? existing.find((x) => x.libelle.toLowerCase() === t.libelle.toLowerCase())?.id,
      }));
      const keep = new Set(withIds.map((t) => t.id).filter(Boolean) as string[]);
      const removed = existing.filter((t) => !keep.has(t.id));
      if (removed.length) {
        const used = await tx
          .select({ id: s.inscription.idTarif })
          .from(s.inscription)
          .where(and(inArray(s.inscription.idTarif, removed.map((t) => t.id)), isNotNull(s.inscription.datePaiement)));
        if (used.length) {
          const names = removed.filter((t) => used.some((u) => u.id === t.id)).map((t) => `« ${t.libelle} »`);
          throw new PublicationError([`Le tarif ${names.join(", ")} a déjà servi à encaisser : masque-le au lieu de le supprimer.`]);
        }
        await tx.delete(s.tarif).where(inArray(s.tarif.id, removed.map((t) => t.id)));
      }
      for (const [i, t] of withIds.entries()) {
        const values = { libelle: t.libelle, prix: String(t.prix), affiche: t.affiche, ordre: i };
        if (t.id && existing.some((x) => x.id === t.id)) await tx.update(s.tarif).set(values).where(eq(s.tarif.id, t.id));
        else await tx.insert(s.tarif).values({ ...values, idEvenement: eventId });
      }
    }

    if (opts.publish && evt.statut === "VALIDE") {
      await tx.update(s.evenement).set({ statut: "PUBLIE" }).where(eq(s.evenement.id, eventId));
      if (isProgramme) await tx.update(s.evenement).set({ statut: "PUBLIE" }).where(and(eq(s.evenement.idParent, eventId), eq(s.evenement.statut, "VALIDE")));
    }
    return { slug: evt.slug, published: opts.publish || evt.statut === "PUBLIE" };
  });
}
