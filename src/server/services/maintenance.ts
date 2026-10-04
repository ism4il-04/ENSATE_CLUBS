import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

/**
 * Tâche planifiée (docs/05 §6.4) :
 * - PUBLIE → TERMINE quand le dernier créneau est passé (activités et événements simples, puis programmes
 *   dont toutes les activités sont terminées ou annulées) ;
 * - fermeture des sessions de stand expirées.
 * Idempotente : peut être relancée sans effet de bord.
 */
export async function maintenance() {
  const db = getDb();
  const simples = await db.execute(sql`
    update evenement e set statut = 'TERMINE', inscriptions_ouvertes = false, date_maj = now()
    where e.statut = 'PUBLIE' and e.structure <> 'PROGRAMME'
      and exists (select 1 from creneau c where c.id_evenement = e.id_evenement)
      and (select max(c.fin) from creneau c where c.id_evenement = e.id_evenement) < now()
    returning e.id_evenement`);
  const programmes = await db.execute(sql`
    update evenement p set statut = 'TERMINE', date_maj = now()
    where p.statut = 'PUBLIE' and p.structure = 'PROGRAMME'
      and exists (select 1 from evenement a where a.id_parent = p.id_evenement)
      and not exists (select 1 from evenement a where a.id_parent = p.id_evenement and a.statut not in ('TERMINE', 'ANNULE'))
    returning p.id_evenement`);
  const stands = await db.execute(sql`
    update session_stand set actif = false
    where actif and date_expiration < now()
    returning id_session`);
  return { termines: simples.rows.length + programmes.rows.length, standsFermes: stands.rows.length };
}
