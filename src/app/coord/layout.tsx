import { redirect } from "next/navigation";
import { SpaceShell } from "@/components/space/SpaceShell";
import { getSessionUser } from "@/server/permissions";

export default async function CoordLayout({ children }: LayoutProps<"/coord">) {
  const user = await getSessionUser();
  if (!user) redirect("/connexion?retour=/coord");
  if (user.role !== "COORDINATEUR" && user.role !== "ADMIN") redirect("/");
  return (
    <SpaceShell
      identity={{ initials: "CC", name: "Coordinateur", sub: "Vie parascolaire", color: "#F4F3EF" }}
      navLabel="Espace coordinateur"
      links={[
        { href: "/coord", label: "Demandes", icon: "ticket", exact: true },
        { href: "/coord/nouveau", label: "Créer pour un club", icon: "grid" },
        { href: "/coord/calendrier", label: "Calendrier", icon: "clock" },
        { href: "/coord/evenements", label: "Événements", icon: "home" },
        { href: "/coord/organisations", label: "Organisations", icon: "users" },
        { href: "/coord/lieux", label: "Lieux", icon: "pin" },
        { href: "/coord/statistiques", label: "Statistiques", icon: "globe" },
        ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Comptes (admin)", icon: "lock" as const }] : []),
      ]}
    >
      {children}
    </SpaceShell>
  );
}
