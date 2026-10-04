import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventHeader } from "@/components/org/EventHeader";
import { InscritsTable } from "@/components/org/InscritsTable";
import { Icon } from "@/components/ui/Icon";
import { AccessError, requireOrganisation } from "@/server/permissions";
import { getManagedEvent } from "@/server/queries/org";
import { listInscrits } from "@/server/services/caisse";

export const metadata: Metadata = { title: "Inscrits" };

export default async function Inscrits({ params }: PageProps<"/org/evenements/[id]/inscrits">) {
  const { id } = await params;
  const { org } = await requireOrganisation();
  let m;
  try {
    m = await getManagedEvent(id, { orgId: org.id });
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
  const { evt, list, tarifs, stats } = await listInscrits(id, org.id);
  const publiques = evt.capacite === null ? null : evt.capacite - evt.placesMembres;

  const tiles = [
    { label: "Confirmés (public)", value: `${stats.confirmesPublics}${publiques !== null ? ` / ${publiques}` : ""}`, hero: true },
    { label: evt.gratuit ? "Liste d'attente" : "À payer", value: String(evt.gratuit ? stats.attente : stats.pre) },
    { label: "Places membres", value: `${stats.membres} / ${evt.placesMembres}` },
    { label: "Encaissé par nous", value: `${stats.encaisse} DH` },
  ];

  return (
    <>
      <EventHeader
        id={evt.id}
        titre={evt.titre}
        statut={evt.statut}
        current="inscrits"
        isPrincipal={m.isPrincipal}
        partenaires={m.orgs.filter((o) => o.role === "PARTENAIRE").map((o) => o.nom).join(", ")}
      />
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))]">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-[20px] p-4 ${t.hero ? "bg-accent text-ink" : "border border-line bg-surface"}`}>
            <div className={`text-[13px] ${t.hero ? "font-bold" : "font-semibold text-muted"}`}>{t.label}</div>
            <div className="mt-1 font-display text-4xl leading-none font-extrabold">{t.value}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <a href={`/org/evenements/${id}/inscrits/export`} className="press flex h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-extrabold">
          <Icon name="arrowRight" className="rotate-90" /> Exporter (Excel / CSV)
        </a>
      </div>
      <InscritsTable
        eventId={evt.id}
        rows={list.map((r) => ({ ...r, tokenBillet: undefined }))}
        tarifs={tarifs}
        gratuit={evt.gratuit}
        telephoneRequis={evt.telephoneRequis}
        placesMembres={evt.placesMembres}
        membresAttribues={stats.membres}
      />
      <p className="text-[13px] text-faint">
        Le tarif de chaque participant est choisi au moment d&apos;encaisser. Les montants encaissés par les partenaires ne sont pas visibles ici.
      </p>
    </>
  );
}
