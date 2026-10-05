import { api } from "@/server/api/http";
import { requireOrganisation } from "@/server/permissions";
import { listOrgEvents } from "@/server/queries/org";

// Événements de l'organisation (principale ou partenaire). Filtre : statut.
export const GET = api(async (req: Request) => {
  const { org } = await requireOrganisation("caisse");
  const statut = new URL(req.url).searchParams.get("statut");
  return (await listOrgEvents(org.id))
    .filter((e) => !statut || e.evt.statut === statut)
    .map(({ evt, role, debut, fin, confirmes, pre }) => ({
      id: evt.id,
      slug: evt.slug,
      titre: evt.titre,
      structure: evt.structure,
      statut: evt.statut,
      role,
      debut,
      fin,
      inscrits: { confirmes, preInscrits: pre },
    }));
});
