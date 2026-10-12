import { api, ApiError } from "@/server/api/http";
import { getClub } from "@/server/queries/clubs";

// 🌐 Page d'une organisation et ses événements publiés ou terminés.
export const GET = api(
  async (_req: Request, { params }: RouteContext<"/api/v1/organisations/[slug]">) => {
    const c = await getClub((await params).slug);
    if (!c) throw new ApiError(404, "INTROUVABLE", "Organisation introuvable.");
    const { org, events, collabs } = c;
    return {
      nom: org.nom,
      slug: org.slug,
      sigle: org.sigle,
      type: org.type,
      couleur: org.couleur,
      logoUrl: org.logoUrl,
      description: org.description,
      contact: { email: org.emailContact, telephone: org.telephoneContact, instagram: org.instagram, tiktok: org.tiktok, linkedin: org.linkedin },
      evenements: events.map((e) => ({ slug: e.slug, titre: e.titre, statut: e.statut, categorie: e.categorie, couleur: e.couleur, debut: e.debut, fin: e.fin })),
      collaborations: collabs.map((p) => ({ nom: p.nom, slug: p.slug })),
    };
  },
  { public: true },
);
