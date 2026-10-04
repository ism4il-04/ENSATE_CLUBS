import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, requireOrganisation } from "@/server/permissions";
import { UPLOAD_FOLDERS, signUpload } from "@/server/uploads";

const Body = z.object({ folder: z.enum(UPLOAD_FOLDERS) });

// Signe un envoi d'image vers Cloudinary. Le proxy ne couvre pas /api : la route vérifie elle-même le compte.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ erreur: "NON_AUTHENTIFIE" }, { status: 401 });
  const staff = user.role === "COORDINATEUR" || user.role === "ADMIN";
  if (!staff && !(await requireOrganisation("gerer").then(() => true, () => false))) return NextResponse.json({ erreur: "ACCES_REFUSE" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erreur: "REQUETE_INVALIDE" }, { status: 400 });

  const signed = signUpload(parsed.data.folder);
  if (!signed) return NextResponse.json({ erreur: "ENVOI_NON_CONFIGURE" }, { status: 503 });
  return NextResponse.json(signed, { headers: { "Cache-Control": "no-store" } });
}
