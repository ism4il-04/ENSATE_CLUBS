"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

const LINKS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Événements", icon: "home", match: (p) => p === "/" || p.startsWith("/evenements") },
  { href: "/clubs", label: "Clubs", icon: "users", match: (p) => p.startsWith("/clubs") },
  { href: "/moi/billets", label: "Mes billets", icon: "ticket", match: (p) => p.startsWith("/moi/billets") },
];

/** Navigation en pastilles (ordinateur). */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="hidden rounded-full border border-line bg-surface p-1 md:flex">
      {LINKS.map((l) => {
        const on = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`press flex h-10 items-center rounded-full px-4 text-sm ${on ? "bg-paper font-bold text-ink" : "font-semibold text-paper"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barre d'onglets en bas d'écran (téléphone / PWA). */
export function BottomNav() {
  const pathname = usePathname();
  const links = [...LINKS, { href: "/moi/profil", label: "Profil", icon: "user" as IconName, match: (p: string) => p.startsWith("/moi/profil") }];
  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 grid grid-cols-4 gap-1 rounded-3xl border border-line bg-surface/95 p-1.5 backdrop-blur md:hidden"
    >
      {links.map((l) => {
        const on = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`press flex h-13 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-extrabold ${on ? "bg-paper text-ink" : "text-muted"}`}
          >
            <Icon name={l.icon} size={20} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
