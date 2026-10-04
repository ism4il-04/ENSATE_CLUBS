import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AnnulerEvenement } from "@/components/events/AnnulerEvenement";
import { EventHeader } from "@/components/org/EventHeader";
import { PublicationForm } from "@/components/org/PublicationForm";
import { AccessError, requireOrgPage } from "@/server/permissions";
import { countInscritsActifs, getManagedEvent } from "@/server/queries/org";
import { publicationProps } from "@/server/queries/publication";

export const metadata: Metadata = { title: "Publication" };

export default async function Publication({ params }: PageProps<"/org/evenements/[id]/publication">) {
  const { id } = await params;
  const { org } = await requireOrgPage("gerer", "/org");
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
  const [props, inscrits] = await Promise.all([publicationProps(m, "org"), countInscritsActifs(evt.id)]);

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
      <PublicationForm {...props} />
      {evt.structure !== "SOUS_EVENEMENT" && <AnnulerEvenement eventId={evt.id} titre={evt.titre} inscrits={inscrits} />}
    </>
  );
}
