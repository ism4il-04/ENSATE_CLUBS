import { redirect } from "next/navigation";
import { SpaceShell } from "@/components/space/SpaceShell";
import { AccessError, requireOrganisation } from "@/server/permissions";

export default async function OrgLayout({ children }: LayoutProps<"/org">) {
  let ctx;
  try {
    ctx = await requireOrganisation();
  } catch (e) {
    if (e instanceof AccessError) redirect(e.code === "NON_AUTHENTIFIE" ? "/connexion?retour=/org" : "/");
    throw e;
  }
  const { org } = ctx;
  return (
    <SpaceShell
      identity={{ initials: org.sigle ?? org.nom.slice(0, 2).toUpperCase(), name: org.nom, sub: "Espace organisation", color: org.couleur }}
      navLabel="Espace organisation"
      links={[
        { href: "/org", label: "Mes événements", icon: "ticket", exact: true },
        { href: "/org/evenements/nouveau", label: "Nouvel événement", icon: "grid" },
        { href: "/org/profil", label: "Profil du club", icon: "user" },
      ]}
    >
      {children}
    </SpaceShell>
  );
}
