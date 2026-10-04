import { redirect } from "next/navigation";
import { SpaceShell } from "@/components/space/SpaceShell";
import { getSessionUser } from "@/server/permissions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getSessionUser();
  if (!user) redirect("/connexion?retour=/admin");
  if (user.role !== "ADMIN") redirect("/");
  return (
    <SpaceShell
      identity={{ initials: "AD", name: "Administrateur", sub: "Comptes et accès", color: "#F4F3EF" }}
      navLabel="Administration"
      links={[
        { href: "/admin", label: "Comptes", icon: "lock", exact: true },
        { href: "/coord/organisations", label: "Organisations", icon: "users" },
        { href: "/coord", label: "Espace coordinateur", icon: "ticket" },
      ]}
    >
      {children}
    </SpaceShell>
  );
}
