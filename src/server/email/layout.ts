import "server-only";
import { appUrl, type Email } from "./send";

export type Message = {
  subject: string;
  title: string;
  /** Paragraphes en texte brut (échappés). */
  lines: string[];
  /** Tableau « libellé : valeur » (date, lieu, statut…). */
  details?: [string, string][];
  cta?: { label: string; path: string };
  /** Petite note en bas (texte brut). */
  note?: string;
  /** Couleur de l'événement ou du club, pour le bandeau. */
  accent?: string;
};

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const HEX = /^#[0-9a-f]{6}$/i;

/** Construit le HTML (tables et styles en ligne, pour les clients mail) et la version texte. */
export function compose(to: string, m: Message): Email {
  const base = appUrl();
  const accent = m.accent && HEX.test(m.accent) ? m.accent : "#C6F24E";
  const href = m.cta ? base + m.cta.path : null;

  const details = m.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-collapse:collapse">${m.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;border-top:1px solid #e7e6e1;color:#6b6e7e;font-size:13px;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid #e7e6e1;color:#0b0c12;font-size:14px;font-weight:700">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f3ef;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(m.lines[0] ?? "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#0b0c12;padding:18px 24px;font-size:18px;font-weight:800;color:#f4f3ef">ensate<span style="color:#c6f24e">/</span>clubs</td></tr>
<tr><td style="height:6px;background:${accent};line-height:6px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:26px 24px 8px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#0b0c12">${esc(m.title)}</h1>
${m.lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#33354a">${esc(l)}</p>`).join("")}
${details}
${href ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px"><tr><td style="background:#c6f24e;border-radius:999px"><a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:800;color:#0b0c12;text-decoration:none">${esc(m.cta!.label)}</a></td></tr></table>` : ""}
${m.note ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#6b6e7e">${esc(m.note)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 24px 22px;border-top:1px solid #e7e6e1;font-size:12px;line-height:1.5;color:#8b8ea0">Email automatique de la plateforme parascolaire de l'ENSA de Tétouan. Merci de ne pas y répondre.<br><a href="${esc(base)}" style="color:#8b8ea0">${esc(base.replace(/^https?:\/\//, ""))}</a> · <a href="${esc(base)}/confidentialite" style="color:#8b8ea0">Confidentialité</a></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    m.title,
    "",
    ...m.lines,
    ...(m.details?.length ? ["", ...m.details.map(([k, v]) => `${k} : ${v}`)] : []),
    ...(href ? ["", `${m.cta!.label} : ${href}`] : []),
    ...(m.note ? ["", m.note] : []),
    "",
    "— ensate/clubs, ENSA de Tétouan (email automatique)",
  ].join("\n");

  return { to, subject: m.subject, html, text };
}
