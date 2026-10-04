import { NextResponse } from "next/server";
import { makeStandCookie, standCookieName, STAND_ACCESS_MS, verifierJeton } from "@/server/services/stand";

// Lien encodé dans le QR du stand : vérifie le jeton (RG-15), pose le cookie « accès stand »
// (15 min pour se connecter), puis redirige vers la page d'inscription du stand.
export async function GET(req: Request, { params }: RouteContext<"/api/stand/[session]/entree">) {
  const { session } = await params;
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const ok = await verifierJeton(session, token);
  const res = NextResponse.redirect(new URL(`/stand/${session}${ok ? "" : "?expire=1"}`, req.url), 303);
  if (ok) {
    res.cookies.set(standCookieName(session), makeStandCookie(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STAND_ACCESS_MS / 1000,
    });
  }
  return res;
}
