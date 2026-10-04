import { NextResponse } from "next/server";
import { AccessError, requireOrganisation } from "@/server/permissions";
import { jetonCourant } from "@/server/services/stand";

// Jeton courant pour l'écran du stand (interrogé par l'appareil du club).
export async function GET(_req: Request, { params }: RouteContext<"/api/stand/[session]/jeton">) {
  const { session } = await params;
  try {
    const { org } = await requireOrganisation();
    const j = await jetonCourant(session, org.id);
    if (!j) return NextResponse.json({ erreur: "SESSION_STAND_FERMEE" }, { status: 410 });
    return NextResponse.json(j, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ erreur: e.code }, { status: e.code === "NON_AUTHENTIFIE" ? 401 : 403 });
    throw e;
  }
}
