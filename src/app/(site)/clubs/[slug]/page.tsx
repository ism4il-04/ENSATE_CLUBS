import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { dateStamp, rangeLabel } from "@/lib/format";
import { getClub } from "@/server/queries/clubs";
import { splitByPeriod } from "@/server/queries/moi";

export async function generateMetadata({ params }: PageProps<"/clubs/[slug]">): Promise<Metadata> {
  const c = await getClub((await params).slug);
  return c ? { title: c.org.nom, description: c.org.description ?? undefined } : { title: "Club introuvable" };
}

export default async function Club({ params, searchParams }: PageProps<"/clubs/[slug]">) {
  const { slug } = await params;
  const c = await getClub(slug);
  if (!c) notFound();
  const { org, events, collabs } = c;
  const tab = (await searchParams).periode === "passes" ? "passes" : "avenir";
  const { avenir, passes } = splitByPeriod(events);
  const list = (tab === "avenir" ? avenir : passes).sort((a, b) => ((a.debut?.getTime() ?? 0) - (b.debut?.getTime() ?? 0)) * (tab === "avenir" ? 1 : -1));
  const initials = (org.sigle ?? org.nom.slice(0, 2)).toUpperCase();
  const word = org.nom.split(/\s+/).at(-1) ?? org.nom;

  return (
    <>
      <Link href="/clubs" className="flex min-h-11 items-center gap-1.5 self-start text-sm font-bold text-muted">
        <Icon name="chevronLeft" stroke={2.4} /> Tous les clubs
      </Link>
      <section>
        <div className="relative h-[260px] overflow-hidden rounded-[34px] text-ink" style={{ background: org.couleur }}>
          <div aria-hidden className="animate-marquee absolute top-7 left-0 flex w-max gap-10 font-display text-[140px] leading-none font-extrabold tracking-[-0.06em] whitespace-nowrap uppercase">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i}>{word} ✦</span>
            ))}
          </div>
        </div>
        <div className="-mt-16 flex flex-wrap items-end justify-between gap-4.5 px-[clamp(16px,3vw,32px)]">
          <div className="flex flex-wrap items-end gap-4.5">
            <span className="relative grid size-32 place-items-center overflow-hidden rounded-[34px] border-[6px] border-ink bg-ink font-display text-5xl font-extrabold tracking-tight shadow-[0_0_0_2px_#2b2e40]" style={{ color: org.couleur }}>
              {org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logoUrl} alt={`Logo ${org.nom}`} className="size-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <div className="flex flex-col gap-1.5 pb-1.5">
              <span className="self-start rounded-full border border-line-strong px-3 py-1 text-xs font-extrabold tracking-wider uppercase">{org.type === "CLUB" ? "Club" : "Association"}</span>
              <h1 className="font-display text-[clamp(34px,4.5vw,52px)] leading-none font-extrabold tracking-[-0.045em]">{org.nom}</h1>
            </div>
          </div>
          <div className="flex gap-2 pb-1.5">
            {org.instagram && (
              <a href={`https://instagram.com/${org.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="press flex h-12 items-center rounded-full border border-line-strong px-4 text-sm font-bold">
                {org.instagram}
              </a>
            )}
            {org.linkedin && (
              <a href={org.linkedin} target="_blank" rel="noopener noreferrer" className="press flex h-12 items-center rounded-full border border-line-strong px-4 text-sm font-bold">
                LinkedIn
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Événements</h2>
            <nav aria-label="Période" className="flex gap-1 rounded-full border border-line bg-surface p-1">
              {(
                [
                  ["avenir", "À venir"],
                  ["passes", "Passés"],
                ] as const
              ).map(([k, label]) => (
                <Link key={k} href={k === "avenir" ? `/clubs/${slug}` : `/clubs/${slug}?periode=passes`} aria-current={tab === k ? "page" : undefined} className={`flex h-10 items-center rounded-full px-4 text-sm font-bold ${tab === k ? "bg-paper text-ink" : ""}`}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          {list.map((e) => {
            const st = e.debut ? dateStamp(e.debut) : null;
            return (
              <Link key={e.id} href={`/evenements/${e.slug}`} className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-3 transition-all hover:translate-x-1.5 hover:border-line-strong hover:bg-hover">
                <span className="flex size-23 flex-none flex-col items-center justify-center rounded-[18px] leading-none text-ink" style={{ background: tab === "avenir" ? e.couleur : "#2B2E40", color: tab === "avenir" ? undefined : "#F4F3EF" }}>
                  <span className="text-xs font-extrabold tracking-widest">{st?.dow}</span>
                  <span className="my-1 font-display text-[34px] font-extrabold">{st?.day}</span>
                  <span className="text-xs font-extrabold tracking-widest">{st?.mon}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-lg font-extrabold">{e.titre}</span>
                  <span className="text-sm text-muted">{e.debut && e.fin ? rangeLabel(e.debut, e.fin) : ""}</span>
                  {e.partenaires.length > 0 && <span className="self-start rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">avec {e.partenaires.map((p) => p.nom).join(", ")}</span>}
                </span>
                <Icon name="chevronRight" size={22} className="text-muted" />
              </Link>
            );
          })}
          {!list.length && <p className="rounded-3xl border-[1.5px] border-dashed border-line-strong p-8 text-center text-muted">{tab === "avenir" ? "Aucun événement à venir." : "Aucun événement passé."}</p>}
        </section>

        <aside className="flex flex-[1_1_300px] flex-col gap-3.5">
          {org.description && (
            <div className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-5">
              <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">À propos</h2>
              <p className="leading-relaxed whitespace-pre-line text-soft">{org.description}</p>
            </div>
          )}
          {(org.emailContact || org.telephoneContact) && (
            <div className="flex flex-col gap-2 rounded-3xl border border-line bg-surface p-5">
              <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Contact</h2>
              {org.emailContact && <a href={`mailto:${org.emailContact}`} className="font-semibold text-paper">{org.emailContact}</a>}
              {org.telephoneContact && <span className="text-muted">{org.telephoneContact}</span>}
            </div>
          )}
          {collabs.length > 0 && (
            <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
              <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Collabore avec</h2>
              <div className="flex flex-wrap gap-2">
                {collabs.map((p) => (
                  <Link key={p.slug} href={`/clubs/${p.slug}`} className="press flex h-11 items-center gap-2 rounded-full bg-surface-2 pr-3.5 pl-1.5 text-sm font-bold">
                    <span className="grid size-8 place-items-center rounded-[10px] text-xs font-extrabold text-ink" style={{ background: p.couleur }}>
                      {(p.sigle ?? p.nom.slice(0, 2)).toUpperCase()}
                    </span>
                    {p.nom}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
