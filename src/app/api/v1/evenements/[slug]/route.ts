import { api, ApiError } from "@/server/api/http";
import { evenementDetail } from "@/server/api/serialiser";
import { getPublicEvent } from "@/server/queries/evenements";

// 🌐 Fiche d'un événement publié (ou terminé), avec ses activités pour un programme.
export const GET = api(
  async (_req: Request, { params }: RouteContext<"/api/v1/evenements/[slug]">) => {
    const e = await getPublicEvent((await params).slug);
    if (!e) throw new ApiError(404, "INTROUVABLE", "Événement introuvable.");
    return evenementDetail(e);
  },
  { public: true },
);
