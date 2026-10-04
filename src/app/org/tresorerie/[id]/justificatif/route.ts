import { NextResponse } from "next/server";
import { AccessError, requireFinance } from "@/server/permissions";
import { justificatifDe } from "@/server/services/tresorerie";
import { lienJustificatif } from "@/server/uploads";

// Ouvre le justificatif d'une opération : redirection vers un lien Cloudinary signé valable 5 minutes.
export async function GET(_req: Request, { params }: RouteContext<"/org/tresorerie/[id]/justificatif">) {
  const { id } = await params;
  try {
    const { org } = await requireFinance();
    const j = /^[0-9a-f-]{36}$/.test(id) ? await justificatifDe(org.id, id) : null;
    const url = j ? lienJustificatif(j.publicId, j.format) : null;
    if (!url) return new Response("Justificatif introuvable", { status: 404 });
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (e) {
    if (e instanceof AccessError) return new Response("Accès refusé", { status: e.code === "NON_AUTHENTIFIE" ? 401 : 403 });
    throw e;
  }
}
