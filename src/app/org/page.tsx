import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/space/SpaceShell";
import { Icon } from "@/components/ui/Icon";
import { dateStamp, rangeLabel } from "@/lib/format";
import { STATUT_EVENEMENT } from "@/lib/statuts";
import { peut, requireOrgPage } from "@/server/permissions";
import { listOrgEvents } from "@/server/queries/org";
import { ReprendreDemande } from "@/components/org/InfosEvenement";

export const metadata: Metadata = { title: "Mes événements" };

const TABS = [
  ["ALL", "Tous"],
  ["TODO", "À faire"],
  ["WAIT", "En attente"],
  ["PUB", "Publiés"],
  ["DONE", "Terminés"],
] as const;

export default async function OrgDashboard({ searchParams }: PageProps<"/org">) {
  const { org, acces } = await requireOrgPage("caisse", "/org");
  const gerer = peut(acces, "gerer");
  const tab = String((await searchParams).tab ?? "ALL");
  const all = await listOrgEvents(org.id);
  const group = (st: keyof typeof STATUT_EVENEMENT) => STATUT_EVENEMENT[st].group;
  const list = all.filter((e) => tab === "ALL" || group(e.evt.statut) === tab);

  return (
    <>
      <PageTitle kicker={org.nom} title="Mes événements">
        {gerer && (
          <Link href="/org/evenements/nouveau" className="press flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-extrabold text-ink">
            <Icon name="grid" /> Nouvel événement
          </Link>
        )}
      </PageTitle>

      <nav aria-label="Filtrer par statut" className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map(([k, label]) => {
          const on = tab === k;
          const n = k === "ALL" ? all.length : all.filter((e) => group(e.evt.statut) === k).length;
          return (
            <Link
              key={k}
              href={k === "ALL" ? "/org" : `/org?tab=${k}`}
              aria-current={on ? "page" : undefined}
              className={`press flex h-11 flex-none items-center gap-2 rounded-full border px-4 text-sm font-bold ${on ? "border-paper bg-paper text-ink" : "border-line bg-surface"}`}
            >
              {label}
              <span className={`grid h-5.5 min-w-5.5 place-items-center rounded-full px-1.5 text-xs font-extrabold ${on ? "bg-ink text-accent" : "bg-surface-2 text-muted"}`}>{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3">
        {list.map(({ evt, role, principal, debut, fin, confirmes, pre, derniereDecision }, i) => {
          const st = STATUT_EVENEMENT[evt.statut];
          const stamp = debut ? dateStamp(debut) : null;
          const editable = gerer && role === "PRINCIPAL" && (evt.statut === "BROUILLON" || evt.statut === "MODIF_DEMANDEE");
          const pct = evt.capacite ? Math.round((confirmes / Math.max(1, evt.capacite - evt.placesMembres)) * 100) : 0;
          return (
            <article
              key={evt.id}
              className="animate-rise flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-surface p-3.5 transition-transform hover:-translate-y-0.5"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="flex size-21 flex-none flex-col items-center justify-center rounded-[20px] leading-none text-ink" style={{ background: evt.couleur }}>
                <span className="text-[11px] font-extrabold tracking-widest">{stamp?.dow ?? "—"}</span>
                <span className="mt-1 font-display text-3xl font-extrabold">{stamp?.day ?? "?"}</span>
              </span>
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
                <div className="flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${st.cls}`}>{st.label}</span>
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">
                    {role === "PRINCIPAL" ? "Principal" : `Partenaire · géré par ${principal ?? "?"}`}
                  </span>
                  {evt.structure === "PROGRAMME" && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold">Programme</span>}
                </div>
                <h2 className="text-lg font-extrabold">{evt.titre}</h2>
                <span className="text-sm text-muted">{debut && fin ? rangeLabel(debut, fin) : "Dates à définir"}</span>
              </div>
              {evt.statut === "PUBLIE" && evt.structure !== "PROGRAMME" && (
                <div className="flex flex-[0_1_200px] flex-col gap-2">
                  <span className="text-[13px] font-bold">
                    {confirmes}
                    {evt.capacite ? ` / ${evt.capacite - evt.placesMembres}` : ""} confirmés · {pre} à payer
                  </span>
                  {evt.capacite && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {editable && (
                  <Link href={`/org/evenements/${evt.id}/demande`} className="press flex h-11 items-center rounded-full bg-accent px-4 text-sm font-extrabold text-ink">
                    {evt.statut === "BROUILLON" ? "Continuer" : "Corriger et resoumettre"}
                  </Link>
                )}
                {gerer && evt.statut === "EN_ATTENTE" && role === "PRINCIPAL" && <ReprendreDemande eventId={evt.id} />}
                {gerer && (evt.statut === "VALIDE" || evt.statut === "PUBLIE") && role === "PRINCIPAL" && (
                  <Link
                    href={`/org/evenements/${evt.id}/publication`}
                    className={`press flex h-11 items-center rounded-full px-4 text-sm font-extrabold ${evt.statut === "VALIDE" ? "bg-accent text-ink" : "border border-line-strong"}`}
                  >
                    {evt.statut === "VALIDE" ? "Compléter et publier" : "Publication"}
                  </Link>
                )}
                {["TERMINE", "ANNULE"].includes(evt.statut) && evt.structure !== "PROGRAMME" && (
                  <Link href={`/org/evenements/${evt.id}/inscrits`} className="press flex h-11 items-center rounded-full border border-line-strong px-4 text-sm font-extrabold">
                    Inscrits
                  </Link>
                )}
                {evt.statut === "PUBLIE" && evt.structure !== "PROGRAMME" && (
                  <>
                    <Link href={`/org/evenements/${evt.id}/inscrits`} className="press flex h-11 items-center rounded-full border border-line-strong px-4 text-sm font-extrabold">
                      Inscrits
                    </Link>
                    <Link href={`/org/evenements/${evt.id}/stand`} className="press flex h-11 items-center rounded-full border border-line-strong px-4 text-sm font-extrabold">
                      Stand
                    </Link>
                    <Link href={`/org/evenements/${evt.id}/controle`} className="press flex h-11 items-center rounded-full border border-line-strong px-4 text-sm font-extrabold">
                      Contrôle
                    </Link>
                  </>
                )}
              </div>
              {evt.statut === "MODIF_DEMANDEE" && derniereDecision?.commentaire && (
                <div className="flex flex-[1_1_100%] gap-2.5 rounded-2xl border border-amber/35 bg-amber/8 px-3.5 py-3 text-sm leading-relaxed">
                  <b className="flex-none text-amber">Coordinateur :</b>
                  <span className="text-soft">« {derniereDecision.commentaire} »</span>
                </div>
              )}
              {evt.statut === "REFUSE" && derniereDecision?.commentaire && (
                <div className="flex flex-[1_1_100%] gap-2.5 rounded-2xl border border-danger/35 bg-danger/8 px-3.5 py-3 text-sm">
                  <b className="flex-none text-danger">Refus :</b>
                  <span className="text-soft">« {derniereDecision.commentaire} »</span>
                </div>
              )}
            </article>
          );
        })}
        {list.length === 0 && (
          <div className="rounded-3xl border-[1.5px] border-dashed border-line-strong p-9 text-center text-muted">
            {all.length ? "Rien dans cette catégorie." : "Aucun événement pour l'instant : crée ta première demande."}
          </div>
        )}
      </div>
    </>
  );
}
