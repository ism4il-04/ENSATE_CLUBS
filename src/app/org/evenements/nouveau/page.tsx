import type { Metadata } from "next";
import { DemandeWizard } from "@/components/org/DemandeWizard";
import { PageTitle } from "@/components/space/SpaceShell";
import { requireOrgPage } from "@/server/permissions";
import { listLieux, listOrganisations } from "@/server/queries/org";
import { periodesActives } from "@/server/services/periodes";

export const metadata: Metadata = { title: "Nouvel événement" };

export default async function NouvelEvenement() {
  const { org } = await requireOrgPage("gerer", "/org/evenements/nouveau");
  const [lieux, organisations] = await Promise.all([listLieux(), listOrganisations()]);
  return (
    <>
      <PageTitle kicker="Demande au coordinateur des clubs" title="Nouvel événement" />
      <DemandeWizard periodes={await periodesActives()} mode="org" lieux={lieux} organisations={organisations} myOrgId={org.id} />
    </>
  );
}
