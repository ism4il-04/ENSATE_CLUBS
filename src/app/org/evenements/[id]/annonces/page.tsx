import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnnonceForm } from "@/components/org/AnnonceForm";
import { EventHeader } from "@/components/org/EventHeader";
import { dayLabel, timeLabel } from "@/lib/format";
import { AccessError, requireOrgPage } from "@/server/permissions";
import { getManagedEvent } from "@/server/queries/org";
import { annoncesRestantes, compterDestinataires, listAnnonces } from "@/server/services/annonces";

export const metadata: Metadata = { title: "Annonces" };

export default async function Annonces({ params }: PageProps<"/org/evenements/[id]/annonces">) {
  const { id } = await params;
  const { org } = await requireOrgPage("gerer", "/org");
  let m;
  try {
    m = await getManagedEvent(id, { orgId: org.id });
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
  const { evt } = m;
  if (evt.statut !== "PUBLIE" && evt.statut !== "TERMINE") notFound();
  const [compte, annonces, restantes] = await Promise.all([compterDestinataires(evt.id), listAnnonces(evt.id), annoncesRestantes(evt.id)]);

  return (
    <>
      <EventHeader id={evt.id} titre={evt.titre} statut={evt.statut} current="annonces" isPrincipal={m.isPrincipal} />
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_480px]">
          <AnnonceForm eventId={evt.id} compte={compte} restantes={restantes} />
        </div>
        <section className="flex flex-[1_1_300px] flex-col gap-2.5">
          <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Historique</h2>
          {annonces.map((a) => (
            <article key={a.id} className="flex flex-col gap-1.5 rounded-[22px] border border-line bg-surface p-4">
              <span className="text-xs font-bold text-muted">
                {dayLabel(a.date)} · {timeLabel(a.date)} · {a.org} · {a.destinataires} destinataire{a.destinataires > 1 ? "s" : ""}
              </span>
              <span className="font-extrabold">{a.titre}</span>
              <p className="line-clamp-4 text-sm leading-relaxed whitespace-pre-line text-soft">{a.contenu}</p>
            </article>
          ))}
          {!annonces.length && <p className="text-sm text-muted">Aucune annonce envoyée pour l&apos;instant.</p>}
        </section>
      </div>
    </>
  );
}
