import type { Metadata } from "next";
import { ActionButton, AdminForm } from "@/components/coord/AdminControls";
import { PageTitle } from "@/components/space/SpaceShell";
import { dayLabel } from "@/lib/format";
import { creerOrganisationAction, organisationStatutAction } from "@/server/actions/admin";
import { listOrganisationsAdmin } from "@/server/services/admin";
import { requirePageRole } from "@/server/permissions";

export const metadata: Metadata = { title: "Organisations" };

const field = "h-12 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 font-semibold text-paper outline-none focus:border-accent";

export default async function Organisations() {
  await requirePageRole("/coord/organisations", "COORDINATEUR", "ADMIN");
  const orgs = await listOrganisationsAdmin();
  const clubs = orgs.filter((o) => o.org.type === "CLUB").length;

  return (
    <>
      <PageTitle kicker={`${clubs} clubs · ${orgs.length - clubs} associations`} title="Organisations" />
      <div className="flex flex-wrap items-start gap-5">
        <section className="grid min-w-0 flex-[999_1_520px] gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
          {orgs.map(({ org, email, googleSub, derniereConnexion, evenements }, i) => {
            const active = org.statut === "ACTIVE";
            return (
              <article key={org.id} className={`animate-rise flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-4 ${active ? "" : "opacity-60"}`} style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex items-center gap-3">
                  <span className="grid size-12 flex-none place-items-center rounded-[15px] font-extrabold text-ink" style={{ background: org.couleur }}>
                    {(org.sigle ?? org.nom.slice(0, 2)).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-extrabold">{org.nom}</div>
                    <div className="text-xs font-extrabold tracking-wider text-muted uppercase">{org.type === "CLUB" ? "Club" : "Association"}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-[13px]">
                  <span className="truncate text-soft">{email}</span>
                  <span className={`flex items-center gap-1.5 font-bold ${googleSub ? "text-accent" : "text-amber"}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {googleSub ? `Compte actif${derniereConnexion ? ` · ${dayLabel(derniereConnexion)}` : ""}` : "Jamais connecté"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-2.5 text-[13px] text-muted">
                  <span>
                    {evenements} événement{evenements > 1 ? "s" : ""}
                  </span>
                  <ActionButton
                    action={organisationStatutAction.bind(null, org.id, !active)}
                    label={active ? "Désactiver" : "Réactiver"}
                    confirm={active ? "Confirmer" : undefined}
                    tone={active ? "danger" : "accent"}
                  />
                </div>
              </article>
            );
          })}
          {!orgs.length && <p className="text-muted">Aucune organisation pour l&apos;instant.</p>}
        </section>

        <aside className="flex flex-[1_1_300px] flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-lg font-extrabold">Nouvelle organisation</h2>
          <AdminForm action={creerOrganisationAction} submitLabel="Créer l'organisation">
            <fieldset className="grid grid-cols-2 gap-1 rounded-full border border-line bg-ink p-1">
              <legend className="sr-only">Type</legend>
              {(
                [
                  ["CLUB", "Club"],
                  ["ASSOCIATION", "Association"],
                ] as const
              ).map(([v, label], i) => (
                <label key={v} className="flex h-10 cursor-pointer items-center justify-center rounded-full text-[13px] font-extrabold has-checked:bg-accent has-checked:text-ink">
                  <input type="radio" name="type" value={v} defaultChecked={i === 0} className="sr-only" />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              Nom
              <input name="nom" required placeholder="Ex. : Club Astronomie" className={field} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              Sigle (facultatif)
              <input name="sigle" maxLength={6} className={field} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              Adresse Google du compte
              <input name="email" type="email" required placeholder="adresse@gmail.com" className={field} />
            </label>
            <span className="text-[13px] leading-relaxed text-muted">N&apos;importe quelle adresse Google. Le compte s&apos;active à la première connexion « Continuer avec Google ».</span>
          </AdminForm>
        </aside>
      </div>
    </>
  );
}
