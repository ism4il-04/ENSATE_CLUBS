import { api } from "@/server/api/http";
import { listClubs } from "@/server/queries/clubs";

// 🌐 Organisations actives.
export const GET = api(
  async () =>
    (await listClubs()).map((o) => ({ nom: o.nom, slug: o.slug, sigle: o.sigle, type: o.type, couleur: o.couleur, logoUrl: o.logoUrl, description: o.description, evenementsPublies: o.aVenir })),
  { public: true },
);
