import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { and, eq, inArray } from "drizzle-orm";
import { Icon } from "@/components/ui/Icon";
import { dayLabel, priceLabel, timeLabel } from "@/lib/format";
import { annulerInscription } from "@/server/actions/inscriptions";
import { getDb, schema as s } from "@/server/db";
import { requireUser } from "@/server/permissions";
import { getPersonne, listMyInscriptions } from "@/server/queries/moi";

export const metadata: Metadata = { title: "Mon billet" };

const STATUT: Record<string, { label: string; cls: string }> = {
  CONFIRMEE: { label: "Confirmé", cls: "bg-ink text-accent" },
  PRE_INSCRITE: { label: "Pré-inscrit · à payer", cls: "bg-ink text-amber" },
  LISTE_ATTENTE: { label: "Liste d'attente", cls: "bg-ink text-sky" },
};

export default async function Billet({ params }: PageProps<"/moi/billets/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/moi/billets/${id}`);
  const item = (await listMyInscriptions(user.id)).find((x) => x.ins.id === id);
  if (!item) notFound();
  const { ins, evt, creneaux, presences, tarif } = item;

  const db = getDb();
  const [personne, lieux, orgs] = await Promise.all([
    getPersonne(user.id),
    creneaux.length
      ? db
          .select({ idCreneau: s.creneauLieu.idCreneau, nom: s.lieu.nom, code: s.lieu.code, precision: s.creneauLieu.precision })
          .from(s.creneauLieu)
          .innerJoin(s.lieu, eq(s.lieu.id, s.creneauLieu.idLieu))
          .where(inArray(s.creneauLieu.idCreneau, creneaux.map((c) => c.id)))
      : [],
    db
      .select({ nom: s.organisation.nom, email: s.organisation.emailContact, instagram: s.organisation.instagram })
      .from(s.organisationEvenement)
      .innerJoin(s.organisation, eq(s.organisation.id, s.organisationEvenement.idOrganisation))
      .where(and(eq(s.organisationEvenement.idEvenement, evt.idParent ?? evt.id), eq(s.organisationEvenement.role, "PRINCIPAL"))),
  ]);

  const qr = await QRCode.toString(ins.tokenBillet, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0B0C12", light: "#FFFFFF" } });
  const annule = evt.statut === "ANNULE";
  const st = annule ? { label: "Événement annulé", cls: "bg-ink text-danger" } : (STATUT[ins.statut] ?? STATUT.CONFIRMEE);
  const nom = [personne?.prenom, personne?.nom].filter(Boolean).join(" ") || user.email;
  const contact = orgs[0];
  const code = ins.tokenBillet.slice(0, 4).toUpperCase() + "-" + ins.tokenBillet.slice(4, 8).toUpperCase();

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5">
      <Link href="/moi/billets" className="flex min-h-11 items-center gap-1.5 self-start text-sm font-bold text-muted">
        <Icon name="chevronLeft" stroke={2.4} /> Mes billets
      </Link>

      <div className="animate-rise overflow-hidden rounded-[30px] border border-line bg-surface shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]">
        <div className="relative overflow-hidden p-5 text-ink" style={{ background: evt.couleur }}>
          <span aria-hidden className="absolute -top-12 -right-10 size-36 rounded-full border-[20px] border-ink/10" />
          <div className="relative flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.12em] uppercase">Billet</span>
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${st.cls}`}>{st.label}</span>
          </div>
          <div className="relative mt-3.5 font-display text-[32px] leading-[0.95] font-extrabold tracking-tight">{evt.titre}</div>
        </div>

        <div aria-hidden className="relative flex h-6.5 items-center">
          <span className="absolute -left-3.5 size-7 rounded-full bg-ink" />
          <span className="mx-5.5 flex-1 border-t-2 border-dashed border-line-strong" />
          <span className="absolute -right-3.5 size-7 rounded-full bg-ink" />
        </div>

        <div className="flex flex-col items-center gap-3.5 px-5 pt-1.5 pb-5.5">
          {annule ? (
            <div className="flex w-[228px] flex-col items-center gap-2 rounded-[22px] border-[1.5px] border-dashed border-danger/60 px-4 py-8 text-center">
              <Icon name="x" size={28} stroke={2.6} className="text-danger" />
              <span className="font-extrabold">Événement annulé</span>
              <span className="text-[13px] text-muted">Ce billet n&apos;est plus valable.</span>
            </div>
          ) : (
            <div className="w-[228px] rounded-[22px] bg-white p-3.5" role="img" aria-label="QR code du billet" dangerouslySetInnerHTML={{ __html: qr }} />
          )}
          <div className="text-center">
            <div className="text-lg font-extrabold">{nom}</div>
            <div className="mt-1 text-[13px] tracking-[0.14em] text-muted tabular-nums">{code}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 text-xs font-bold">
            {ins.datePaiement && (
              <span className="rounded-full bg-surface-2 px-3 py-1.5">
                Payé · {priceLabel(Number(ins.montantPaye))}
                {tarif ? ` · ${tarif.libelle.toLowerCase()}` : ""}
              </span>
            )}
            <span className="rounded-full bg-surface-2 px-3 py-1.5">
              {creneaux.length} jour{creneaux.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <h2 className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Contrôle d&apos;entrée</h2>
        {creneaux.map((c, i) => {
          const done = presences.find((p) => p.idCreneau === c.id);
          const ls = lieux.filter((l) => l.idCreneau === c.id).map((l) => (l.code === "AUTRE" ? l.precision ?? "Autre" : l.nom));
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-[18px] border border-line bg-surface px-3.5 py-3">
              <span className={`grid size-9.5 flex-none place-items-center rounded-xl font-display font-extrabold ${done ? "bg-accent text-ink" : "border-2 border-dashed border-line-strong"}`}>
                {done ? <Icon name="check" stroke={3} /> : `J${i + 1}`}
              </span>
              <div className="flex-1">
                <div className="text-[15px] font-extrabold">
                  {dayLabel(c.debut)} · {timeLabel(c.debut)}
                </div>
                <div className="text-[13px] text-muted">{done ? `Entré à ${timeLabel(done.dateCheckin)}` : ls.join(", ") || "À scanner à l'entrée"}</div>
              </div>
            </div>
          );
        })}
      </div>

      {annule ? (
        <div className="flex gap-3 rounded-[22px] border border-line bg-surface p-4">
          <Icon name="alert" size={20} className="flex-none text-danger" />
          <div className="flex flex-col gap-1 text-sm leading-relaxed">
            <b>L&apos;événement est annulé</b>
            <span className="text-muted">
              {ins.datePaiement ? "Pour le remboursement, contacte l'organisation" : "Pour toute question, contacte l'organisation"}
              {contact ? ` ${contact.nom}${contact.email ? ` (${contact.email})` : ""}${contact.instagram ? ` · ${contact.instagram}` : ""}` : ""}.
            </span>
          </div>
        </div>
      ) : ins.datePaiement ? (
        <div className="flex gap-3 rounded-[22px] border border-line bg-surface p-4">
          <Icon name="alert" size={20} className="flex-none text-amber" />
          <div className="flex flex-col gap-1 text-sm leading-relaxed">
            <b>Besoin d&apos;annuler ?</b>
            <span className="text-muted">
              Ton inscription est payée : seul le club peut l&apos;annuler.
              {contact && ` Contacte ${contact.nom}${contact.email ? ` (${contact.email})` : ""}${contact.instagram ? ` · ${contact.instagram}` : ""}.`}
            </span>
          </div>
        </div>
      ) : (
        <form action={annulerInscription}>
          <input type="hidden" name="inscriptionId" value={ins.id} />
          <button type="submit" className="press h-12 w-full rounded-full border border-line-strong text-sm font-bold text-danger">
            Annuler mon inscription
          </button>
        </form>
      )}
      <p className="text-center text-xs text-faint">Ce billet reste disponible hors connexion une fois ouvert sur ce téléphone.</p>
    </section>
  );
}
