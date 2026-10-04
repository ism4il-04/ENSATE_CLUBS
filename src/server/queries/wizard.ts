import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import type { WizardInitial } from "@/components/org/DemandeWizard";
import type { CategorieKey } from "@/lib/format";
import { utcToZoned } from "@/lib/dates";
import { getDb, schema as s } from "@/server/db";
import type { getManagedEvent } from "./org";

type Managed = Awaited<ReturnType<typeof getManagedEvent>>;

/** Convertit un événement existant en données initiales de l'assistant. */
export async function toWizardInitial(m: Managed): Promise<WizardInitial> {
  const slotOf = (c: Managed["creneaux"][number], titre = "") => {
    const d = utcToZoned(c.debut);
    const f = utcToZoned(c.fin);
    const autre = c.lieux.find((l) => l.code === "AUTRE");
    return {
      titre,
      date: d.date,
      debut: d.time,
      fin: f.time,
      lieux: Object.fromEntries(c.lieux.map((l) => [l.idLieu, true])),
      precision: autre?.precision ?? "",
    };
  };

  let slots: WizardInitial["slots"] = m.creneaux.map((c) => slotOf(c));
  if (m.evt.structure === "PROGRAMME" && m.sousEvenements.length) {
    const db = getDb();
    const subIds = m.sousEvenements.map((x) => x.id);
    const cs = await db.select().from(s.creneau).where(inArray(s.creneau.idEvenement, subIds)).orderBy(asc(s.creneau.debut));
    const ls = cs.length
      ? await db
          .select({ idCreneau: s.creneauLieu.idCreneau, idLieu: s.lieu.id, code: s.lieu.code, nom: s.lieu.nom, precision: s.creneauLieu.precision })
          .from(s.creneauLieu)
          .innerJoin(s.lieu, eq(s.lieu.id, s.creneauLieu.idLieu))
          .where(inArray(s.creneauLieu.idCreneau, cs.map((c) => c.id)))
      : [];
    slots = cs.map((c) => slotOf({ ...c, lieux: ls.filter((l) => l.idCreneau === c.id) }, m.sousEvenements.find((x) => x.id === c.idEvenement)?.titre ?? ""));
  }

  return {
    id: m.evt.id,
    structure: m.evt.structure === "PROGRAMME" ? "PROGRAMME" : "SIMPLE",
    titre: m.evt.titre,
    categorie: m.evt.categorie as CategorieKey,
    descriptionCourte: m.evt.descriptionCourte ?? "",
    slots,
    partenaires: m.orgs.filter((o) => o.role === "PARTENAIRE").map((o) => o.id),
    principal: m.orgs.find((o) => o.role === "PRINCIPAL")?.id,
  };
}
