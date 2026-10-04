import "server-only";

export type Email = { to: string; subject: string; html: string; text: string };

const RESEND = "https://api.resend.com/emails/batch";
const BATCH = 100; // maximum par appel Resend

/** Adresse publique du site, pour les liens dans les emails. */
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

const mask = (email: string) => email.replace(/^(.).*(@.*)$/, "$1…$2");

/**
 * Envoie des emails transactionnels (un destinataire par email : personne ne voit l'adresse des autres).
 * Ne lève jamais d'erreur : un email en échec ne doit pas annuler l'action qui l'a déclenché.
 * Sans RESEND_API_KEY, les emails sont seulement journalisés (développement).
 */
export async function sendEmails(emails: Email[]) {
  const list = emails.filter((e) => e.to.includes("@"));
  if (!list.length) return;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    for (const e of list) console.info(`[email non envoyé : RESEND_API_KEY absent] ${mask(e.to)} · ${e.subject}`);
    return;
  }
  for (let i = 0; i < list.length; i += BATCH) {
    const chunk = list.slice(i, i + BATCH);
    try {
      const res = await fetch(RESEND, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((e) => ({ from, to: [e.to], subject: e.subject, html: e.html, text: e.text }))),
      });
      if (!res.ok) console.error(`[email] Resend a refusé ${chunk.length} email(s) : ${res.status} ${(await res.text()).slice(0, 300)}`);
    } catch (err) {
      console.error(`[email] envoi impossible (${chunk.length} email(s))`, err);
    }
  }
}
