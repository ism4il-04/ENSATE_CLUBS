"use client";

import { useActionState, useState } from "react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { imageUrl } from "@/lib/images";
import { updateOrgProfil, type OrgProfilState } from "@/server/actions/orgProfil";

const COULEURS = ["#C6F24E", "#7CC8FF", "#FFB547", "#FF8CC6", "#B79CFF", "#FF8A65"];
const input = "h-12 rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 font-semibold text-paper outline-none focus:border-accent";

type Org = {
  nom: string;
  type: string;
  sigle: string | null;
  description: string | null;
  couleur: string;
  emailContact: string | null;
  telephoneContact: string | null;
  instagram: string | null;
  linkedin: string | null;
  logoUrl: string | null;
};

export function OrgProfilForm({ org, uploads }: { org: Org; uploads: boolean }) {
  const [state, action, pending] = useActionState<OrgProfilState, FormData>(updateOrgProfil, null);
  const [couleur, setCouleur] = useState(org.couleur);
  const [sigle, setSigle] = useState(org.sigle ?? "");
  const [desc, setDesc] = useState(org.description ?? "");
  const [logo, setLogo] = useState(org.logoUrl ?? "");

  return (
    <div className="flex flex-wrap items-start gap-5">
      <form action={action} className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
        <section className="flex flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-[17px] font-extrabold">Identité</h2>
          <p className="text-sm text-muted">
            Nom : <b className="text-paper">{org.nom}</b> ({org.type === "CLUB" ? "club" : "association"}). Pour le changer, contacte le coordinateur.
          </p>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
            Sigle
            <input name="sigle" value={sigle} onChange={(e) => setSigle(e.target.value)} maxLength={6} className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
            Description
            <textarea name="description" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} className="resize-y rounded-[14px] border-[1.5px] border-line-strong bg-ink px-3.5 py-3 leading-relaxed font-medium text-paper outline-none focus:border-accent" />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-bold text-muted">Couleur du club</legend>
            <input type="hidden" name="couleur" value={couleur} />
            <div className="flex flex-wrap gap-2">
              {COULEURS.map((c) => (
                <button key={c} type="button" aria-label={`Couleur ${c}`} aria-pressed={couleur === c} onClick={() => setCouleur(c)} className={`size-11 rounded-xl border-2 ${couleur === c ? "border-paper" : "border-transparent"}`} style={{ background: c }} />
              ))}
            </div>
          </fieldset>
          <ImageUpload folder="ensate-clubs/logos" enabled={uploads} value={logo} onChange={setLogo} name="logoUrl" label="Logo" hint="Image carrée de préférence." />
        </section>
        <section className="flex flex-col gap-3.5 rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-[17px] font-extrabold">
            Contact <span className="text-sm font-semibold text-muted">(affiché sur les billets pour les demandes d&apos;annulation)</span>
          </h2>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            {(
              [
                ["emailContact", "Email de contact", org.emailContact, "club@exemple.com"],
                ["telephoneContact", "Téléphone de contact", org.telephoneContact, "06 00 00 00 00"],
                ["instagram", "Instagram", org.instagram, "@nomduclub"],
                ["linkedin", "LinkedIn", org.linkedin, "https://www.linkedin.com/company/…"],
              ] as const
            ).map(([name, label, value, ph]) => (
              <label key={name} className="flex flex-col gap-1.5 text-[13px] font-bold text-muted">
                {label}
                <input name={name} defaultValue={value ?? ""} placeholder={ph} className={input} />
              </label>
            ))}
          </div>
        </section>
        {state && (
          <span role="status" className={`text-sm font-bold ${state.ok ? "text-accent" : "text-danger"}`}>
            {state.message}
          </span>
        )}
        <button type="submit" disabled={pending} className="press h-13 rounded-full bg-accent font-extrabold text-ink">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <aside className="flex flex-[1_1_300px] flex-col gap-2.5">
        <span className="text-[13px] font-extrabold tracking-widest text-muted uppercase">Aperçu</span>
        <div className="overflow-hidden rounded-[26px] border border-line bg-surface">
          <div className="relative h-32 overflow-hidden" style={{ background: couleur }}>
            <span className="absolute -right-3 -bottom-8 font-display text-[110px] leading-none font-extrabold tracking-[-0.06em] text-ink">{(sigle || org.nom.slice(0, 2)).toUpperCase()}</span>
            {logo.startsWith("https://") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl(logo, 160)} alt="" className="absolute top-4 left-4 size-14 rounded-2xl border-2 border-ink object-cover" />
            )}
          </div>
          <div className="flex flex-col gap-2 p-4.5">
            <span className="font-display text-2xl font-extrabold tracking-tight">{org.nom}</span>
            <p className="line-clamp-4 text-sm leading-relaxed text-muted">{desc || "La description apparaîtra ici."}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
