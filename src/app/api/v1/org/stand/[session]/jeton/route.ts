import { api, ApiError, uuid } from "@/server/api/http";
import { appUrl } from "@/server/email/send";
import { requireOrganisation } from "@/server/permissions";
import { jetonCourant } from "@/server/services/stand";

// Jeton courant du QR du stand (renouvelé toutes les 30 s) et lien à encoder dans le QR.
export const GET = api(async (_req: Request, { params }: RouteContext<"/api/v1/org/stand/[session]/jeton">) => {
  const session = uuid((await params).session);
  const { org } = await requireOrganisation("caisse");
  const j = await jetonCourant(session, org.id);
  if (!j) throw new ApiError(410, "SESSION_STAND_FERMEE", "La session stand est fermée.");
  return { jeton: j.token, secondesRestantes: Math.ceil(j.remainingMs / 1000), lien: `${appUrl()}/api/stand/${session}/entree?t=${encodeURIComponent(j.token)}` };
});
