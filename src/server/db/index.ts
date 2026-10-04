import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let instance: NeonHttpDatabase<typeof schema> | null = null;

// Pilote HTTP : pas de pool de connexions à épuiser depuis les fonctions serverless.
// Création paresseuse : le build ne touche pas la base.
export function getDb() {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL manquant : voir .env.example");
    instance = drizzle(neon(url), { schema });
  }
  return instance;
}

export { schema };
