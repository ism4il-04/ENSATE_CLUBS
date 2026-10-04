import type { Metadata } from "next";
import Link from "next/link";
import { and, inArray, ne } from "drizzle-orm";
import { PageTitle } from "@/components/space/SpaceShell";
import { Icon } from "@/components/ui/Icon";
import { timeLabel } from "@/lib/format";
import { STATUT_EVENEMENT } from "@/lib/statuts";
import { utcToZoned, zonedToUtc } from "@/lib/dates";
import { getDb, schema as s } from "@/server/db";
import { creneauxOf, orgsOf } from "@/server/services/coord";

export const metadata: Metadata = { title: "Calendrier" };

const PLACES = [
  ["", "Tous les lieux"],
  ["AMPHI", "Amphi"],
  ["RDC", "RDC 001–006"],
  ["E1", "1er 101–106"],
  ["E2", "2e 201–206"],
  ["LECTURE", "Salle de lecture"],
  ["ECOLE", "Toute l'école"],
  ["AUTRE", "Autre"],
] as const;

const matchPlace = (code: string, f: string) =>
  !f || (f === "RDC" ? /^00\d$/.test(code) : f === "E1" ? /^1\d\d$/.test(code) : f === "E2" ? /^2\d\d$/.test(code) : code === f);

export default async function Calendrier({ searchParams }: PageProps<"/coord/calendrier">) {
  const sp = await searchParams;
  const today = utcToZoned(new Date()).date;
  const mois = typeof sp.mois === "string" && /^\d{4}-\d{2}$/.test(sp.mois) ? sp.mois : today.slice(0, 7);
  const lieu = typeof sp.lieu === "string" ? sp.lieu : "";
  const attente = sp.attente !== "0";
  const [y, m] = mois.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const jour = typeof sp.jour === "string" && sp.jour.startsWith(mois) ? sp.jour : today.startsWith(mois) ? today : `${mois}-01`;

  const statuts = attente ? (["VALIDE", "PUBLIE", "EN_ATTENTE", "MODIF_DEMANDEE", "TERMINE"] as const) : (["VALIDE", "PUBLIE", "TERMINE"] as const);
  const db = getDb();
  const from = zonedToUtc(`${mois}-01`, "00:00");
  const to = zonedToUtc(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, "00:00");
  const evts = await db
    .select({ id: s.evenement.id, idParent: s.evenement.idParent, titre: s.evenement.titre, statut: s.evenement.statut, couleur: s.evenement.couleur })
    .from(s.evenement)
    .where(and(inArray(s.evenement.statut, [...statuts]), ne(s.evenement.structure, "PROGRAMME")));
  const roots = [...new Set(evts.map((e) => e.idParent ?? e.id))];
  const parents = roots.length ? await db.select({ id: s.evenement.id, titre: s.evenement.titre, statut: s.evenement.statut, couleur: s.evenement.couleur }).from(s.evenement).where(inArray(s.evenement.id, roots)) : [];
  const [cs, orgs] = await Promise.all([creneauxOf(roots), orgsOf(roots)]);
  const items = cs
    .filter((c) => c.debut >= from && c.debut < to)
    .filter((c) => c.lieux.some((l) => matchPlace(l.code, lieu)))
    .map((c) => {
      const p = parents.find((x) => x.id === c.root)!;
      return {
        id: c.id,
        day: utcToZoned(c.debut).date,
        titre: c.activite ? `${p.titre} · ${c.activite}` : p.titre,
        statut: p.statut,
        couleur: p.couleur,
        debut: c.debut,
        fin: c.fin,
        lieux: c.lieux,
        org: orgs.find((o) => o.idEvenement === c.root && o.role === "PRINCIPAL")?.nom ?? "",
      };
    })
    .filter((x) => (statuts as readonly string[]).includes(x.statut));

  // Grille du lundi au dimanche.
  const offset = (first.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => {
    const d = i - offset + 1;
    if (d < 1 || d > daysInMonth) return null;
    const date = `${mois}-${String(d).padStart(2, "0")}`;
    const list = items.filter((x) => x.day === date);
    const codes = list.flatMap((x) => x.lieux.map((l) => l.code));
    const clash = new Set(codes).size < codes.length || (codes.includes("ECOLE") && list.length > 1);
    return { d, date, list, clash };
  });
  const sel = items.filter((x) => x.day === jour).sort((a, b) => a.debut.getTime() - b.debut.getTime());
  const selCodes = sel.flatMap((x) => x.lieux.map((l) => l.code));
  const dup = (code: string) => selCodes.filter((c) => c === code).length > 1 || (code !== "ECOLE" && selCodes.includes("ECOLE"));

  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams({ mois, ...(lieu ? { lieu } : {}), ...(attente ? {} : { attente: "0" }), jour });
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `/coord/calendrier?${p.toString()}`;
  };
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  return (
    <>
      <PageTitle kicker="Tous les lieux, tous les clubs" title={monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={qs({ mois: shift(-1), jour: null })} aria-label="Mois précédent" className="press grid size-11 place-items-center rounded-full border border-line-strong">
            <Icon name="chevronLeft" />
          </Link>
          <Link href={qs({ mois: shift(1), jour: null })} aria-label="Mois suivant" className="press grid size-11 place-items-center rounded-full border border-line-strong">
            <Icon name="chevronRight" />
          </Link>
          <Link href={qs({ attente: attente ? "0" : null })} aria-pressed={attente} className={`press flex h-11 items-center rounded-full border px-4 text-sm font-bold ${attente ? "border-accent text-accent" : "border-line-strong"}`}>
            {attente ? "Demandes en attente affichées" : "Demandes en attente masquées"}
          </Link>
        </div>
      </PageTitle>

      <nav aria-label="Filtrer par lieu" className="flex flex-wrap gap-1.5">
        {PLACES.map(([k, label]) => (
          <Link key={label} href={qs({ lieu: k || null })} aria-current={lieu === k ? "true" : undefined} className={`press flex h-10 items-center rounded-full border px-3.5 text-[13px] font-bold ${lieu === k ? "border-accent bg-accent text-ink" : "border-line bg-surface"}`}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_600px] overflow-x-auto pb-1.5">
          <div className="flex min-w-[820px] flex-col gap-1.5">
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-extrabold tracking-widest text-faint">
              {["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((c, i) =>
                c ? (
                  <Link
                    key={c.date}
                    href={qs({ jour: c.date })}
                    aria-label={`${c.d} : ${c.list.length} créneau${c.list.length > 1 ? "x" : ""}`}
                    className={`flex min-h-28 flex-col gap-1 rounded-2xl border-[1.5px] p-2 transition-transform hover:-translate-y-0.5 ${c.date === jour ? "border-accent bg-surface-2" : c.date === today ? "border-line-strong bg-surface" : "border-line bg-surface"}`}
                  >
                    <span className="flex items-center justify-between">
                      <span className={`font-display text-lg font-extrabold ${c.date === today ? "text-accent" : ""}`}>{c.d}</span>
                      {c.clash && <span title="Même lieu réservé plusieurs fois" className="animate-pulse-ring size-2.5 rounded-full bg-amber" />}
                    </span>
                    {c.list.slice(0, 3).map((x) => {
                      const pending = x.statut === "EN_ATTENTE" || x.statut === "MODIF_DEMANDEE";
                      return (
                        <span
                          key={x.id}
                          className="truncate rounded-lg border border-dashed px-1.5 py-0.5 text-[11px] leading-tight font-extrabold"
                          style={pending ? { borderColor: x.couleur, color: x.couleur } : { background: x.couleur, borderColor: "transparent", color: "#0B0C12" }}
                        >
                          {x.titre}
                        </span>
                      );
                    })}
                    {c.list.length > 3 && <span className="text-[11px] font-bold text-muted">+{c.list.length - 3} autres</span>}
                  </Link>
                ) : (
                  <span key={`x${i}`} className="min-h-28 rounded-2xl border border-line/50" />
                ),
              )}
            </div>
          </div>
        </div>

        <aside key={jour} className="animate-rise flex flex-[1_1_300px] flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
          <span className="text-[13px] font-extrabold tracking-widest text-accent uppercase">
            {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${jour}T12:00:00Z`))}
          </span>
          {sel.some((x) => x.lieux.some((l) => dup(l.code))) && (
            <div className="rounded-2xl border border-amber/45 bg-amber/10 px-3 py-2.5 text-[13px] font-extrabold text-amber">Même lieu utilisé par plusieurs événements : vérifie les horaires.</div>
          )}
          {sel.map((x) => (
            <div key={x.id} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-ink p-3">
              <div className="flex items-center gap-2">
                <span className="size-3 flex-none rounded" style={{ background: x.couleur }} />
                <span className="flex-1 font-extrabold">{x.titre}</span>
              </div>
              <span className="text-[13px] text-muted">
                {timeLabel(x.debut)} – {timeLabel(x.fin)} · {x.org}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {x.lieux.map((l) => (
                  <span key={l.idLieu} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${dup(l.code) ? "bg-amber/18 text-amber" : "bg-surface-2"}`}>
                    {l.label}
                  </span>
                ))}
                <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-bold">{STATUT_EVENEMENT[x.statut].label}</span>
              </span>
            </div>
          ))}
          {!sel.length && <span className="text-sm text-muted">Aucun événement ce jour-là : tous les lieux sont libres.</span>}
        </aside>
      </div>
    </>
  );
}
