import { api, ApiError } from "@/server/api/http";
import { orgSurEvenement } from "@/server/api/serialiser";
import { ouvrirSession, sessionActive } from "@/server/services/stand";

// Ouvre une session stand (QR dynamique) pour l'organisation connectée.
export const POST = api(async (_req: Request, { params }: RouteContext<"/api/v1/org/evenements/[id]/stand">) => {
  const { id } = await params;
  const { user, org } = await orgSurEvenement(id, "caisse");
  const sessionId = await ouvrirSession({ eventId: id, orgId: org.id, compteId: user.id });
  if (!sessionId) throw new ApiError(422, "SESSION_STAND_FERMEE", "Le stand ne s'ouvre que pour un événement publié.");
  const s = await sessionActive(id, org.id);
  return { idSession: sessionId, expiration: s?.dateExpiration ?? null, jeton: `/api/v1/org/stand/${sessionId}/jeton` };
});
