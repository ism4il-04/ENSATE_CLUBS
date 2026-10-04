import type { Metadata } from "next";
import Link from "next/link";
import { DecisionPanel } from "@/components/coord/DecisionPanel";
import { PageTitle } from "@/components/space/SpaceShell";
import { Icon } from "@/components/ui/Icon";
import { CATEGORIES, dateStamp, dayLabel, timeLabel, type CategorieKey } from "@/lib/format";
import { STATUT_EVENEMENT } from "@/lib/statuts";
import { listDemandes, sameDay } from "@/server/services/coord";
import { periodeDe, periodesActives } from "@/server/services/periodes";
import { utcToZoned } from "@/lib/dates";
import { requirePageRole } from "@/server/permissions";

export const metadata: Metadata = { title: "Demandes en attente" };

const DECISION = { VALIDE: "Validé", REFUSE: "Refusé", MODIF_DEMANDEE: "Modification demandée" };

export default async function Demandes({ searchParams }: PageProps<"/coord">) {
  await requirePageRole("/coord", "COORDINATEUR", "ADMIN");
  const demandes = await listDemandes();
  const wanted = (await searchParams).id;
  const sel = demandes.find((d) => d.evt.id === wanted) ?? demandes[0] ?? null;
  const [memeJour, periodes] = sel ? await Promise.all([sameDay(sel.creneaux), periodesActives()]) : [[], []];
  const bloques = sel ? [...new Set(sel.creneaux.map((c) => periodeDe(utcToZoned(c.debut).date, periodes)?.libelle).filter(Boolean))] : [];
  const next = demandes.find((d) => d.evt.id !== sel?.evt.id);

  return (
    <>
      <PageTitle kicker={new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Casablanca" }).format(new Date())} title="Demandes en attente">
        <Link href="/coord/nouveau" className="press flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-extrabold text-ink">
          <Icon name="grid" /> Créer un événement pour un club
        </Link>
      </PageTitle>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
          <h2 className="text-lg font-extrabold">
            À traiter <span className="text-muted">· {demandes.length}</span>
          </h2>
          {demandes.map((d) => {
            const p = d.orgs.find((o) => o.role === "PRINCIPAL");
            const active = d.evt.id === sel?.evt.id;
            const st = d.creneaux[0] ? dateStamp(d.creneaux[0].debut) : null;
            return (
              <Link
                key={d.evt.id}
                href={`/coord?id=${d.evt.id}`}
                aria-current={active ? "true" : undefined}
                className={`flex gap-3 rounded-[20px] border-[1.5px] p-3.5 transition-transform hover:translate-x-1 ${active ? "border-accent bg-surface-2" : "border-line bg-surface"}`}
              >
                <span className="grid size-11 flex-none place-items-center rounded-[14px] text-sm font-extrabold text-ink" style={{ background: p?.couleur ?? "#B79CFF" }}>
                  {(p?.sigle ?? p?.nom.slice(0, 2) ?? "?").toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-extrabold">{d.evt.titre}</span>
                  <span className="text-[13px] text-muted">
                    {p?.nom} · {st ? `${st.dow} ${st.day} ${st.mon}` : "sans date"}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">{d.evt.structure === "PROGRAMME" ? "Programme" : "Événement simple"}</span>
                    {d.decisions.some((x) => x.decision === "MODIF_DEMANDEE") && <span className="rounded-full bg-amber/14 px-2.5 py-1 text-xs font-extrabold text-amber">Resoumis</span>}
                  </span>
                </span>
              </Link>
            );
          })}
          {!demandes.length && <div className="rounded-[22px] border-[1.5px] border-dashed border-line-strong px-5 py-7 text-center text-muted">Tout est traité.</div>}
        </div>

        {sel && (
          <section key={sel.evt.id} aria-labelledby="det-title" className="animate-rise flex min-w-0 flex-[999_1_480px] flex-col gap-5.5 rounded-[28px] border border-line bg-surface p-[clamp(18px,2.4vw,28px)]">
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full px-3 py-1.5 text-xs font-extrabold text-ink" style={{ background: sel.evt.couleur }}>
                  {sel.evt.structure === "PROGRAMME" ? "Programme" : "Événement simple"} · {CATEGORIES[sel.evt.categorie as CategorieKey]}
                </span>
                <span className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-bold">En attente</span>
              </div>
              <h2 id="det-title" className="font-display text-[clamp(28px,3vw,38px)] leading-none font-extrabold tracking-[-0.04em]">
                {sel.evt.titre}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
                {sel.orgs.map((o) => (
                  <span key={o.id} className={o.role === "PRINCIPAL" ? "" : "rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-paper"}>
                    {o.role === "PRINCIPAL" ? (
                      <>
                        <b className="text-paper">{o.nom}</b> (principale)
                      </>
                    ) : (
                      `+ ${o.nom}`
                    )}
                  </span>
                ))}
              </div>
              {sel.evt.descriptionCourte && <p className="leading-relaxed text-soft">{sel.evt.descriptionCourte}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Créneaux</h3>
              {sel.creneaux.map((c) => {
                const st = dateStamp(c.debut);
                return (
                  <div key={c.id} className="flex items-center gap-3.5 rounded-2xl border border-line bg-ink px-3 py-2.5">
                    <span className="flex w-12.5 flex-none flex-col items-center leading-none">
                      <span className="text-[11px] font-extrabold tracking-widest text-muted">{st.dow}</span>
                      <span className="mt-1 font-display text-2xl font-extrabold">{st.day}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="font-extrabold">
                        {c.activite ?? dayLabel(c.debut)} <span className="font-semibold text-muted">· {timeLabel(c.debut)} – {timeLabel(c.fin)}</span>
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        {c.lieux.map((l) => (
                          <span key={l.idLieu} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold">
                            {l.label}
                          </span>
                        ))}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            {bloques.length > 0 && (
              <div role="alert" className="rounded-2xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm font-bold text-amber">
                Attention : créneau pendant une période bloquée ({bloques.join(", ")}).
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h3 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Le même jour</h3>
              {memeJour.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-3 rounded-2xl border px-3.5 py-3 text-sm ${m.niveau === "conflit" ? "border-danger/45 bg-danger/10" : m.niveau === "attention" ? "border-amber/45 bg-amber/10" : "border-line bg-ink"}`}
                >
                  <Icon name="alert" size={18} className={`mt-0.5 flex-none ${m.niveau === "conflit" ? "text-danger" : m.niveau === "attention" ? "text-amber" : "text-muted"}`} />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-extrabold">
                      {m.titre} <span className="font-semibold text-muted">· {m.org} · {STATUT_EVENEMENT[m.statut].label}</span>
                    </span>
                    <span className="text-muted">
                      {dayLabel(m.debut)} · {timeLabel(m.debut)} – {timeLabel(m.fin)} · {m.lieux.join(", ")}
                    </span>
                    <span className={`font-extrabold ${m.niveau === "conflit" ? "text-danger" : m.niveau === "attention" ? "text-amber" : "text-muted"}`}>
                      {m.niveau === "conflit" ? "Même lieu au même moment" : m.niveau === "attention" ? "Même lieu, horaires différents" : "Autre lieu"}
                    </span>
                  </span>
                </div>
              ))}
              {!memeJour.length && <span className="rounded-2xl border border-line bg-ink px-3.5 py-3 text-sm text-muted">Aucun autre événement validé ces jours-là.</span>}
            </div>

            {sel.decisions.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Historique</h3>
                {sel.decisions.map((d) => (
                  <div key={d.id} className="flex gap-2.5 text-sm">
                    <span className="mt-1.5 size-2 flex-none rounded-full bg-line-strong" />
                    <span>
                      <span className="text-muted">{dayLabel(d.dateDecision)} — </span>
                      {DECISION[d.decision]}
                      {d.commentaire ? ` : « ${d.commentaire} »` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <DecisionPanel eventId={sel.evt.id} nextHref={next ? `/coord?id=${next.evt.id}` : "/coord"} />
          </section>
        )}
      </div>
    </>
  );
}
