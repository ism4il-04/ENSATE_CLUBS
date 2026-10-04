"use server";

import { revalidatePath } from "next/cache";
import { AccessError, requireFinance } from "@/server/permissions";
import {
  creerTransaction,
  modifierTransaction,
  supprimerTransaction,
  synchroniserBilletterie,
  TresorerieError,
  type TransactionInput,
} from "@/server/services/tresorerie";

export type TresorerieResult = { ok: boolean; message: string };

async function wrap(fn: () => Promise<string>): Promise<TresorerieResult> {
  try {
    const message = await fn();
    revalidatePath("/org/tresorerie");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof TresorerieError) return { ok: false, message: e.message };
    if (e instanceof AccessError) return { ok: false, message: "Accès refusé : la trésorerie est réservée à l'organisation." };
    console.error(e);
    return { ok: false, message: "Une erreur est survenue. Réessaie." };
  }
}

export async function enregistrerTransactionAction(id: string | null, input: TransactionInput) {
  return wrap(async () => {
    const { user, org } = await requireFinance();
    if (id) await modifierTransaction(org.id, String(id), input);
    else await creerTransaction(org.id, user.id, input);
    return id ? "Opération modifiée." : input.type === "RECETTE" ? "Recette enregistrée." : "Dépense enregistrée.";
  });
}

export async function supprimerTransactionAction(id: string) {
  return wrap(async () => {
    const { org } = await requireFinance();
    await supprimerTransaction(org.id, String(id));
    return "Opération supprimée.";
  });
}

export async function synchroniserBilletterieAction(eventId: string) {
  return wrap(async () => {
    const { user, org } = await requireFinance();
    const l = await synchroniserBilletterie(org.id, user.id, String(eventId));
    return `Billetterie « ${l.titre} » : ${l.encaisse} DH (${l.paiements} paiement${l.paiements > 1 ? "s" : ""}).`;
  });
}
