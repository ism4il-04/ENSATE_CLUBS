import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/server/db";
import { requireOrganisation, roleOnEvent, type Capacite } from "@/server/permissions";
import type { getPublicEvent, listPublishedEvents } from "@/server/queries/evenements";
import { ApiError, montant } from "./http";

// Représentation publique des données : liste blanche de champs (jamais d'identifiant interne de créateur,
// de tarif masqué ni de montant encaissé).

type Resume = Awaited<ReturnType<typeof listPublishedEvents>>[number];
type Detail = NonNullable<Awaited<ReturnType<typeof getPublicEvent>>>;

export function evenementResume(e: Resume | Detail) {
  return {
    id: e.id,
    slug: e.slug,
    titre: e.titre,
    structure: e.structure,
    categorie: e.categorie,
    couleur: e.couleur,
    afficheUrl: e.afficheUrl,
    descriptionCourte: e.descriptionCourte,
    debut: e.debut,
    fin: e.fin,
    lieux: e.lieux,
    organisations: e.orgs.map((o) => ({ nom: o.nom, slug: o.slug, sigle: o.sigle, couleur: o.couleur, role: o.role })),
    gratuit: e.gratuit,
    prixMin: montant(e.prixMin),
    tarifs: e.tarifs.map((t) => ({ libelle: t.libelle, prix: montant(t.prix) })),
    places: { publiques: e.placesPubliques, restantes: e.restantes },
    ouvertExternes: e.ouvertExternes,
    telephoneRequis: e.telephoneRequis,
    modeInscription: e.modeInscription,
    inscriptionsOuvertes: e.inscriptionsOuvertes,
    listeAttente: e.listeAttenteActive,
  };
}

export function evenementDetail(e: Detail) {
  return {
    ...evenementResume(e),
    statut: e.statut,
    description: e.description,
    creneaux: e.creneaux.map((c) => ({ id: c.id, debut: c.debut, fin: c.fin, lieux: c.lieux })),
    planning: e.medias.filter((m) => m.type === "PLANNING").map((m) => ({ url: m.url, texte: m.texteAlternatif })),
    contact: e.orgs[0] ? { organisation: e.orgs[0].nom, email: e.orgs[0].emailContact, instagram: e.orgs[0].instagram } : null,
    sousEvenements: e.sousEvenements.map((x) => ({ ...evenementResume(x), creneaux: x.creneaux.map((c) => ({ id: c.id, debut: c.debut, fin: c.fin, lieux: c.lieux })) })),
    agenda: `/evenements/${e.slug}/agenda.ics`,
  };
}

/** Organisation connectée (avec la capacité) ET organisatrice de l'événement ; sinon 404 (on ne révèle rien). */
export async function orgSurEvenement(eventId: string, cap: Capacite) {
  const ctx = await requireOrganisation(cap);
  if (!/^[0-9a-f-]{36}$/i.test(eventId) || !(await roleOnEvent(ctx.org.id, eventId))) throw new ApiError(404, "INTROUVABLE", "Événement introuvable.");
  return ctx;
}

/** Événement d'une inscription, vérifié pour l'organisation connectée. */
export async function orgSurInscription(inscriptionId: string, cap: Capacite) {
  if (!/^[0-9a-f-]{36}$/i.test(inscriptionId)) throw new ApiError(404, "INTROUVABLE", "Inscription introuvable.");
  const [row] = await getDb().select({ idEvenement: s.inscription.idEvenement }).from(s.inscription).where(and(eq(s.inscription.id, inscriptionId))).limit(1);
  if (!row) throw new ApiError(404, "INTROUVABLE", "Inscription introuvable.");
  const ctx = await orgSurEvenement(row.idEvenement, cap);
  return { ...ctx, eventId: row.idEvenement };
}
