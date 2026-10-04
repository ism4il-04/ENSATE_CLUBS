import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreneauxEditor } from "@/components/coord/CreneauxEditor";
import { AnnulerEvenement } from "@/components/events/AnnulerEvenement";
import { Icon } from "@/components/ui/Icon";
import { dayLabel, LIEU_LABEL, timeLabel } from "@/lib/format";
import { utcToZoned } from "@/lib/dates";
import { STATUT_EVENEMENT } from "@/lib/statuts";
import { AccessError } from "@/server/permissions";
import { countInscritsActifs, getManagedEvent, listLieux } from "@/server/queries/org";

export const metadata: Metadata = { title: "Événement" };

export default async function CoordEvenement({ params }: PageProps<"/coord/evenements/[id]">) {
  const { id } = await params;
  let m;
  try {
    m = await getManagedEvent(id, { coordinateur: true });
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
  const { evt } = m;
  const st = STATUT_EVENEMENT[evt.statut];
  const editable = (evt.statut === "VALIDE" || evt.statut === "PUBLIE") && evt.structure !== "PROGRAMME";
  const annulable = evt.structure !== "SOUS_EVENEMENT" && !["ANNULE", "TERMINE", "REFUSE"].includes(evt.statut);
  const [lieux, inscrits] = await Promise.all([editable ? listLieux() : [], annulable ? countInscritsActifs(evt.id) : 0]);

  return (
    <>
      <Link href="/coord/evenements" className="flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-muted">
        <Icon name="chevronLeft" stroke={2.4} /> Tous les événements
      </Link>
      <div className="flex flex-col gap-2.5">
        <span className={`self-start rounded-full px-3 py-1 text-xs font-extrabold ${st.cls}`}>{st.label}</span>
        <h1 className="font-display text-[clamp(32px,4vw,46px)] leading-none font-extrabold tracking-[-0.04em]">{evt.titre}</h1>
        <span className="text-sm text-muted">{m.orgs.map((o) => `${o.nom}${o.role === "PRINCIPAL" ? " (principale)" : ""}`).join(" · ")}</span>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[999_1_480px] flex-col gap-3 rounded-[26px] border border-line bg-surface p-5">
          <h2 className="text-[17px] font-extrabold">{editable ? "Modifier les créneaux (RG-08)" : "Créneaux"}</h2>
          {editable ? (
            <CreneauxEditor
              eventId={evt.id}
              lieux={lieux}
              initial={m.creneaux.map((c) => ({
                date: utcToZoned(c.debut).date,
                debut: utcToZoned(c.debut).time,
                fin: utcToZoned(c.fin).time,
                lieux: Object.fromEntries(c.lieux.map((l) => [l.idLieu, true])),
                precision: c.lieux.find((l) => l.code === "AUTRE")?.precision ?? "",
              }))}
            />
          ) : evt.structure === "PROGRAMME" ? (
            <div className="flex flex-col gap-2">
              {m.sousEvenements.map((x) => (
                <Link key={x.id} href={`/coord/evenements/${x.id}`} className="press flex items-center justify-between rounded-2xl border border-line bg-ink px-4 py-3 font-bold">
                  {x.titre} <Icon name="chevronRight" className="text-muted" />
                </Link>
              ))}
            </div>
          ) : (
            m.creneaux.map((c) => (
              <div key={c.id} className="rounded-2xl border border-line bg-ink px-3.5 py-3 text-sm">
                <b>{dayLabel(c.debut)}</b> · {timeLabel(c.debut)} – {timeLabel(c.fin)} · {c.lieux.map((l) => LIEU_LABEL(l.code, l.nom, l.precision)).join(", ")}
              </div>
            ))
          )}
        </section>
        <aside className="flex flex-[1_1_280px] flex-col gap-2.5 rounded-[26px] border border-line bg-surface p-5 text-sm">
          <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Historique</h2>
          {m.decisions.map((d) => (
            <span key={d.id}>
              <span className="text-muted">{dayLabel(d.dateDecision)} — </span>
              {d.decision === "VALIDE" ? "Validé" : d.decision === "REFUSE" ? "Refusé" : "Modification demandée"}
              {d.commentaire ? ` : « ${d.commentaire} »` : ""}
            </span>
          ))}
          {!m.decisions.length && <span className="text-muted">Aucune décision.</span>}
          {evt.statut === "PUBLIE" && (
            <Link href={`/evenements/${evt.slug}`} className="press mt-2 flex h-11 items-center justify-center rounded-full border border-line-strong font-extrabold">
              Voir la page publique
            </Link>
          )}
        </aside>
      </div>
      {annulable && <AnnulerEvenement eventId={evt.id} titre={evt.titre} inscrits={inscrits} />}
    </>
  );
}
