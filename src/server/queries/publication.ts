import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { PublicationForm } from "@/components/org/PublicationForm";
import { CATEGORIES, LIEU_LABEL, dayLabel, timeLabel, type CategorieKey } from "@/lib/format";
import { getDb, schema as s } from "@/server/db";
import { uploadsEnabled } from "@/server/uploads";
import type { getManagedEvent } from "./org";

type Props = Parameters<typeof PublicationForm>[0];

/** Props du formulaire de publication, communes à l'espace club et à l'espace coordinateur (BF-36, BF-68). */
export async function publicationProps(m: Awaited<ReturnType<typeof getManagedEvent>>, espace: Props["espace"]): Promise<Props> {
  const { evt } = m;
  const plannings = await getDb()
    .select({ url: s.media.url })
    .from(s.media)
    .where(and(eq(s.media.idEvenement, evt.id), eq(s.media.type, "PLANNING")))
    .orderBy(asc(s.media.ordre));
  const creneauxLabel = m.creneaux.length
    ? m.creneaux
        .map((c) => `${dayLabel(c.debut)} · ${timeLabel(c.debut)} – ${timeLabel(c.fin)} · ${c.lieux.map((l) => LIEU_LABEL(l.code, l.nom, l.precision)).join(", ")}`)
        .join(" / ")
    : evt.structure === "PROGRAMME"
      ? `Programme · ${m.sousEvenements.length} activités`
      : "Aucun créneau";

  return {
    espace,
    eventId: evt.id,
    slug: evt.slug,
    statut: evt.statut as "VALIDE" | "PUBLIE",
    isProgramme: evt.structure === "PROGRAMME",
    titre: evt.titre,
    couleur: evt.couleur,
    categorie: CATEGORIES[evt.categorie as CategorieKey],
    dateLabel: m.creneaux[0] ? `${dayLabel(m.creneaux[0].debut)} · ${timeLabel(m.creneaux[0].debut)}` : "",
    creneauxLabel,
    uploads: uploadsEnabled(),
    activites: m.sousEvenements.map((x) => ({ id: x.id, titre: x.titre, statut: x.statut })),
    initial: {
      description: evt.description ?? "",
      afficheUrl: evt.afficheUrl ?? "",
      plannings: plannings.map((p) => p.url),
      capacite: evt.capacite,
      placesMembres: evt.placesMembres,
      gratuit: evt.gratuit,
      tarifs: m.tarifs.map((t) => ({ id: t.id, libelle: t.libelle, prix: Number(t.prix), affiche: t.affiche })),
      ouvertExternes: evt.ouvertExternes,
      telephoneRequis: evt.telephoneRequis,
      modeInscription: evt.modeInscription === "STAND" ? "STAND" : "EN_LIGNE",
      inscriptionsOuvertes: evt.inscriptionsOuvertes,
      listeAttenteActive: evt.listeAttenteActive,
    },
  };
}
