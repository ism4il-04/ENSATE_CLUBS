import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { AnnulerEvenement } from "@/components/events/AnnulerEvenement";
import { EventHeader } from "@/components/org/EventHeader";
import { PublicationForm } from "@/components/org/PublicationForm";
import { CATEGORIES, LIEU_LABEL, dayLabel, timeLabel, type CategorieKey } from "@/lib/format";
import { AccessError, requireOrganisation } from "@/server/permissions";
import { getDb, schema as s } from "@/server/db";
import { countInscritsActifs, getManagedEvent } from "@/server/queries/org";
import { uploadsEnabled } from "@/server/uploads";

export const metadata: Metadata = { title: "Publication" };

export default async function Publication({ params }: PageProps<"/org/evenements/[id]/publication">) {
  const { id } = await params;
  const { org } = await requireOrganisation();
  let m;
  try {
    m = await getManagedEvent(id, { orgId: org.id });
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
  const { evt } = m;
  if (!m.isPrincipal) redirect(`/org/evenements/${id}/inscrits`);
  if (evt.statut !== "VALIDE" && evt.statut !== "PUBLIE") redirect("/org");

  const inscrits = await countInscritsActifs(evt.id);
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

  return (
    <>
      <EventHeader
        id={evt.id}
        titre={evt.titre}
        statut={evt.statut}
        current="publication"
        isPrincipal
        partenaires={m.orgs.filter((o) => o.role === "PARTENAIRE").map((o) => o.nom).join(", ")}
      />
      <PublicationForm
        eventId={evt.id}
        slug={evt.slug}
        statut={evt.statut as "VALIDE" | "PUBLIE"}
        isProgramme={evt.structure === "PROGRAMME"}
        titre={evt.titre}
        couleur={evt.couleur}
        categorie={CATEGORIES[evt.categorie as CategorieKey]}
        dateLabel={m.creneaux[0] ? `${dayLabel(m.creneaux[0].debut)} · ${timeLabel(m.creneaux[0].debut)}` : ""}
        creneauxLabel={creneauxLabel}
        uploads={uploadsEnabled()}
        activites={m.sousEvenements.map((x) => ({ id: x.id, titre: x.titre, statut: x.statut }))}
        initial={{
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
        }}
      />
      <AnnulerEvenement eventId={evt.id} titre={evt.titre} inscrits={inscrits} />
    </>
  );
}
