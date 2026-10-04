import { ics, type IcsEvent } from "@/lib/ics";
import { appUrl } from "@/server/email/send";
import { getPublicEvent } from "@/server/queries/evenements";

// BF-18 : ajoute un événement publié à son agenda (données publiques uniquement).
export async function GET(_req: Request, { params }: RouteContext<"/evenements/[slug]/agenda.ics">) {
  const { slug } = await params;
  const e = await getPublicEvent(slug);
  if (!e) return new Response("Événement introuvable", { status: 404 });
  const url = `${appUrl()}/evenements/${e.slug}`;
  const organisateurs = e.orgs.map((o) => o.nom).join(", ");
  const items = [{ titre: e.titre, creneaux: e.creneaux }, ...e.sousEvenements.map((x) => ({ titre: `${e.titre} — ${x.titre}`, creneaux: x.creneaux }))];
  const events: IcsEvent[] = items.flatMap((it) =>
    it.creneaux.map((c) => ({
      uid: `${c.id}@ensate-clubs`,
      debut: c.debut,
      fin: c.fin,
      titre: it.titre,
      lieu: c.lieux.length ? `${c.lieux.join(", ")} · ENSA Tétouan` : "ENSA Tétouan",
      description: [e.descriptionCourte, organisateurs && `Organisé par ${organisateurs}`, url].filter(Boolean).join("\n"),
      url,
    })),
  );
  return new Response(ics(e.titre, events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${e.slug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
