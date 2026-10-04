import type { Metadata } from "next";
import { DemandeWizard } from "@/components/org/DemandeWizard";
import { PageTitle } from "@/components/space/SpaceShell";
import { listLieux, listOrganisations } from "@/server/queries/org";
import { requirePageRole } from "@/server/permissions";
import { periodesActives } from "@/server/services/periodes";

export const metadata: Metadata = { title: "Créer un événement pour un club" };

export default async function CoordNouveau() {
  await requirePageRole("/coord/nouveau", "COORDINATEUR", "ADMIN");
  const [lieux, organisations] = await Promise.all([listLieux(), listOrganisations()]);
  return (
    <>
      <PageTitle kicker="Création directe, sans validation" title="Créer un événement pour un club" />
      {organisations.length ? (
        <DemandeWizard periodes={await periodesActives()} mode="coord" lieux={lieux} organisations={organisations} />
      ) : (
        <p className="text-muted">Crée d&apos;abord une organisation dans « Organisations ».</p>
      )}
    </>
  );
}
