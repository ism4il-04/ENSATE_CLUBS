import "server-only";
import { after } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { LIEU_LABEL, dayLabel, priceLabel, timeLabel } from "@/lib/format";
import { getDb, schema as s } from "@/server/db";
import { compose, type Message } from "./layout";
import { sendEmails, type Email } from "./send";

// Emails transactionnels (docs/03). Chaque fonction relit la base pour avoir l'état après la transaction,
// et ne reçoit que des identifiants : rien de sensible ne transite par les actions.

/**
 * Planifie l'envoi après la réponse (l'utilisateur n'attend pas l'email, et un échec n'annule rien).
 * Hors requête (scripts), l'envoi se fait tout de suite.
 */
export function notify(job: () => Promise<void>) {
  const run = () => job().catch((e) => console.error("[email] notification en échec", e));
  try {
    after(run);
  } catch {
    void run();
  }
}

type Evt = typeof s.evenement.$inferSelect;

async function eventContext(eventId: string) {
  const db = getDb();
  const [evt] = await db.select().from(s.evenement).where(eq(s.evenement.id, eventId)).limit(1);
  if (!evt) return null;
  const [parent] = evt.idParent ? await db.select().from(s.evenement).where(eq(s.evenement.id, evt.idParent)).limit(1) : [];
  const rootId = parent?.id ?? evt.id;
  const [creneaux, orgs] = await Promise.all([
    db.select().from(s.creneau).where(eq(s.creneau.idEvenement, evt.id)).orderBy(asc(s.creneau.debut)),
    db
      .select({ id: s.organisation.id, nom: s.organisation.nom, couleur: s.organisation.couleur, emailContact: s.organisation.emailContact, telephone: s.organisation.telephoneContact, instagram: s.organisation.instagram, role: s.organisationEvenement.role, email: s.compte.email })
      .from(s.organisationEvenement)
      .innerJoin(s.organisation, eq(s.organisation.id, s.organisationEvenement.idOrganisation))
      .innerJoin(s.compte, eq(s.compte.id, s.organisation.idCompte))
      .where(eq(s.organisationEvenement.idEvenement, rootId)),
  ]);
  const lieux = creneaux.length
    ? await db
        .select({ idCreneau: s.creneauLieu.idCreneau, code: s.lieu.code, nom: s.lieu.nom, precision: s.creneauLieu.precision })
        .from(s.creneauLieu)
        .innerJoin(s.lieu, eq(s.lieu.id, s.creneauLieu.idLieu))
        .where(inArray(s.creneauLieu.idCreneau, creneaux.map((c) => c.id)))
    : [];
  const titre = parent ? `${parent.titre} — ${evt.titre}` : evt.titre;
  const principal = orgs.find((o) => o.role === "PRINCIPAL") ?? null;
  const quand: [string, string][] = creneaux.map((c, i) => [
    creneaux.length > 1 ? `Jour ${i + 1}` : "Quand",
    `${dayLabel(c.debut)} · ${timeLabel(c.debut)} – ${timeLabel(c.fin)} · ${lieux
      .filter((l) => l.idCreneau === c.id)
      .map((l) => LIEU_LABEL(l.code, l.nom, l.precision))
      .join(", ")}`,
  ]);
  const contact = principal ? [principal.emailContact, principal.telephone, principal.instagram].filter(Boolean).join(" · ") : "";
  return { evt, parent: parent ?? null, rootId, titre, orgs, principal, quand, contact };
}

async function inscriptionContext(inscriptionId: string) {
  const [row] = await getDb()
    .select({ ins: s.inscription, email: s.compte.email, prenom: s.personne.prenom })
    .from(s.inscription)
    .innerJoin(s.compte, eq(s.compte.id, s.inscription.idCompte))
    .leftJoin(s.personne, eq(s.personne.idCompte, s.inscription.idCompte))
    .where(eq(s.inscription.id, inscriptionId))
    .limit(1);
  if (!row) return null;
  const ctx = await eventContext(row.ins.idEvenement);
  return ctx ? { ...row, ...ctx } : null;
}

const hello = (prenom: string | null | undefined) => (prenom ? `Bonjour ${prenom},` : "Bonjour,");
const billet = (id: string) => ({ label: "Voir mon billet", path: `/moi/billets/${id}` });
const send = (emails: (Email | null)[]) => sendEmails(emails.filter((e): e is Email => e !== null));

async function coordinateurs() {
  return getDb()
    .select({ email: s.compte.email })
    .from(s.compte)
    .where(and(eq(s.compte.role, "COORDINATEUR"), eq(s.compte.statut, "ACTIF")));
}

/** Inscrits actifs d'un événement et de ses activités. */
async function inscrits(evt: Evt, statuts: ("CONFIRMEE" | "PRE_INSCRITE" | "LISTE_ATTENTE")[]) {
  const db = getDb();
  const subs = await db.select({ id: s.evenement.id }).from(s.evenement).where(eq(s.evenement.idParent, evt.id));
  return db
    .select({ id: s.inscription.id, email: s.compte.email, prenom: s.personne.prenom, statut: s.inscription.statut, paye: s.inscription.datePaiement })
    .from(s.inscription)
    .innerJoin(s.compte, eq(s.compte.id, s.inscription.idCompte))
    .leftJoin(s.personne, eq(s.personne.idCompte, s.inscription.idCompte))
    .where(and(inArray(s.inscription.idEvenement, [evt.id, ...subs.map((x) => x.id)]), inArray(s.inscription.statut, statuts)));
}

// ------------------------------------------------------------------ côté organisations

/** Demande soumise : le coordinateur est prévenu, les partenaires sont informés (RG-04). */
export async function demandeSoumise(eventId: string) {
  const c = await eventContext(eventId);
  if (!c) return;
  const coords = await coordinateurs();
  const club = c.principal?.nom ?? "Un club";
  await send([
    ...coords.map((r) =>
      compose(r.email, {
        subject: `Nouvelle demande : ${c.titre}`,
        title: "Une nouvelle demande attend ta décision",
        lines: [`${club} demande à organiser « ${c.titre} ».`],
        details: c.quand,
        cta: { label: "Examiner la demande", path: `/coord?id=${eventId}` },
      }),
    ),
    ...partenaires(c, `${club} a soumis la demande au coordinateur des clubs.`),
  ]);
}

/** Événement créé et validé directement par le coordinateur pour un club. */
export async function creeParCoordinateur(eventId: string) {
  const c = await eventContext(eventId);
  if (!c?.principal) return;
  await send([
    compose(c.principal.email, {
      subject: `Événement validé : ${c.titre}`,
      title: "Le coordinateur a créé un événement pour ton club",
      lines: [`« ${c.titre} » est déjà validé. Complète la description, les tarifs et les places, puis publie-le.`],
      details: c.quand,
      cta: { label: "Compléter et publier", path: `/org/evenements/${eventId}/publication` },
      accent: c.principal.couleur,
    }),
    ...partenaires(c, "Il a été créé et validé par le coordinateur des clubs."),
  ]);
}

function partenaires(c: NonNullable<Awaited<ReturnType<typeof eventContext>>>, contexte: string) {
  return c.orgs
    .filter((o) => o.role === "PARTENAIRE")
    .map((o) =>
      compose(o.email, {
        subject: `Partenariat : ${c.titre}`,
        title: `${o.nom} est partenaire d'un événement`,
        lines: [`${c.principal?.nom ?? "Un club"} t'a ajouté comme organisation partenaire de « ${c.titre} ». ${contexte}`, "Une fois l'événement publié, tu pourras voir les inscrits, encaisser et contrôler les entrées depuis ton espace."],
        details: c.quand,
        cta: { label: "Ouvrir mon espace", path: "/org" },
        accent: o.couleur,
      }),
    );
}

const DECISION: Record<"VALIDE" | "REFUSE" | "MODIF_DEMANDEE", { subject: string; title: string; line: string; cta: (id: string) => { label: string; path: string } }> = {
  VALIDE: {
    subject: "Demande validée",
    title: "Ta demande est validée",
    line: "Tu peux maintenant compléter la description, l'affiche, les tarifs et les places, puis publier l'événement.",
    cta: (id) => ({ label: "Compléter et publier", path: `/org/evenements/${id}/publication` }),
  },
  MODIF_DEMANDEE: {
    subject: "Modification demandée",
    title: "Le coordinateur demande une modification",
    line: "Modifie ta demande en tenant compte du commentaire ci-dessous, puis soumets-la à nouveau.",
    cta: (id) => ({ label: "Modifier la demande", path: `/org/evenements/${id}/demande` }),
  },
  REFUSE: {
    subject: "Demande refusée",
    title: "Ta demande a été refusée",
    line: "Le motif est indiqué ci-dessous. Tu peux en parler avec le coordinateur des clubs ou proposer une autre date.",
    cta: () => ({ label: "Ouvrir mon espace", path: "/org" }),
  },
};

/** Décision du coordinateur → organisation principale. */
export async function decisionRendue(eventId: string, decision: keyof typeof DECISION, commentaire: string) {
  const c = await eventContext(eventId);
  if (!c?.principal) return;
  const d = DECISION[decision];
  await send([
    compose(c.principal.email, {
      subject: `${d.subject} : ${c.titre}`,
      title: d.title,
      lines: [`« ${c.titre} »`, d.line, ...(commentaire.trim() ? [`Commentaire du coordinateur : « ${commentaire.trim()} »`] : [])],
      details: c.quand,
      cta: d.cta(eventId),
      accent: c.principal.couleur,
    }),
  ]);
}

// ------------------------------------------------------------------ côté participants

/** Inscription en ligne (ou au stand pour un événement gratuit). */
export async function inscriptionEnregistree(inscriptionId: string) {
  const c = await inscriptionContext(inscriptionId);
  if (!c) return;
  const { ins } = c;
  if (ins.source === "STAND" && ins.statut === "PRE_INSCRITE") return; // le club encaisse juste après : l'email de paiement suffit
  const base = { details: c.quand, cta: billet(ins.id), accent: c.evt.couleur };
  const m: Record<string, Message> = {
    CONFIRMEE: {
      ...base,
      subject: `Place confirmée : ${c.titre}`,
      title: "Ta place est confirmée",
      lines: [hello(c.prenom), `Tu es inscrit à « ${c.titre} ». Présente le QR code de ton billet à l'entrée.`],
      note: "Ouvre ton billet une fois connecté : il reste ensuite disponible sur ton téléphone, même sans connexion.",
    },
    PRE_INSCRITE: {
      ...base,
      subject: `Pré-inscription : ${c.titre}`,
      title: "Pré-inscription enregistrée : passe au stand pour payer",
      lines: [hello(c.prenom), `Ta pré-inscription à « ${c.titre} » est enregistrée. Ta place n'est réservée qu'une fois le paiement fait au stand de ${c.principal?.nom ?? "l'organisation"}.`, "Le club choisit ton tarif au moment du paiement."],
      note: "Tant que tu n'as pas payé, tu peux annuler depuis ton billet.",
    },
    LISTE_ATTENTE: {
      ...base,
      subject: `Liste d'attente : ${c.titre}`,
      title: "Tu es sur liste d'attente",
      lines: [hello(c.prenom), `« ${c.titre} » est complet pour le moment. Si une place se libère, tu es inscrit automatiquement et tu reçois un email.`],
    },
  };
  const msg = m[ins.statut];
  if (msg) await send([compose(c.email, msg)]);
}

/** Paiement encaissé : la place est confirmée. Le montant n'est envoyé qu'au participant lui-même. */
export async function paiementEnregistre(inscriptionId: string) {
  const c = await inscriptionContext(inscriptionId);
  if (!c || c.ins.statut !== "CONFIRMEE") return;
  const [tarif] = c.ins.idTarif ? await getDb().select().from(s.tarif).where(eq(s.tarif.id, c.ins.idTarif)).limit(1) : [];
  await send([
    compose(c.email, {
      subject: `Paiement reçu : ${c.titre}`,
      title: "Paiement reçu, ta place est confirmée",
      lines: [hello(c.prenom), `Ton paiement pour « ${c.titre} » est enregistré. Présente le QR code de ton billet à l'entrée.`],
      details: [...(tarif ? ([["Tarif", `${tarif.libelle} · ${priceLabel(Number(c.ins.montantPaye ?? tarif.prix))}`]] as [string, string][]) : []), ...c.quand],
      cta: billet(c.ins.id),
      accent: c.evt.couleur,
      note: "Après paiement, l'annulation se fait auprès du club.",
    }),
  ]);
}

/** Place libérée : le premier de la liste d'attente est inscrit (RG-25). */
export async function promotionListeAttente(inscriptionId: string) {
  const c = await inscriptionContext(inscriptionId);
  if (!c || c.ins.statut !== "CONFIRMEE") return;
  await send([
    compose(c.email, {
      subject: `Une place s'est libérée : ${c.titre}`,
      title: "Bonne nouvelle : tu as une place",
      lines: [hello(c.prenom), `Une place s'est libérée pour « ${c.titre} » : tu passes de la liste d'attente aux inscrits confirmés.`, "Si tu ne peux plus venir, annule depuis ton billet pour laisser la place au suivant."],
      details: c.quand,
      cta: billet(c.ins.id),
      accent: c.evt.couleur,
    }),
  ]);
}

/** Place membre attribuée par le club (RG-29). */
export async function placeMembreAttribuee(eventId: string, compteId: string) {
  const [row] = await getDb()
    .select({ id: s.inscription.id })
    .from(s.inscription)
    .where(and(eq(s.inscription.idEvenement, eventId), eq(s.inscription.idCompte, compteId), eq(s.inscription.statut, "CONFIRMEE")))
    .limit(1);
  const c = row ? await inscriptionContext(row.id) : null;
  if (!c) return;
  await send([
    compose(c.email, {
      subject: `Place membre : ${c.titre}`,
      title: "Une place membre t'a été attribuée",
      lines: [hello(c.prenom), `${c.principal?.nom ?? "Le club"} t'a attribué une place membre pour « ${c.titre} ». Ton billet est prêt.`],
      details: c.quand,
      cta: billet(c.ins.id),
      accent: c.evt.couleur,
    }),
  ]);
}

/** Inscription annulée par l'organisation. */
export async function inscriptionAnnuleeParClub(inscriptionId: string) {
  const c = await inscriptionContext(inscriptionId);
  if (!c || c.ins.statut !== "ANNULEE") return;
  await send([
    compose(c.email, {
      subject: `Inscription annulée : ${c.titre}`,
      title: "Ton inscription a été annulée",
      lines: [hello(c.prenom), `${c.principal?.nom ?? "L'organisation"} a annulé ton inscription à « ${c.titre} ».`, ...(c.contact ? [`Pour toute question : ${c.contact}.`] : [])],
      cta: { label: "Voir l'événement", path: `/evenements/${(c.parent ?? c.evt).slug}` },
      accent: c.evt.couleur,
    }),
  ]);
}

/** Toutes les places publiques sont payées : les pré-inscrits restants sont prévenus (RG-26). */
export async function evenementComplet(eventId: string) {
  const c = await eventContext(eventId);
  if (!c) return;
  const list = await inscrits(c.evt, ["PRE_INSCRITE"]);
  await send(
    list.map((r) =>
      compose(r.email, {
        subject: `Complet : ${c.titre}`,
        title: "L'événement est complet",
        lines: [hello(r.prenom), `Toutes les places de « ${c.titre} » ont été payées. Ta pré-inscription ne te garantit plus de place.`, "Si quelqu'un se désiste, le club pourra encore t'encaisser au stand."],
        cta: billet(r.id),
        accent: c.evt.couleur,
      }),
    ),
  );
}

/** Créneaux modifiés par le coordinateur (RG-08) : inscrits et organisateurs. */
export async function creneauxModifies(eventId: string) {
  const c = await eventContext(eventId);
  if (!c) return;
  const list = c.evt.statut === "PUBLIE" ? await inscrits(c.evt, ["CONFIRMEE", "PRE_INSCRITE", "LISTE_ATTENTE"]) : [];
  await send([
    ...list.map((r) =>
      compose(r.email, {
        subject: `Changement d'horaire : ${c.titre}`,
        title: "Les dates ou les lieux ont changé",
        lines: [hello(r.prenom), `Le programme de « ${c.titre} » a été modifié. Voici les nouveaux créneaux.`],
        details: c.quand,
        cta: billet(r.id),
        accent: c.evt.couleur,
      }),
    ),
    ...c.orgs.map((o) =>
      compose(o.email, {
        subject: `Créneaux modifiés : ${c.titre}`,
        title: "Le coordinateur a modifié les créneaux",
        lines: [`Les créneaux de « ${c.titre} » ont été modifiés par le coordinateur des clubs.${list.length ? ` Les ${list.length} inscrits ont été prévenus par email.` : ""}`],
        details: c.quand,
        cta: { label: "Ouvrir mon espace", path: "/org" },
        accent: o.couleur,
      }),
    ),
  ]);
}

/** Événement annulé (BF-42) : inscrits, et organisations quand c'est le coordinateur qui annule. */
export async function evenementAnnule(eventId: string, motif: string, parCoordinateur: boolean) {
  const c = await eventContext(eventId);
  if (!c) return;
  const list = await inscrits(c.evt, ["CONFIRMEE", "PRE_INSCRITE", "LISTE_ATTENTE"]);
  const raison = motif.trim() ? [`Motif : « ${motif.trim()} »`] : [];
  await send([
    ...list.map((r) =>
      compose(r.email, {
        subject: `Événement annulé : ${c.titre}`,
        title: "L'événement est annulé",
        lines: [
          hello(r.prenom),
          `« ${c.titre} » est annulé.`,
          ...raison,
          ...(r.paye ? [`Tu avais payé ta place : pour le remboursement, contacte ${c.principal?.nom ?? "l'organisation"}${c.contact ? ` (${c.contact})` : ""}.`] : []),
        ],
        details: c.quand,
        accent: c.evt.couleur,
      }),
    ),
    ...(parCoordinateur
      ? c.orgs.map((o) =>
          compose(o.email, {
            subject: `Événement annulé : ${c.titre}`,
            title: "Le coordinateur a annulé un événement",
            lines: [`« ${c.titre} » a été annulé par le coordinateur des clubs.`, ...raison, ...(list.length ? [`Les ${list.length} inscrits ont été prévenus par email.`] : [])],
            cta: { label: "Ouvrir mon espace", path: "/org" },
            accent: o.couleur,
          }),
        )
      : c.orgs
          .filter((o) => o.role === "PARTENAIRE")
          .map((o) =>
            compose(o.email, {
              subject: `Événement annulé : ${c.titre}`,
              title: "Un événement partenaire est annulé",
              lines: [`${c.principal?.nom ?? "L'organisation principale"} a annulé « ${c.titre} ».`, ...raison],
              cta: { label: "Ouvrir mon espace", path: "/org" },
              accent: o.couleur,
            }),
          )),
  ]);
}

