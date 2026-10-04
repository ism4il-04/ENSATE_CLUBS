import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventHeader } from "@/components/org/EventHeader";
import { StandScreen } from "@/components/org/StandScreen";
import { AccessError, requireOrganisation } from "@/server/permissions";
import { getManagedEvent } from "@/server/queries/org";
import { listInscrits } from "@/server/services/caisse";
import { sessionActive } from "@/server/services/stand";

export const metadata: Metadata = { title: "Stand" };

export default async function Stand({ params }: PageProps<"/org/evenements/[id]/stand">) {
  const { id } = await params;
  const { org } = await requireOrganisation();
  let m;
  try {
    m = await getManagedEvent(id, { orgId: org.id });
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
  if (m.evt.statut !== "PUBLIE" || m.evt.structure === "PROGRAMME") notFound();
  const [session, data] = await Promise.all([sessionActive(id, org.id), listInscrits(id, org.id)]);
  const { evt, list, tarifs, stats } = data;

  return (
    <>
      <EventHeader id={evt.id} titre={evt.titre} statut={evt.statut} current="stand" isPrincipal={m.isPrincipal} />
      <StandScreen
        eventId={evt.id}
        sessionId={session?.id ?? null}
        orgNom={org.nom}
        stats={{
          confirmes: stats.confirmesPublics,
          publiques: evt.capacite === null ? null : evt.capacite - evt.placesMembres,
          pre: evt.gratuit ? list.filter((r) => r.source === "STAND" && r.statut !== "ANNULEE").length : stats.pre,
          encaisse: stats.encaisse,
        }}
        rows={list.map((r) => ({ ...r, tokenBillet: undefined }))}
        tarifs={tarifs}
        gratuit={evt.gratuit}
        telephoneRequis={evt.telephoneRequis}
      />
    </>
  );
}
