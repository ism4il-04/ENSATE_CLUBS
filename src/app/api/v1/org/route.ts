import { api } from "@/server/api/http";
import { mesOrganisations, peut, requireOrganisation } from "@/server/permissions";

// Organisation active, type d'accès et capacités (gerer, caisse, finance).
export const GET = api(async () => {
  const { user, org, acces } = await requireOrganisation("caisse");
  const toutes = await mesOrganisations(user.id, user.role);
  return {
    organisation: { id: org.id, nom: org.nom, slug: org.slug, couleur: org.couleur },
    acces,
    capacites: { gerer: peut(acces, "gerer"), caisse: true, finance: peut(acces, "finance") },
    autres: toutes.filter((x) => x.org.id !== org.id).map((x) => ({ id: x.org.id, nom: x.org.nom, acces: x.acces })),
  };
});
