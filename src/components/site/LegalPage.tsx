import Link from "next/link";
import { ACOMPLETER, LEGAL } from "@/lib/legal";

const PAGES = [
  ["/mentions-legales", "Mentions légales"],
  ["/confidentialite", "Confidentialité"],
  ["/conditions", "Conditions d'utilisation"],
] as const;

const dateFr = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

/** Mise en page commune des pages légales : titre, date de mise à jour, navigation entre les trois textes. */
export function LegalPage({ titre, courant, children }: { titre: string; courant: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <nav aria-label="Pages légales" className="flex flex-wrap gap-1.5">
        {PAGES.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={courant === href ? "page" : undefined}
            className={`press flex h-10 items-center rounded-full border px-3.5 text-[13px] font-bold ${courant === href ? "border-paper bg-paper text-ink" : "border-line bg-surface text-soft"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(34px,5vw,52px)] leading-none font-extrabold tracking-[-0.045em]">{titre}</h1>
        <p className="text-sm text-muted">Dernière mise à jour : {dateFr(LEGAL.miseAJour)}</p>
      </header>
      <div className="legal flex flex-col gap-5 text-[15px] leading-relaxed text-soft">{children}</div>
    </article>
  );
}

export function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-5">
      <h2 className="font-display text-xl font-extrabold tracking-tight text-paper">{titre}</h2>
      {children}
    </section>
  );
}

/** Valeur de configuration ; signalée visiblement tant qu'elle n'est pas renseignée. */
export function Info({ v }: { v: string }) {
  const t = v.trim();
  return t ? <>{t}</> : <mark className="rounded bg-amber/20 px-1 font-bold text-amber">{ACOMPLETER}</mark>;
}
