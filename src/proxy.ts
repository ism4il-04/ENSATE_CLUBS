import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Vérification « optimiste » de la navigation. Les pages, actions et routes API
// revérifient toujours les droits côté serveur (src/server/permissions.ts).
const RULES: { prefix: string; roles: string[] | null }[] = [
  { prefix: "/moi", roles: null }, // tout compte connecté
  { prefix: "/org", roles: null }, // compte du club ou membre : vérifié par requireOrgPage dans chaque page
  { prefix: "/coord", roles: ["COORDINATEUR", "ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
];

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const rule = RULES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (!rule) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
    const url = new URL("/connexion", req.url);
    url.searchParams.set("retour", pathname + search);
    return NextResponse.redirect(url);
  }
  if (rule.roles && !rule.roles.includes(user.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/moi/:path*", "/org/:path*", "/coord/:path*", "/admin/:path*"],
};
