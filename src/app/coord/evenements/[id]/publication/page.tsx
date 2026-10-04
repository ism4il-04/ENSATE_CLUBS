import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PublicationForm } from "@/components/org/PublicationForm";
import { Icon } from "@/components/ui/Icon";
import { STATUT_EVENEMENT } from "@/lib/statuts";
import { AccessError, requirePageRole } from "@/server/permissions";
import { getManagedEvent } from "@/server/queries/org";
import { publicationProps } from "@/server/queries/publication";

export const metadata: Metadata = { title: "Publication" };

/** BF-68 : le coordinateur complète et publie un événement validé, pour n'importe quelle organisation. */
export default async function CoordPublication({ params }: PageProps<"/coord/evenements/[id]/publication">) {
  await requirePageRole("/coord/evenements", "COORDINATEUR", "ADMIN");
  const { id } = await params;
  let m;
  try {
    m = await getManagedEvent(id, { coordinateur: true });
  } catch (e) {
    if (e instanceof AccessError) notFound();
    throw e;
  }
  const { evt } = m;
  if (evt.statut !== "VALIDE" && evt.statut !== "PUBLIE") redirect(`/coord/evenements/${id}`);
  const st = STATUT_EVENEMENT[evt.statut];
  const principal = m.orgs.find((o) => o.role === "PRINCIPAL");

  return (
    <>
      <Link href={`/coord/evenements/${evt.idParent ?? evt.id}`} className="flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-muted">
        <Icon name="chevronLeft" stroke={2.4} /> Fiche de l&apos;événement
      </Link>
      <div className="flex flex-col gap-2.5">
        <span className={`self-start rounded-full px-3 py-1 text-xs font-extrabold ${st.cls}`}>{st.label}</span>
        <h1 className="font-display text-[clamp(32px,4vw,46px)] leading-none font-extrabold tracking-[-0.04em]">{evt.titre}</h1>
        <span className="text-sm text-muted">Publication pour {principal?.nom ?? "l'organisation"} : le club voit et peut reprendre ces informations.</span>
      </div>
      <PublicationForm {...(await publicationProps(m, "coord"))} />
    </>
  );
}
