import { api, uuid } from "@/server/api/http";
import { requireOrganisation } from "@/server/permissions";
import { fermerSession } from "@/server/services/stand";

// Ferme une session stand de l'organisation connectée.
export const DELETE = api(
  async (_req: Request, { params }: RouteContext<"/api/v1/org/stand/[session]">) => {
    const { org } = await requireOrganisation("caisse");
    await fermerSession(uuid((await params).session), org.id);
    return { ok: true };
  },
  { status: 200 },
);
