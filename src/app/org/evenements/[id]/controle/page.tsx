import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ControleScreen } from "@/components/org/ControleScreen";
import { EventHeader } from "@/components/org/EventHeader";
import { dayLabel, timeLabel } from "@/lib/format";
import { utcToZoned } from "@/lib/dates";
import { AccessError, peut, requireOrgPage } from "@/server/permissions";
import { getManagedEvent } from "@/server/queries/org";
import { controleData } from "@/server/services/checkin";

export const metadata: Metadata = { title: "Contrôle d'entrée" };

export default async function Controle({ params }: PageProps<"/org/evenements/[id]/controle">) {
  const { id } = await params;
  const { org, acces } = await requireOrgPage("caisse", "/org");
  let m;
  try {
    m = await getManagedEvent(id, { orgId: org.id });
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
  if (m.evt.statut !== "PUBLIE" || m.evt.structure === "PROGRAMME") notFound();
  const data = await controleData(id);
  const today = utcToZoned(new Date()).date;

  return (
    <>
      <EventHeader id={m.evt.id} titre={m.evt.titre} statut={m.evt.statut} current="controle" isPrincipal={m.isPrincipal} gerer={peut(acces, "gerer")} />
      <ControleScreen
        eventId={id}
        confirmes={data.confirmes}
        participants={data.participants}
        creneaux={data.creneaux.map((c, i) => ({
          id: c.id,
          label: `Jour ${i + 1}`,
          sub: `${dayLabel(c.debut)} · ${timeLabel(c.debut)}`,
          presents: c.presents,
          today: utcToZoned(c.debut).date === today,
        }))}
      />
    </>
  );
}
