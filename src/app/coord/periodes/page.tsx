import type { Metadata } from "next";
import { ActionButton, AdminForm } from "@/components/coord/AdminControls";
import { PageTitle } from "@/components/space/SpaceShell";
import { creerPeriodeAction, supprimerPeriodeAction } from "@/server/actions/admin";
import { requirePageRole } from "@/server/permissions";
import { periodesActives } from "@/server/services/periodes";

export const metadata: Metadata = { title: "Périodes bloquées" };

const field = "h-12 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 font-semibold text-paper outline-none focus:border-accent [color-scheme:dark]";
const fr = (d: string) => d.split("-").reverse().join("/");

/** BF-67 : examens, vacances… Les clubs ne peuvent pas soumettre de créneau dans ces périodes. */
export default async function Periodes() {
  await requirePageRole("/coord/periodes", "COORDINATEUR", "ADMIN");
  const periodes = await periodesActives();

  return (
    <>
      <PageTitle kicker="En cours et à venir" title="Périodes bloquées" />
      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[999_1_480px] flex-col gap-2.5">
          {periodes.map((p) => (
            <article key={p.id} className="flex flex-wrap items-center gap-3 rounded-[22px] border border-line bg-surface p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-extrabold">{p.libelle}</span>
                <span className="text-[13px] text-muted">
                  du {fr(p.debut)} au {fr(p.fin)}
                  {p.motif ? ` · ${p.motif}` : ""}
                </span>
              </div>
              <ActionButton action={supprimerPeriodeAction.bind(null, p.id)} label="Supprimer" confirm="Confirmer" tone="danger" />
            </article>
          ))}
          {!periodes.length && <p className="text-muted">Aucune période bloquée à venir.</p>}
          <p className="text-[13px] leading-relaxed text-faint">
            Un club voit l&apos;avertissement en choisissant sa date et ne peut pas soumettre une demande pendant ces périodes. Toi, tu peux toujours créer ou valider un événement : tu es seulement averti.
          </p>
        </section>

        <aside className="flex flex-[1_1_300px] flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-lg font-extrabold">Nouvelle période</h2>
          <AdminForm action={creerPeriodeAction} submitLabel="Bloquer la période" pendingLabel="Enregistrement…">
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              Nom
              <input name="libelle" required minLength={3} maxLength={60} placeholder="Ex. : Examens du semestre 1" className={field} />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                Du
                <input name="debut" type="date" required className={field} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                Au
                <input name="fin" type="date" required className={field} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
              Motif (facultatif)
              <input name="motif" maxLength={200} className={field} />
            </label>
          </AdminForm>
        </aside>
      </div>
    </>
  );
}
