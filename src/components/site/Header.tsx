import Link from "next/link";
import { auth } from "@/auth";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";

const SPACE: Record<string, { href: string; label: string } | undefined> = {
  ORGANISATION: { href: "/org", label: "Espace club" },
  COORDINATEUR: { href: "/coord", label: "Coordination" },
  ADMIN: { href: "/admin", label: "Administration" },
};

export async function Header() {
  const session = await auth();
  const user = session?.user;
  const initials = (user?.name ?? user?.email ?? "?")
    .split(/[\s.@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const space = user ? SPACE[user.role] : undefined;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3.5">
      <Logo />
      <NavLinks />
      <div className="flex items-center gap-2.5">
        {space && (
          <Link href={space.href} className="press hidden h-11 items-center rounded-full border border-line-strong px-4 text-sm font-bold sm:flex">
            {space.label}
          </Link>
        )}
        {user ? (
          <Link
            href="/moi/profil"
            aria-label="Mon profil"
            className="press grid size-11.5 place-items-center overflow-hidden rounded-full border-2 border-accent bg-surface-2 text-sm font-bold"
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              initials
            )}
          </Link>
        ) : (
          <Link href="/connexion" className="press flex h-11 items-center rounded-full bg-accent px-5 text-sm font-extrabold text-ink">
            Connexion
          </Link>
        )}
      </div>
    </header>
  );
}
