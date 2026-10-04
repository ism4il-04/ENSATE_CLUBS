import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DemandeWizard } from "@/components/org/DemandeWizard";
import { PageTitle } from "@/components/space/SpaceShell";
import { AccessError, requireOrganisation } from "@/server/permissions";
import { getManagedEvent, listLieux, listOrganisations } from "@/server/queries/org";
import { toWizardInitial } from "@/server/queries/wizard";

export const metadata: Metadata = { title: "Modifier la demande" };

export default async function ModifierDemande({ params }: PageProps<"/org/evenements/[id]/demande">) {
  const { id } = await params;
  const { org } = await requireOrganisation();
  let m;
  try {
    m = await getManagedEvent(id, { orgId: org.id });
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
  if (!m.isPrincipal || (m.evt.statut !== "BROUILLON" && m.evt.statut !== "MODIF_DEMANDEE")) redirect("/org");
  const [lieux, organisations, initial] = await Promise.all([listLieux(), listOrganisations(), toWizardInitial(m)]);
  const comment = m.decisions.find((d) => d.decision === "MODIF_DEMANDEE")?.commentaire;

  return (
    <>
      <PageTitle kicker={m.evt.statut === "BROUILLON" ? "Brouillon" : "Modification demandée"} title={m.evt.titre} />
      {m.evt.statut === "MODIF_DEMANDEE" && comment && (
        <div className="flex gap-2.5 rounded-2xl border border-amber/35 bg-amber/8 px-4 py-3.5 text-sm leading-relaxed">
          <b className="flex-none text-amber">Coordinateur :</b>
          <span className="text-soft">« {comment} »</span>
        </div>
      )}
      <DemandeWizard mode="org" lieux={lieux} organisations={organisations} myOrgId={org.id} initial={initial} />
    </>
  );
}
