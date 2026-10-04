import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/space/SpaceShell";
import { CATEGORIES, type CategorieKey } from "@/lib/format";
import { utcToZoned, zonedToUtc } from "@/lib/dates";
import { statistiques } from "@/server/services/admin";
import { requirePageRole } from "@/server/permissions";

export const metadata: Metadata = { title: "Statistiques" };

/** Période : mois courant, semestre (depuis septembre ou février) ou année universitaire. */
function periode(p: string) {
  const today = utcToZoned(new Date()).date;
  const [y, m] = today.split("-").map(Number);
  const start = (yy: number, mm: number) => zonedToUtc(`${yy}-${String(mm).padStart(2, "0")}-01`, "00:00");
  const uniYear = m >= 9 ? y : y - 1;
  if (p === "semestre") return m >= 9 || m === 1 ? { from: start(m === 1 ? y - 1 : y, 9), to: start(m === 1 ? y : y + 1, 2) } : { from: start(y, 2), to: start(y, 9) };
  if (p === "annee") return { from: start(uniYear, 9), to: start(uniYear + 1, 9) };
  return { from: start(y, m), to: start(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1) };
}

export default async function Statistiques({ searchParams }: PageProps<"/coord/statistiques">) {
  await requirePageRole("/coord/statistiques", "COORDINATEUR", "ADMIN");
  const p = String((await searchParams).periode ?? "mois");
  const { from, to } = periode(p);
  const st = await statistiques(from, to);
  const max = Math.max(1, ...st.parOrg.map((o) => o.confirmes));
  const cmax = Math.max(1, ...st.parCategorie.map((c) => c.n));
  const taux = st.totalConfirmes ? Math.round((st.totalPresents / st.totalConfirmes) * 100) : 0;

  return (
    <>
      <PageTitle kicker="Participation · aucune donnée financière" title="Statistiques">
        <nav aria-label="Période" className="flex gap-1 rounded-full border border-line bg-surface p-1">
          {(
            [
              ["mois", "Ce mois"],
              ["semestre", "Semestre"],
              ["annee", "Année"],
            ] as const
          ).map(([k, label]) => (
            <Link key={k} href={`/coord/statistiques?periode=${k}`} aria-current={p === k ? "page" : undefined} className={`flex h-10 items-center rounded-full px-4 text-sm font-bold ${p === k ? "bg-paper text-ink" : ""}`}>
              {label}
            </Link>
          ))}
        </nav>
      </PageTitle>

      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        {[
          ["Taux de présence", `${taux} %`, true],
          ["Événements", String(st.evenements), false],
          ["Inscriptions confirmées", String(st.totalConfirmes), false],
          ["Présences", String(st.totalPresents), false],
        ].map(([label, value, hero]) => (
          <div key={label as string} className={`animate-rise rounded-[22px] p-4.5 ${hero ? "bg-accent text-ink" : "border border-line bg-surface"}`}>
            <div className={`text-sm ${hero ? "font-bold" : "font-semibold text-muted"}`}>{label}</div>
            <div className="mt-1.5 font-display text-[40px] leading-none font-extrabold">{value}</div>
          </div>
        ))}
      </div>

      <section aria-labelledby="part" className="flex flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="part" className="text-lg font-extrabold">
            Participation par organisation
          </h2>
          <div className="flex gap-3.5 text-[13px] text-soft">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[3px] bg-accent-dim" /> Inscrits confirmés
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[3px] bg-accent" /> Présents
            </span>
          </div>
        </div>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Inscrits confirmés et présents par organisation</caption>
          <tbody>
            {st.parOrg.map((o) => (
              <tr key={o.nom} className="transition-colors hover:bg-hover" title={`${o.nom} : ${o.confirmes} confirmés, ${o.presents} présents`}>
                <th scope="row" className="w-[34%] max-w-[210px] truncate py-2 pr-3 text-left font-bold text-soft">
                  {o.nom}
                </th>
                <td className="w-full py-2">
                  <div className="relative h-5 rounded-r bg-accent-dim" style={{ width: `${Math.max(2, Math.round((o.confirmes / max) * 100))}%` }}>
                    <div className="absolute inset-y-0 left-0 rounded-r bg-accent shadow-[2px_0_0_#15161f]" style={{ width: `${o.confirmes ? Math.round((o.presents / o.confirmes) * 100) : 0}%` }} />
                  </div>
                </td>
                <td className="py-2 pl-3 text-right font-extrabold whitespace-nowrap tabular-nums">
                  {o.presents} / {o.confirmes} · {o.confirmes ? Math.round((o.presents / o.confirmes) * 100) : 0} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!st.parOrg.length && <p className="text-muted">Aucun événement publié sur cette période.</p>}
      </section>

      <section aria-labelledby="cat" className="flex flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
        <h2 id="cat" className="text-lg font-extrabold">
          Événements par catégorie
        </h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {st.parCategorie.map((c) => (
              <tr key={c.categorie} title={`${CATEGORIES[c.categorie as CategorieKey]} : ${c.n}`}>
                <th scope="row" className="w-[30%] py-2 pr-3 text-left font-bold text-soft">
                  {CATEGORIES[c.categorie as CategorieKey]}
                </th>
                <td className="w-full py-2">
                  <div className="h-4 rounded-r bg-accent" style={{ width: `${Math.max(2, Math.round((c.n / cmax) * 100))}%` }} />
                </td>
                <td className="py-2 pl-3 text-right font-extrabold tabular-nums">{c.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-[13px] text-faint">Les montants encaissés et la trésorerie des clubs ne sont jamais affichés au coordinateur.</p>
    </>
  );
}
