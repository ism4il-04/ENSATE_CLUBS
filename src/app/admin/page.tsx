import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, AdminForm } from "@/components/coord/AdminControls";
import { PageTitle } from "@/components/space/SpaceShell";
import { Icon } from "@/components/ui/Icon";
import { dayLabel } from "@/lib/format";
import { compteStatutAction, creerCompteAction } from "@/server/actions/admin";
import { getSessionUser } from "@/server/permissions";
import { listComptes } from "@/server/services/admin";

export const metadata: Metadata = { title: "Comptes" };

const ROLE: Record<string, { label: string; cls: string }> = {
  ADMIN: { label: "Admin", cls: "bg-paper text-ink" },
  COORDINATEUR: { label: "Coordinateur", cls: "bg-violet text-ink" },
  ORGANISATION: { label: "Organisation", cls: "bg-sky text-ink" },
  ETUDIANT: { label: "Étudiant", cls: "bg-surface-2 text-paper" },
  EXTERNE: { label: "Externe", cls: "bg-amber text-ink" },
};
const field = "h-12 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 font-semibold text-paper outline-none focus:border-accent";
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default async function Comptes({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const role = typeof sp.role === "string" ? sp.role : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const me = await getSessionUser();
  const all = await listComptes();
  const base = all.filter((r) => !q || norm(`${r.compte.email} ${r.prenom ?? ""} ${r.nom ?? ""} ${r.organisation ?? ""}`).includes(norm(q)));
  const list = base.filter((r) => !role || r.compte.role === role);
  const suspendus = all.filter((r) => r.compte.statut === "SUSPENDU").length;

  return (
    <>
      <PageTitle kicker={`${all.length} comptes · ${suspendus} suspendu${suspendus > 1 ? "s" : ""}`} title="Comptes" />
      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
          <div className="flex flex-wrap justify-between gap-2.5">
            <nav aria-label="Rôle" className="flex flex-wrap gap-1.5">
              {["", "ETUDIANT", "EXTERNE", "ORGANISATION", "COORDINATEUR", "ADMIN"].map((k) => {
                const p = new URLSearchParams({ ...(k ? { role: k } : {}), ...(q ? { q } : {}) });
                return (
                  <Link key={k || "all"} href={`/admin?${p}`} aria-current={role === k ? "true" : undefined} className={`press flex h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold ${role === k ? "border-paper bg-paper text-ink" : "border-line bg-surface"}`}>
                    {k ? ROLE[k].label : "Tous"}
                    <span className="font-extrabold opacity-70">{k ? base.filter((r) => r.compte.role === k).length : base.length}</span>
                  </Link>
                );
              })}
            </nav>
            <form action="/admin" className="flex h-11 w-full max-w-[250px] items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-muted">
              <Icon name="search" size={16} />
              <label htmlFor="q" className="sr-only">
                Rechercher un compte
              </label>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="Email ou nom…" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-paper outline-none" />
              {role && <input type="hidden" name="role" value={role} />}
            </form>
          </div>

          <div className="overflow-x-auto rounded-[22px] border border-line bg-surface">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wider text-muted uppercase">
                  {["Compte", "Rôle", "Créé", "Dernière connexion", "Statut", ""].map((h) => (
                    <th key={h} scope="col" className="px-3 py-3.5 font-extrabold first:pl-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(({ compte: c, prenom, nom, organisation }) => {
                  const actif = c.statut === "ACTIF";
                  const r = ROLE[c.role];
                  return (
                    <tr key={c.id} className={`border-t border-line transition-colors hover:bg-hover ${actif ? "" : "opacity-60"}`}>
                      <td className="py-3 pr-3 pl-4">
                        <div className="font-extrabold">{organisation ?? ([prenom, nom].filter(Boolean).join(" ") || "—")}</div>
                        <div className="text-[13px] text-muted">{c.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${r.cls}`}>{r.label}</span>
                      </td>
                      <td className="px-3 py-3 text-soft">{c.idCreateur ? "Par le staff" : "Auto-inscription"}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted">{c.derniereConnexion ? dayLabel(c.derniereConnexion) : "—"}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[13px] font-extrabold ${!actif ? "text-danger" : c.googleSub ? "text-accent" : "text-amber"}`}>
                          <span className="size-1.5 rounded-full bg-current" />
                          {!actif ? "Suspendu" : c.googleSub ? "Actif" : "Jamais connecté"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {c.id === me?.id ? (
                          <span className="text-[13px] text-faint">Vous</span>
                        ) : (
                          <ActionButton action={compteStatutAction.bind(null, c.id, !actif)} label={actif ? "Suspendre" : "Réactiver"} confirm={actif ? "Confirmer" : undefined} tone={actif ? "danger" : "accent"} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!list.length && <p className="p-7 text-center text-muted">Aucun compte ne correspond.</p>}
          </div>
        </section>

        <aside className="flex flex-[1_1_300px] flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-lg font-extrabold">Créer un compte</h2>
          <AdminForm action={creerCompteAction} submitLabel="Créer le compte">
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              Adresse Google
              <input name="email" type="email" required placeholder="prenom.nom@gmail.com" className={field} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                Prénom
                <input name="prenom" className={field} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                Nom
                <input name="nom" className={field} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              Rôle
              <select name="role" className={`${field} [color-scheme:dark]`}>
                <option value="COORDINATEUR">Coordinateur</option>
                <option value="ETUDIANT">Étudiant (invité, ex. adresse gmail)</option>
                <option value="EXTERNE">Externe</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </label>
            <p className="text-[13px] leading-relaxed text-muted">Tout domaine accepté. Le compte s&apos;active à la première connexion Google. Les comptes de clubs se créent dans « Organisations ».</p>
          </AdminForm>
          <p className="rounded-2xl border border-line bg-ink p-3.5 text-[13px] leading-relaxed text-muted">L&apos;administrateur gère les accès. Il n&apos;a aucun accès aux trésoreries des clubs.</p>
        </aside>
      </div>
    </>
  );
}
