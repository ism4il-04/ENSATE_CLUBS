import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { listClubs } from "@/server/queries/clubs";

export const metadata: Metadata = { title: "Clubs et associations" };

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default async function Clubs({ searchParams }: PageProps<"/clubs">) {
  const sp = await searchParams;
  const type = sp.type === "CLUB" || sp.type === "ASSOCIATION" ? sp.type : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const all = await listClubs();
  const list = all.filter((o) => (!type || o.type === type) && (!q || norm(`${o.nom} ${o.description ?? ""}`).includes(norm(q))));

  return (
    <>
      <section className="animate-rise flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-2xl flex-col gap-3.5">
          <h1 className="font-display text-[clamp(44px,6vw,80px)] leading-[0.92] font-extrabold tracking-[-0.045em]">
            Clubs &amp; <span className="inline-block -rotate-2 rounded-[0.18em] bg-accent px-[0.12em] text-ink">associations</span>
          </h1>
          <p className="text-[17px] text-muted">Découvre les clubs de l&apos;école et leurs prochains événements.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <nav aria-label="Type d'organisation" className="flex gap-1 rounded-full border border-line bg-surface p-1">
            {(
              [
                ["", "Tous"],
                ["CLUB", "Clubs"],
                ["ASSOCIATION", "Associations"],
              ] as const
            ).map(([k, label]) => (
              <Link
                key={label}
                href={k ? `/clubs?type=${k}` : "/clubs"}
                aria-current={type === k ? "page" : undefined}
                className={`flex h-10 items-center rounded-full px-4 text-sm font-bold ${type === k ? "bg-paper text-ink" : ""}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <form action="/clubs" className="flex h-12 w-full max-w-[260px] items-center gap-2 rounded-full border border-line bg-surface px-4 text-muted">
            <Icon name="search" />
            <label htmlFor="q" className="sr-only">
              Rechercher un club
            </label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Rechercher un club…" className="min-w-0 flex-1 bg-transparent font-medium text-paper outline-none" />
            {type && <input type="hidden" name="type" value={type} />}
          </form>
        </div>
      </section>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr))]">
        {list.map((o, i) => (
          <Link
            key={o.id}
            href={`/clubs/${o.slug}`}
            className="lift animate-rise group flex flex-col overflow-hidden rounded-[26px] border border-line bg-surface"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="relative h-32 overflow-hidden text-ink" style={{ background: o.couleur }}>
              <span aria-hidden className="absolute -right-3 -bottom-9 font-display text-[130px] leading-none font-extrabold tracking-[-0.06em] transition-transform duration-500 group-hover:-translate-x-3 group-hover:-rotate-3">
                {(o.sigle ?? o.nom.slice(0, 2)).toUpperCase()}
              </span>
              <span className="absolute top-4 left-4 rounded-full bg-ink px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-paper uppercase">
                {o.type === "CLUB" ? "Club" : "Association"}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4.5">
              <h2 className="text-[19px] leading-tight font-extrabold">{o.nom}</h2>
              <p className="line-clamp-2 text-sm leading-relaxed text-muted">{o.description ?? ""}</p>
              <span className={`mt-auto pt-1.5 text-[13px] font-bold ${o.aVenir ? "text-accent" : "text-faint"}`}>
                {o.aVenir ? `${o.aVenir} événement${o.aVenir > 1 ? "s" : ""} à venir` : "Pas d'événement prévu"}
              </span>
            </div>
          </Link>
        ))}
      </div>
      {!list.length && <p className="rounded-3xl border-[1.5px] border-dashed border-line-strong p-10 text-center text-muted">Aucun club ne correspond.</p>}
    </>
  );
}
