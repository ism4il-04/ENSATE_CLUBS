// Données initiales : lieux de l'école, compte admin, et (option --demo) des données de démonstration.
// Usage : npm run db:seed            → lieux + admin
//         npm run db:seed -- --demo  → + organisations et événements fictifs (base de dev uniquement)
// Le script n'efface rien : il ajoute seulement ce qui manque.
import { readFileSync } from "node:fs";
import { config, parse } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import * as s from "../src/server/db/schema";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant dans .env.local");
  const db = drizzle(neon(url), { schema: s });
  const demo = process.argv.includes("--demo");
  // Les données de démo (comptes fictifs, dont un admin) ne vont jamais ailleurs que dans la base de .env.local :
  // une base passée en variable d'environnement (production) est refusée.
  if (demo) {
    let local: string | undefined;
    try {
      local = parse(readFileSync(".env.local")).DATABASE_URL;
    } catch {}
    if (!local || local !== url) throw new Error("--demo n'est autorisé que sur la base de développement de .env.local.");
  }
  console.log(`Base cible : ${new URL(url).host}${demo ? " (avec démo)" : ""}`);

  // ---- Lieux (docs/06 §7)
  const lieux: (typeof s.lieu.$inferInsert)[] = [];
  for (const [etage, codes] of [[0, ["001", "002", "003", "004", "005", "006"]], [1, ["101", "102", "103", "104", "105", "106"]], [2, ["201", "202", "203", "204", "205", "206"]]] as const)
    for (const code of codes) lieux.push({ code, nom: `Salle ${code}`, type: "SALLE", etage });
  lieux.push(
    { code: "AMPHI", nom: "Amphithéâtre", type: "AMPHI" },
    { code: "LECTURE", nom: "Salle de lecture", type: "SALLE_LECTURE" },
    { code: "ECOLE", nom: "Toute l'école", type: "ECOLE_ENTIERE" },
    { code: "AUTRE", nom: "Autre lieu (préciser)", type: "AUTRE" },
  );
  await db.insert(s.lieu).values(lieux).onConflictDoNothing();
  console.log(`✓ ${lieux.length} lieux`);

  // ---- Admin initial (s'active à sa première connexion Google)
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail) {
    await db.insert(s.compte).values({ email: adminEmail, role: "ADMIN" }).onConflictDoNothing();
    console.log(`✓ compte ADMIN pour ${adminEmail.replace(/(.).+(@.+)/, "$1…$2")}`);
  } else {
    console.log("! ADMIN_EMAIL absent : aucun compte admin créé");
  }
  if (!demo) return;

  // ---- Démo : comptes pour la connexion de démonstration (AUTH_DEV_LOGIN=1, local uniquement)
  const people = [
    { email: "etudiant.demo@etu.uae.ac.ma", role: "ETUDIANT" as const, prenom: "Yasmine", nom: "El Amrani", niveau: "GI2" },
    { email: "externe.demo@example.com", role: "EXTERNE" as const, prenom: "Karim", nom: "Bennani", niveau: null },
    { email: "coordination.demo@example.com", role: "COORDINATEUR" as const, prenom: "Coordination", nom: "Clubs", niveau: null },
    { email: "admin.demo@example.com", role: "ADMIN" as const, prenom: "Admin", nom: "ENSATE", niveau: null },
  ];
  const ids: Record<string, string> = {};
  for (const p of people) {
    await db.insert(s.compte).values({ email: p.email, role: p.role }).onConflictDoNothing();
    const [c] = await db.select().from(s.compte).where(eq(s.compte.email, p.email));
    ids[p.role] = c.id;
    await db.insert(s.personne).values({ idCompte: c.id, prenom: p.prenom, nom: p.nom, niveau: p.niveau }).onConflictDoNothing();
  }
  console.log(`✓ ${people.length} comptes de démonstration`);

  // ---- Démo : organisations + événements publiés
  const orgs = [
    { email: "club.info.demo@example.com", nom: "Club Informatique", sigle: "CI", slug: "club-informatique", type: "CLUB" as const, couleur: "#C6F24E", description: "Programmation, IA, hackathons et entraide." },
    { email: "club.robot.demo@example.com", nom: "Club Robotique", sigle: "CR", slug: "club-robotique", type: "CLUB" as const, couleur: "#7CC8FF", description: "Robots, électronique et compétitions." },
    { email: "asso.etu.demo@example.com", nom: "Association des étudiants", sigle: "AE", slug: "association-etudiants", type: "ASSOCIATION" as const, couleur: "#FF8CC6", description: "Intégration, soirées et grands événements." },
  ];
  const orgIds: Record<string, string> = {};
  for (const o of orgs) {
    const [c] = await db.insert(s.compte).values({ email: o.email, role: "ORGANISATION" }).onConflictDoNothing().returning();
    const compteId = c?.id ?? (await db.select().from(s.compte).where(eq(s.compte.email, o.email)))[0].id;
    const [org] = await db
      .insert(s.organisation)
      .values({ nom: o.nom, sigle: o.sigle, slug: o.slug, type: o.type, couleur: o.couleur, description: o.description, idCompte: compteId })
      .onConflictDoNothing()
      .returning();
    orgIds[o.slug] = org?.id ?? (await db.select().from(s.organisation).where(eq(s.organisation.slug, o.slug)))[0].id;
  }
  const createur = (await db.select().from(s.compte).where(eq(s.compte.email, orgs[0].email)))[0].id;
  const allLieux = await db.select().from(s.lieu);
  const L = (code: string) => allLieux.find((l) => l.code === code)!.id;

  const day = (offset: number, h: number, m = 0) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    d.setUTCHours(h - 1, m, 0, 0); // Africa/Casablanca = UTC+1
    return d;
  };

  type Demo = {
    slug: string; titre: string; categorie: (typeof s.categorieEvenement.enumValues)[number]; couleur: string;
    orgs: [string, "PRINCIPAL" | "PARTENAIRE"][]; creneaux: [number, number, number, string[]][];
    gratuit: boolean; tarifs?: [string, number, boolean][]; capacite: number | null; placesMembres?: number;
    ouvertExternes?: boolean; telephoneRequis?: boolean; mode?: "EN_LIGNE" | "STAND"; liste?: boolean;
  };
  const events: Demo[] = [
    { slug: "hackathon-ia-24h", titre: "Hackathon IA 24h", categorie: "COMPETITION", couleur: "#B79CFF", orgs: [["club-informatique", "PRINCIPAL"], ["club-robotique", "PARTENAIRE"]], creneaux: [[13, 9, 23, ["AMPHI", "101", "102"]], [14, 8, 14, ["AMPHI"]]], gratuit: false, tarifs: [["Adhérent", 30, true], ["Non-adhérent", 50, true], ["Externe", 80, true], ["Bureau", 0, false]], capacite: 120, placesMembres: 20, ouvertExternes: true, telephoneRequis: true },
    { slug: "conference-transition-energetique", titre: "Transition énergétique", categorie: "CONFERENCE", couleur: "#7CC8FF", orgs: [["club-informatique", "PRINCIPAL"]], creneaux: [[9, 14, 16, ["AMPHI"]]], gratuit: true, capacite: 200, ouvertExternes: true, liste: true },
    { slug: "soiree-integration", titre: "Soirée d'intégration", categorie: "SOIREE", couleur: "#FF8CC6", orgs: [["association-etudiants", "PRINCIPAL"]], creneaux: [[19, 20, 23, ["ECOLE"]]], gratuit: false, tarifs: [["Adhérent", 60, true], ["Non-adhérent", 80, true]], capacite: 300, mode: "STAND" },
    { slug: "initiation-arduino", titre: "Initiation Arduino", categorie: "FORMATION", couleur: "#FF8A65", orgs: [["club-robotique", "PRINCIPAL"]], creneaux: [[15, 17, 19, ["204"]], [16, 17, 19, ["204"]], [17, 17, 19, ["204"]]], gratuit: false, tarifs: [["Adhérent", 0, true], ["Non-adhérent", 30, true]], capacite: 30 },
  ];

  for (const e of events) {
    const exists = await db.select({ id: s.evenement.id }).from(s.evenement).where(eq(s.evenement.slug, e.slug));
    if (exists.length) continue;
    const [evt] = await db
      .insert(s.evenement)
      .values({
        structure: "SIMPLE", titre: e.titre, slug: e.slug, categorie: e.categorie, couleur: e.couleur,
        descriptionCourte: `${e.titre} — événement de démonstration.`,
        description: "Description de démonstration : programme, intervenants et informations pratiques seront publiés par le club.",
        capacite: e.capacite, placesMembres: e.placesMembres ?? 0, gratuit: e.gratuit, ouvertExternes: e.ouvertExternes ?? false,
        telephoneRequis: e.telephoneRequis ?? false, modeInscription: e.mode ?? "EN_LIGNE", inscriptionsOuvertes: true,
        listeAttenteActive: e.liste ?? false, statut: "PUBLIE", idCreateur: createur,
      })
      .returning();
    await db.insert(s.organisationEvenement).values(e.orgs.map(([slug, role]) => ({ idEvenement: evt.id, idOrganisation: orgIds[slug], role })));
    for (const [off, h1, h2, codes] of e.creneaux) {
      const [c] = await db.insert(s.creneau).values({ idEvenement: evt.id, debut: day(off, h1), fin: day(off, h2) }).returning();
      await db.insert(s.creneauLieu).values(codes.map((code) => ({ idCreneau: c.id, idLieu: L(code) })));
    }
    if (e.tarifs)
      await db.insert(s.tarif).values(e.tarifs.map(([libelle, prix, affiche], i) => ({ idEvenement: evt.id, libelle, prix: String(prix), affiche, ordre: i })));
    console.log(`✓ événement ${e.titre}`);
  }

  // ---- Démo : une demande en attente pour le coordinateur
  if (!(await db.select({ id: s.evenement.id }).from(s.evenement).where(eq(s.evenement.slug, "atelier-git-github"))).length) {
    const [evt] = await db
      .insert(s.evenement)
      .values({
        structure: "SIMPLE", titre: "Atelier Git & GitHub", slug: "atelier-git-github", categorie: "ATELIER", couleur: "#C6F24E",
        descriptionCourte: "Versionner ses projets et collaborer.", gratuit: true, capacite: 40,
        modeInscription: "EN_LIGNE", statut: "EN_ATTENTE", idCreateur: createur,
      })
      .returning();
    await db.insert(s.organisationEvenement).values({ idEvenement: evt.id, idOrganisation: orgIds["club-informatique"], role: "PRINCIPAL" });
    const [c] = await db.insert(s.creneau).values({ idEvenement: evt.id, debut: day(9, 15), fin: day(9, 17) }).returning();
    await db.insert(s.creneauLieu).values({ idCreneau: c.id, idLieu: L("AMPHI") });
    console.log("✓ demande en attente : Atelier Git & GitHub");
  }

  // ---- Démo : billets de l'étudiant (un payé, un gratuit) et une pré-inscription externe
  const bySlug = async (slug: string) => (await db.select().from(s.evenement).where(eq(s.evenement.slug, slug)))[0];
  const hack = await bySlug("hackathon-ia-24h");
  const conf = await bySlug("conference-transition-energetique");
  const [tarifNA] = await db.select().from(s.tarif).where(eq(s.tarif.idEvenement, hack.id)).then((r) => r.filter((t) => t.libelle === "Non-adhérent"));
  const token = () => randomBytes(32).toString("base64url");
  await db
    .insert(s.inscription)
    .values([
      { idEvenement: hack.id, idCompte: ids.ETUDIANT, statut: "CONFIRMEE", source: "STAND", tokenBillet: token(), idTarif: tarifNA.id, montantPaye: tarifNA.prix, datePaiement: new Date(), idOrganisationEncaisse: orgIds["club-informatique"] },
      { idEvenement: conf.id, idCompte: ids.ETUDIANT, statut: "CONFIRMEE", source: "EN_LIGNE", tokenBillet: token() },
      { idEvenement: hack.id, idCompte: ids.EXTERNE, statut: "PRE_INSCRITE", source: "EN_LIGNE", tokenBillet: token() },
    ])
    .onConflictDoNothing();
  console.log("✓ inscriptions de démonstration");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
