import type { Metadata } from "next";
import Link from "next/link";
import { desc, inArray, ne, sql } from "drizzle-orm";
import { PageTitle } from "@/components/space/SpaceShell";
import { Icon } from "@/components/ui/Icon";
import { rangeLabel } from "@/lib/format";
import { STATUT_EVENEMENT, type StatutEvenement } from "@/lib/statuts";
import { getDb, schema as s } from "@/server/db";
import { creneauxOf, orgsOf } from "@/server/services/coord";

export const metadata: Metadata = { title: "Tous les événements" };

const FILTRES: [string, string][] = [
  ["", "Tous"],
  ["EN_ATTENTE", "En attente"],
  ["MODIF_DEMANDEE", "Modif."],
  ["VALIDE", "Validés"],
  ["PUBLIE", "Publiés"],
  ["TERMINE", "Terminés"],
  ["REFUSE", "Refusés"],
  ["BROUILLON", "Brouillons"],
];
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default async function CoordEvenements({ searchParams }: PageProps<"/coord/evenements">) {
  const sp = await searchParams;
  const statut = typeof sp.statut === "string" ? sp.statut : "";
  const org = typeof sp.org === "string" ? sp.org : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const db = getDb();
  const evts = await db.select().from(s.evenement).where(ne(s.evenement.structure, "SOUS_EVENEMENT")).orderBy(desc(s.evenement.dateMaj));
  const ids = evts.map((e) => e.id);
  const [cs, orgs, allOrgs, counts] = await Promise.all([
    creneauxOf(ids),
    orgsOf(ids),
    db.select({ id: s.organisation.id, nom: s.organisation.nom }).from(s.organisation).orderBy(s.organisation.nom),
    ids.length
      ? db
          .select({ id: s.inscription.idEvenement, n: sql<number>`count(*) filter (where ${s.inscription.statut} = 'CONFIRMEE')`.mapWith(Number) })
          .from(s.inscription)
          .where(inArray(s.inscription.idEvenement, ids))
          .groupBy(s.inscription.idEvenement)
      : [],
  ]);
  const rows = evts
    .map((e) => {
      const c = cs.filter((x) => x.root === e.id);
      return {
        e,
        orgs: orgs.filter((o) => o.idEvenement === e.id).sort((a) => (a.role === "PRINCIPAL" ? -1 : 1)),
        debut: c[0]?.debut ?? null,
        fin: c.at(-1)?.fin ?? null,
        lieux: [...new Set(c.flatMap((x) => x.lieux.map((l) => l.label)))],
        confirmes: counts.find((x) => x.id === e.id)?.n ?? 0,
      };
    })
    .filter((r) => (!org || r.orgs.some((o) => o.id === org)) && (!q || norm(`${r.e.titre} ${r.orgs.map((o) => o.nom).join(" ")}`).includes(norm(q))));
  const list = rows.filter((r) => !statut || r.e.statut === statut);

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(statut ? { statut } : {}), ...(org ? { org } : {}), ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/coord/evenements?${p.toString()}`;
  };

  return (
    <>
      <PageTitle kicker={`${evts.length} événements`} title="Tous les événements">
        <Link href="/coord/nouveau" className="press flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-extrabold text-ink">
          <Icon name="grid" /> Créer pour un club
        </Link>
      </PageTitle>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <nav aria-label="Statut" className="flex flex-wrap gap-1.5">
          {FILTRES.map(([k, label]) => (
            <Link
              key={label}
              href={href({ statut: k })}
              aria-current={statut === k ? "true" : undefined}
              className={`press flex h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold ${statut === k ? "border-paper bg-paper text-ink" : "border-line bg-surface"}`}
            >
              {label}
              <span className="font-extrabold opacity-70">{k ? rows.filter((r) => r.e.statut === k).length : rows.length}</span>
            </Link>
          ))}
        </nav>
        <form action="/coord/evenements" className="flex flex-wrap gap-2">
          {statut && <input type="hidden" name="statut" value={statut} />}
          <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface pr-1 pl-3 text-[13px] font-bold text-muted">
            Organisation
            <select name="org" defaultValue={org} className="h-9 rounded-full bg-surface-2 px-2.5 text-[13px] font-bold text-paper [color-scheme:dark]">
              <option value="">Toutes</option>
              {allOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-muted">
            <Icon name="search" size={16} />
            <span className="sr-only">Rechercher</span>
            <input name="q" type="search" defaultValue={q} placeholder="Rechercher…" className="w-40 bg-transparent text-sm font-semibold text-paper outline-none" />
          </label>
          <button type="submit" className="press h-11 rounded-full border border-line-strong px-4 text-sm font-extrabold">
            Filtrer
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-[22px] border border-line bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wider text-muted uppercase">
              {["Événement", "Organisateurs", "Dates", "Lieux", "Statut", "Participation", ""].map((h) => (
                <th key={h} scope="col" className="px-3 py-3.5 font-extrabold first:pl-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map(({ e, orgs, debut, fin, lieux, confirmes }) => {
              const st = STATUT_EVENEMENT[e.statut as StatutEvenement];
              const cap = e.capacite ? e.capacite - e.placesMembres : null;
              return (
                <tr key={e.id} className="border-t border-line transition-colors hover:bg-hover">
                  <td className="py-3 pr-3 pl-4">
                    <div className="flex items-center gap-2.5">
                      <span className="size-9 flex-none rounded-[11px]" style={{ background: e.couleur }} />
                      <span className="font-extrabold">{e.titre}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-soft">{orgs.map((o) => o.nom).join(" + ")}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-soft">{debut && fin ? rangeLabel(debut, fin) : "—"}</td>
                  <td className="px-3 py-3 text-muted">{lieux.join(", ") || "—"}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="min-w-[140px] px-3 py-3">
                    {e.statut === "PUBLIE" || e.statut === "TERMINE" ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-bold">
                          {confirmes}
                          {cap ? ` / ${cap}` : ""} inscrits
                        </span>
                        {cap && (
                          <div className="h-1.5 overflow-hidden rounded-full bg-line">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((confirmes / cap) * 100))}%` }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={e.statut === "EN_ATTENTE" ? `/coord?id=${e.id}` : `/coord/evenements/${e.id}`}
                      className="press inline-flex h-9.5 items-center rounded-full border border-line-strong px-3 text-[13px] font-extrabold whitespace-nowrap"
                    >
                      {e.statut === "EN_ATTENTE" ? "Traiter" : "Voir"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && <p className="p-7 text-center text-muted">Aucun événement ne correspond aux filtres.</p>}
      </div>
      <span className="text-[13px] text-faint">La participation affiche les inscrits confirmés, jamais les montants encaissés par les clubs.</span>
    </>
  );
}
