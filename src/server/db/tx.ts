import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type Tx = Parameters<Parameters<NeonDatabase<typeof schema>["transaction"]>[0]>[0];

/**
 * Transaction interactive (WebSocket) pour les opérations qui doivent verrouiller
 * une ligne : inscriptions, paiements, promotions de liste d'attente (RG-13, BNF-03).
 * Le pilote HTTP (getDb) ne permet pas SELECT … FOR UPDATE.
 */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return await drizzle(pool, { schema }).transaction(fn);
  } finally {
    await pool.end();
  }
}
