import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, DEV_LOGIN } from "@/auth";
import { Logo } from "@/components/site/Logo";
import { Icon } from "@/components/ui/Icon";
import { devSignIn, signInWithGoogle } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  COMPTE_NON_AUTORISE: "Cette adresse Google n'est pas vérifiée, ou le compte a été suspendu. Contacte le coordinateur des clubs.",
  AccessDenied: "Connexion refusée. Réessaie avec un autre compte Google.",
  Configuration: "La connexion est momentanément indisponible. Réessaie dans quelques minutes.",
};

const TILES = [
  { t: "Hackathon IA", c: "bg-violet", pos: "left-[6%] top-[8%] w-52 h-36 -rotate-6" },
  { t: "Photo de nuit", c: "bg-amber", pos: "left-[46%] top-[5%] w-44 h-48 rotate-6" },
  { t: "Futsal cup", c: "bg-sky", pos: "left-[70%] top-[32%] w-40 h-32 -rotate-3" },
  { t: "Échecs", c: "bg-accent", pos: "left-[16%] top-[38%] w-44 h-28 rotate-6" },
];

export default async function Connexion({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const retour = typeof sp.retour === "string" ? sp.retour : typeof sp.callbackUrl === "string" ? sp.callbackUrl : "/";
  const erreur = typeof sp.erreur === "string" ? sp.erreur : typeof sp.error === "string" ? sp.error : null;

  const session = await auth();
  if (session?.user) redirect(retour.startsWith("/") ? retour : "/");

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div className="relative flex min-h-[380px] min-w-0 flex-col justify-end lg:flex-1 overflow-hidden bg-surface p-[clamp(24px,4vw,56px)]">
        <div aria-hidden className="absolute inset-0">
          {TILES.map((x) => (
            <div key={x.t} className={`absolute flex items-end rounded-[26px] p-4 font-display text-2xl leading-[0.88] font-extrabold tracking-tight text-ink uppercase ${x.c} ${x.pos}`}>
              {x.t}
            </div>
          ))}
        </div>
        <div className="relative flex max-w-xl flex-col gap-3.5 pt-56 lg:pt-64">
          <span className="font-display text-[clamp(38px,4.6vw,64px)] leading-[0.92] font-extrabold tracking-[-0.045em]">
            Toute la vie parascolaire, <span className="text-accent">au même endroit.</span>
          </span>
          <span className="text-muted">Les événements des clubs et associations de l&apos;ENSA de Tétouan, tes billets et tes inscriptions au stand.</span>
        </div>
      </div>

      <main className="flex min-w-0 items-center lg:flex-1 justify-center p-[clamp(24px,5vw,64px)]">
        <div className="animate-rise flex w-full max-w-[420px] flex-col gap-6.5">
          <Logo />
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[44px] leading-none font-extrabold tracking-[-0.045em]">Connexion</h1>
            <p className="text-muted">Un seul bouton, aucun mot de passe.</p>
          </div>

          {erreur && (
            <div role="alert" className="flex gap-3 rounded-[20px] border border-danger/45 bg-danger/10 p-4 text-sm leading-relaxed">
              <Icon name="alert" size={20} className="flex-none text-danger" />
              <span className="text-soft">{ERRORS[erreur] ?? "La connexion a échoué. Réessaie."}</span>
            </div>
          )}

          <form action={signInWithGoogle}>
            <input type="hidden" name="retour" value={retour} />
            <button type="submit" className="press flex h-14.5 w-full items-center justify-center gap-3 rounded-full bg-paper text-[17px] font-extrabold text-ink">
              <span aria-hidden className="grid size-7.5 place-items-center rounded-full bg-ink font-display text-base font-extrabold text-paper">
                G
              </span>
              Continuer avec Google
            </button>
          </form>

          {DEV_LOGIN && (
            <div className="flex flex-col gap-2.5 rounded-[20px] border border-dashed border-amber/60 bg-amber/8 p-4">
              <span className="text-[13px] font-extrabold tracking-wider text-amber uppercase">Démo locale (désactivée en production)</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["etudiant.demo@etu.uae.ac.ma", "Étudiante (trésorière CI)"],
                    ["membre.demo@etu.uae.ac.ma", "Membre (stand CI)"],
                    ["externe.demo@example.com", "Externe"],
                    ["club.info.demo@example.com", "Club Informatique"],
                    ["club.robot.demo@example.com", "Club Robotique"],
                    ["coordination.demo@example.com", "Coordinateur"],
                    ["admin.demo@example.com", "Admin"],
                  ] as const
                ).map(([email, label]) => (
                  <form key={email} action={devSignIn}>
                    <input type="hidden" name="email" value={email} />
                    <input type="hidden" name="retour" value={label === "Coordinateur" ? "/coord" : label === "Admin" ? "/admin" : label.startsWith("Club") || label.startsWith("Membre") ? "/org" : retour} />
                    <button type="submit" className="press h-11 w-full rounded-full border border-line-strong bg-surface text-sm font-extrabold">
                      {label}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5 text-sm leading-relaxed">
            {[
              ["user", "bg-accent", "Étudiant·e", "Ton adresse @etu.uae.ac.ma crée ton compte automatiquement."],
              ["users", "bg-violet", "Club, association ou équipe", "Utilise l'adresse Google enregistrée par le coordinateur."],
              ["globe", "bg-sky", "Externe", "N'importe quel compte Google, pour les événements ouverts à tous."],
            ].map(([icon, bg, title, text]) => (
              <div key={title} className="flex gap-3.5 rounded-[20px] border border-line bg-surface p-4">
                <span className={`grid size-10 flex-none place-items-center rounded-xl text-ink ${bg}`}>
                  <Icon name={icon as "user"} size={19} stroke={2.2} />
                </span>
                <div>
                  <b>{title}</b>
                  <br />
                  <span className="text-muted">{text}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-faint">
            Ton nom et ta photo de profil Google sont affichés sur la plateforme. Ton numéro de téléphone n&apos;est demandé que si un
            événement l&apos;exige. En continuant, tu acceptes les{" "}
            <Link href="/conditions" className="underline underline-offset-2 hover:text-paper">
              conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="underline underline-offset-2 hover:text-paper">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
