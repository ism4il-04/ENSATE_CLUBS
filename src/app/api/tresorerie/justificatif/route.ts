import { NextResponse } from "next/server";
import { AccessError, requireFinance } from "@/server/permissions";
import { signJustificatif } from "@/server/uploads";

// Signature d'envoi d'un justificatif dans le dossier PRIVÉ de l'organisation (type « authenticated »).
export async function POST() {
  try {
    const { org } = await requireFinance();
    const signed = signJustificatif(org.id);
    if (!signed) return NextResponse.json({ erreur: "ENVOI_NON_CONFIGURE" }, { status: 503 });
    return NextResponse.json(signed, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ erreur: e.code }, { status: e.code === "NON_AUTHENTIFIE" ? 401 : 403 });
    throw e;
  }
}
