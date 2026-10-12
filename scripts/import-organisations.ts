// Import des organisations (clubs et associations) à partir d'un fichier JSON préparé.
//
// Usage :
//   npx tsx scripts/import-organisations.ts <fichier.json>                          → simulation (rien n'est écrit)
//   npx tsx scripts/import-organisations.ts <fichier.json> --appliquer              → écrit dans la base de .env.local
//   npx tsx scripts/import-organisations.ts <fichier.json> --env .env.prod.local --appliquer   → base de production
//
// Pour chaque organisation : crée le compte (rôle ORGANISATION, actif à la première connexion Google)
// et la fiche publique, ou met à jour la fiche si l'organisation existe déjà (même adresse de compte).
// Idempotent : relancer le script ne crée pas de doublon. N'efface jamais rien.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "../src/server/db/schema";
import { slugify } from "../src/lib/dates";

const args = process.argv.slice(2);
const fichier = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--env");
const envFile = args.includes("--env") ? args[args.indexOf("--env") + 1] : ".env.local";
const appliquer = args.includes("--appliquer");
if (!fichier) throw new Error("Indique le fichier JSON à importer.");
config({ path: envFile, override: true, quiet: true });

const Org = z.object({
  type: z.enum(["CLUB", "ASSOCIATION"]),
  nom: z.string().trim().min(3).max(80),
  sigle: z.string().trim().max(8).nullable().optional(),
  email: z.string().trim().toLowerCase().email().nullable(),
  description: z.string().trim().max(2000).nullable().optional(),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  emailContact: z.string().trim().toLowerCase().email().nullable().optional(),
  telephoneContact: z.string().max(20).nullable().optional(),
  instagram: z.string().max(60).nullable().optional(),
  tiktok: z.string().max(60).nullable().optional(),
  linkedin: z.string().startsWith("https://").nullable().optional(),
  logoUrl: z.string().regex(/^(\/logos\/[a-z0-9-]+\.png|https:\/\/\S+)$/).nullable().optional(),
});

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`DATABASE_URL absent de ${envFile}`);
  const db = drizzle(neon(url), { schema: s });
  console.log(`Base cible : ${new URL(url).host} (${envFile})${appliquer ? "" : " — SIMULATION, rien n'est écrit"}\n`);

  const liste = z.array(Org.passthrough()).parse(JSON.parse(readFileSync(fichier!, "utf8")));
  const [admin] = await db.select({ id: s.compte.id }).from(s.compte).where(eq(s.compte.role, "ADMIN")).limit(1);
  let crees = 0, maj = 0, ignores = 0;

  for (const o of liste) {
    if (!o.email) {
      console.log(`⚠ ${o.nom} : adresse Google du club manquante, ignorée`);
      ignores++;
      continue;
    }
    const fiche = {
      type: o.type,
      nom: o.nom,
      sigle: o.sigle || null,
      description: o.description || null,
      couleur: o.couleur.toUpperCase(),
      emailContact: o.emailContact || null,
      telephoneContact: o.telephoneContact || null,
      instagram: o.instagram || null,
      tiktok: o.tiktok || null,
      linkedin: o.linkedin || null,
      logoUrl: o.logoUrl || null,
    };
    const [compte] = await db.select().from(s.compte).where(eq(s.compte.email, o.email)).limit(1);
    const [orgDuCompte] = compte ? await db.select().from(s.organisation).where(eq(s.organisation.idCompte, compte.id)).limit(1) : [];
    const [memeNom] = await db.select().from(s.organisation).where(eq(s.organisation.nom, o.nom)).limit(1);

    if (orgDuCompte) {
      if (memeNom && memeNom.id !== orgDuCompte.id) {
        console.log(`⚠ ${o.nom} : ce nom est déjà pris par une autre organisation, ignorée`);
        ignores++;
        continue;
      }
      console.log(`↻ ${o.nom} : fiche mise à jour`);
      if (appliquer) await db.update(s.organisation).set(fiche).where(eq(s.organisation.id, orgDuCompte.id));
      maj++;
      continue;
    }
    if (memeNom) {
      console.log(`⚠ ${o.nom} : une organisation de ce nom existe déjà avec un autre compte, ignorée`);
      ignores++;
      continue;
    }
    if (compte && compte.role !== "ORGANISATION" && compte.role !== "EXTERNE") {
      console.log(`⚠ ${o.nom} : l'adresse ${o.email} est déjà un compte ${compte.role}, ignorée`);
      ignores++;
      continue;
    }

    let slug = slugify(o.nom) || "organisation";
    const [slugPris] = await db.select({ id: s.organisation.id }).from(s.organisation).where(eq(s.organisation.slug, slug)).limit(1);
    if (slugPris) slug = `${slug}-${randomBytes(2).toString("hex")}`;
    console.log(`＋ ${o.nom} (${o.sigle ?? "—"}) · /clubs/${slug}${compte ? " · compte externe existant converti en compte d'organisation" : ""}`);
    if (appliquer) {
      // Sans transaction (pilote HTTP) : en cas d'échec entre les deux écritures, relancer le script suffit.
      let idCompte = compte?.id;
      if (compte) await db.update(s.compte).set({ role: "ORGANISATION" }).where(eq(s.compte.id, compte.id));
      else idCompte = (await db.insert(s.compte).values({ email: o.email, role: "ORGANISATION", idCreateur: admin?.id ?? null }).returning({ id: s.compte.id }))[0].id;
      await db.insert(s.organisation).values({ ...fiche, slug, idCompte: idCompte! });
    }
    crees++;
  }
  console.log(`\n${crees} à créer · ${maj} à mettre à jour · ${ignores} ignorée(s)${appliquer ? " — appliqué." : " — simulation : ajoute --appliquer pour écrire."}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
