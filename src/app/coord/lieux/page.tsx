import type { Metadata } from "next";
import { ActionButton, AdminForm } from "@/components/coord/AdminControls";
import { PageTitle } from "@/components/space/SpaceShell";
import { creerLieuAction, lieuActifAction } from "@/server/actions/admin";
import { listLieuxAdmin } from "@/server/services/admin";
import { requirePageRole } from "@/server/permissions";

export const metadata: Metadata = { title: "Lieux" };

const field = "h-11.5 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3 font-semibold text-paper outline-none focus:border-accent";
const TYPES = [
  ["SALLE", "Salle"],
  ["AMPHI", "Amphithéâtre"],
  ["SALLE_LECTURE", "Salle de lecture"],
  ["ECOLE_ENTIERE", "Toute l'école"],
  ["AUTRE", "Autre"],
] as const;

export default async function Lieux() {
  await requirePageRole("/coord/lieux", "COORDINATEUR", "ADMIN");
  const lieux = await listLieuxAdmin();
  const groups = [
    ["Rez-de-chaussée", lieux.filter((l) => l.type === "SALLE" && l.etage === 0)],
    ["1er étage", lieux.filter((l) => l.type === "SALLE" && l.etage === 1)],
    ["2e étage", lieux.filter((l) => l.type === "SALLE" && l.etage === 2)],
    ["Autres salles", lieux.filter((l) => l.type === "SALLE" && (l.etage === null || l.etage > 2 || l.etage < 0))],
    ["Espaces", lieux.filter((l) => l.type !== "SALLE")],
  ] as const;

  return (
    <>
      <PageTitle kicker={`${lieux.filter((l) => l.actif).length} lieux actifs sur ${lieux.length}`} title="Lieux" />
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5.5">
          {groups
            .filter(([, items]) => items.length)
            .map(([label, items]) => (
              <section key={label} className="flex flex-col gap-2.5">
                <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">{label}</h2>
                <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr))]">
                  {items.map((l) => (
                    <article key={l.id} className={`flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-3.5 transition-transform hover:-translate-y-0.5 ${l.actif ? "" : "opacity-55"}`}>
                      <span className={`font-display leading-none font-extrabold tracking-tight ${l.code.length > 4 ? "text-xl" : "text-3xl"}`}>{l.code}</span>
                      <span className="text-[13px] text-muted">
                        {l.nom}
                        {l.capacite ? ` · ${l.capacite} places` : ""}
                      </span>
                      <ActionButton action={lieuActifAction.bind(null, l.id, !l.actif)} label={l.actif ? "Désactiver" : "Réactiver"} tone={l.actif ? "ghost" : "accent"} />
                    </article>
                  ))}
                </div>
              </section>
            ))}
        </div>
        <aside className="flex flex-[1_1_300px] flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-lg font-extrabold">Ajouter un lieu</h2>
          <AdminForm action={creerLieuAction} submitLabel="Ajouter le lieu">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                Code
                <input name="code" required placeholder="301" className={field} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                Capacité
                <input name="capacite" type="number" min={1} placeholder="Facultatif" className={field} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              Nom
              <input name="nom" required placeholder="Salle 301 ou Terrain de basket" className={field} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                Type
                <select name="type" className={`${field} [color-scheme:dark]`}>
                  {TYPES.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                Étage
                <input name="etage" type="number" min={-2} max={10} placeholder="—" className={field} />
              </label>
            </div>
            <p className="text-[13px] leading-relaxed text-faint">Un lieu désactivé n&apos;est plus proposé aux clubs mais reste visible dans les événements passés.</p>
          </AdminForm>
        </aside>
      </div>
    </>
  );
}
