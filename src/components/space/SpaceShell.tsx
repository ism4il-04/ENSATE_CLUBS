import Link from "next/link";
import { Logo } from "@/components/site/Logo";
import { OrgBadge } from "@/components/site/OrgBadge";
import { SpaceNav, type SpaceLink } from "./SpaceNav";

/** Mise en page des espaces club / coordinateur / admin : menu latéral qui passe au-dessus sur téléphone. */
export function SpaceShell({
  identity,
  switcher,
  links,
  navLabel,
  children,
}: {
  identity: { initials: string; name: string; sub: string; color: string; logoUrl?: string | null };
  switcher?: React.ReactNode;
  links: SpaceLink[];
  navLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-wrap">
      <aside className="flex flex-[1_1_248px] flex-col gap-5.5 border-b border-line p-4.5 md:max-w-[280px] md:border-r md:border-b-0">
        <Logo />
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-2.5">
          <OrgBadge nom={identity.name} sigle={identity.initials} couleur={identity.color} logoUrl={identity.logoUrl} size={40} />
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold">{identity.name}</div>
            <div className="text-xs text-muted">{identity.sub}</div>
          </div>
        </div>
        {switcher}
        <SpaceNav links={links} label={navLabel} />
        <Link href="/" className="mt-auto hidden text-[13px] font-bold text-muted hover:text-paper md:block">
          ← Voir le site étudiant
        </Link>
      </aside>
      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-[clamp(16px,3vw,40px)] pt-6.5 pb-12">{children}</main>
    </div>
  );
}

export function PageTitle({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker && <div className="text-sm font-semibold text-muted">{kicker}</div>}
        <h1 className="mt-1.5 font-display text-[clamp(32px,4vw,46px)] leading-none font-extrabold tracking-[-0.04em]">{title}</h1>
      </div>
      {children}
    </div>
  );
}
