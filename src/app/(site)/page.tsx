import Link from "next/link";
import { EventCard } from "@/components/events/EventCard";
import { Icon } from "@/components/ui/Icon";
import { CATEGORIES, dateStamp, type CategorieKey } from "@/lib/format";
import { listPublishedEvents } from "@/server/queries/evenements";
import { InstallerApp } from "@/components/pwa/InstallerApp";

const FILTERS: [string, string][] = [
  ["", "Tous"],
  ["CONFERENCE", "Conférences"],
  ["FORMATION", "Formations"],
  ["ATELIER", "Ateliers"],
  ["COMPETITION", "Compétitions"],
  ["SOIREE", "Soirées"],
  ["SPORTIF", "Sport"],
];

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default async function Accueil({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const gratuit = sp.gratuit === "1";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const all = await listPublishedEvents();
  const events = all.filter(
    (e) =>
      (!cat || e.categorie === cat) &&
      (!gratuit || e.gratuit) &&
      (!q || norm(`${e.titre} ${e.orgs.map((o) => o.nom).join(" ")}`).includes(norm(q))),
  );
  const featured = all[0];

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = { cat, gratuit: gratuit ? "1" : "", q, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}#evenements` : "/#evenements";
  };

  return (
    <>
      <InstallerApp bandeau />
      <section className="grid items-stretch gap-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr))]">
        <div className="animate-rise flex flex-col justify-center gap-5.5">
          <h1 className="font-display text-[clamp(44px,6.4vw,84px)] leading-[0.92] font-extrabold tracking-[-0.045em]">
            Ta semaine, version{" "}
            <span className="inline-block -rotate-[2.5deg] rounded-[0.18em] bg-accent px-[0.14em] text-ink">parascolaire</span>.
          </h1>
          <p className="max-w-[46ch] text-lg leading-relaxed text-muted">
            Conférences, ateliers, compétitions et soirées de tous les clubs de l&apos;école. Réserve ta place en ligne ou passe au stand.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#evenements" className="press inline-flex h-13 items-center gap-2.5 rounded-full bg-accent px-6 font-extrabold text-ink">
              Explorer les événements <Icon name="arrowRight" stroke={2.4} />
            </a>
            <Link href="/moi/billets" className="press inline-flex h-13 items-center rounded-full border border-line-strong px-5.5 font-bold">
              Mes billets
            </Link>
          </div>
        </div>

        {featured ? (
          <Link
            href={`/evenements/${featured.slug}`}
            className="lift animate-rise relative flex min-h-[430px] flex-col justify-between gap-7 overflow-hidden rounded-[34px] p-7 text-ink [animation-delay:120ms]"
            style={{ background: featured.couleur }}
          >
            <span aria-hidden className="absolute -right-24 -bottom-28 size-80 rotate-12 rounded-[90px] bg-white/20" />
            <div className="relative flex flex-wrap gap-2">
              <span className="rounded-full bg-ink px-3.5 py-2 text-xs font-extrabold tracking-wider text-paper uppercase">À la une</span>
              <span className="rounded-full border-[1.5px] border-ink/50 px-3.5 py-2 text-xs font-extrabold tracking-wider uppercase">
                {CATEGORIES[featured.categorie as CategorieKey]}
              </span>
            </div>
            <span className={`relative font-display leading-[0.84] font-extrabold tracking-[-0.055em] break-words hyphens-auto uppercase ${featured.titre.length > 14 ? "text-[clamp(40px,4.6vw,64px)]" : "text-[clamp(52px,6.6vw,92px)]"}`}>
              {featured.titre}
            </span>
            {featured.debut && (
              <span className="relative text-[15px] font-bold">
                {dateStamp(featured.debut).dow} {dateStamp(featured.debut).day} {dateStamp(featured.debut).mon} ·{" "}
                {featured.orgs.map((o) => o.nom).join(" × ")}
              </span>
            )}
          </Link>
        ) : (
          <div className="grid min-h-[300px] place-items-center rounded-[34px] border-[1.5px] border-dashed border-line-strong p-8 text-center text-muted">
            Les prochains événements apparaîtront ici dès leur publication.
          </div>
        )}
      </section>

      <section id="evenements" className="flex scroll-mt-6 flex-col gap-5.5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-[40px] leading-none font-extrabold tracking-tight">
            À venir{" "}
            <span className="font-sans text-base font-semibold tracking-normal text-muted">
              {events.length} événement{events.length > 1 ? "s" : ""}
            </span>
          </h2>
          <form action="/" className="flex h-12 w-full max-w-xs items-center gap-2 rounded-full border border-line bg-surface px-4 text-muted">
            <Icon name="search" />
            <label htmlFor="q" className="sr-only">
              Rechercher un événement ou un club
            </label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Événement, club…" className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-paper outline-none" />
            {cat && <input type="hidden" name="cat" value={cat} />}
          </form>
        </div>

        <nav aria-label="Filtres" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {FILTERS.map(([k, label]) => {
            const on = cat === k;
            return (
              <Link
                key={k || "all"}
                href={href({ cat: k || null })}
                aria-current={on ? "true" : undefined}
                className={`press flex h-11 flex-none items-center rounded-full border px-4 text-sm font-bold ${on ? "border-accent bg-accent text-ink" : "border-line bg-surface"}`}
              >
                {label}
              </Link>
            );
          })}
          <span aria-hidden className="mx-1 my-1.5 w-px flex-none bg-line" />
          <Link
            href={href({ gratuit: gratuit ? null : "1" })}
            aria-current={gratuit ? "true" : undefined}
            className={`press flex h-11 flex-none items-center rounded-full border px-4 text-sm font-bold ${gratuit ? "border-accent bg-accent text-ink" : "border-line bg-surface"}`}
          >
            Gratuit
          </Link>
        </nav>

        {events.length ? (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,268px),1fr))]">
            {events.map((e, i) => (
              <EventCard key={e.id} e={e} index={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3.5 rounded-[26px] border-[1.5px] border-dashed border-line-strong px-6 py-14 text-center">
            <span className="font-display text-3xl font-extrabold tracking-tight">Rien par ici… pour l&apos;instant.</span>
            <span className="text-muted">Essaie un autre filtre.</span>
            <Link href="/" className="press rounded-full bg-accent px-5 py-3 font-extrabold text-ink">
              Réinitialiser les filtres
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
