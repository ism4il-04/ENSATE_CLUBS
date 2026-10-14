import "server-only";
import nodemailer from "nodemailer";

export type Email = { to: string; subject: string; html: string; text: string };

/** Adresse publique du site, pour les liens dans les emails. */
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

const mask = (email: string) => email.replace(/^(.).*(@.*)$/, "$1…$2");

/** SMTP de Google (Gmail) : compte d'envoi + mot de passe d'application (validation en deux étapes requise). */
function transport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT) || 465;
  return {
    // Gmail impose l'adresse du compte (ou un alias vérifié) comme expéditeur.
    from: process.env.EMAIL_FROM || `"ENSATE clubs" <${user}>`,
    mailer: nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465, // 465 : TLS direct ; 587 : STARTTLS imposé ci-dessous
      requireTLS: true,
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
    }),
  };
}

/**
 * Envoie des emails transactionnels (un destinataire par email : personne ne voit l'adresse des autres).
 * Ne lève jamais d'erreur : un email en échec ne doit pas annuler l'action qui l'a déclenché.
 * Sans SMTP_USER / SMTP_PASS, les emails sont seulement journalisés (développement).
 */
export async function sendEmails(emails: Email[]) {
  const list = emails.filter((e) => e.to.includes("@"));
  if (!list.length) return;
  const t = transport();
  if (!t) {
    for (const e of list) console.info(`[email non envoyé : SMTP non configuré] ${mask(e.to)} · ${e.subject}`);
    return;
  }
  try {
    const res = await Promise.allSettled(list.map((e) => t.mailer.sendMail({ from: t.from, to: e.to, subject: e.subject, html: e.html, text: e.text })));
    res.forEach((r, i) => {
      if (r.status === "rejected") console.error(`[email] échec pour ${mask(list[i]!.to)} : ${r.reason instanceof Error ? r.reason.message : r.reason}`);
    });
  } finally {
    t.mailer.close();
  }
}
