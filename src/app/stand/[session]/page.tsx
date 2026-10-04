import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Logo } from "@/components/site/Logo";
import { StandInscriptionForm, StandResult } from "@/components/events/StandInscriptionForm";
import { getSessionUser } from "@/server/permissions";
import { getMyInscription, getPersonne } from "@/server/queries/moi";
import { checkStandCookie, sessionPourInscription, standCookieName } from "@/server/services/stand";

export const metadata: Metadata = { title: "Inscription au stand", robots: { index: false } };

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pt-6 pb-10">
      <Logo />
      {children}
    </main>
  );
}

export default async function StandInscription({ params, searchParams }: PageProps<"/stand/[session]">) {
  const { session } = await params;
  const expire = (await searchParams).expire === "1";
  const ctx = await sessionPourInscription(session);

  if (!ctx) {
    return (
      <Screen>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Ce stand est fermé</h1>
        <p className="text-muted">Demande au club d&apos;ouvrir à nouveau sa session stand, puis scanne le nouveau QR.</p>
      </Screen>
    );
  }
  const { evt, org } = ctx;
  const jar = await cookies();
  const access = checkStandCookie(session, jar.get(standCookieName(session))?.value);
  const user = await getSessionUser();
  const mine = user ? await getMyInscription(user.id, evt.id) : null;
  const personne = user ? await getPersonne(user.id) : null;
  const nom = [personne?.prenom, personne?.nom].filter(Boolean).join(" ") || user?.email || "";

  return (
    <Screen>
      {!mine && (
        <>
          <span className="flex items-center gap-2 self-start rounded-full border border-line bg-surface py-1.5 pr-3 pl-2 text-[13px] font-extrabold">
            <span className={`size-2.5 rounded-full ${access ? "animate-pulse-ring bg-accent" : "bg-danger"}`} />
            {access ? "QR du stand vérifié" : expire ? "QR expiré" : "Accès au stand requis"}
          </span>
          <h1 className="font-display text-[40px] leading-[0.95] font-extrabold tracking-[-0.045em]">
            Tu es au stand du <span className="text-accent">{org?.nom ?? "club"}</span>
          </h1>
        </>
      )}
      <div className="relative overflow-hidden rounded-[28px] p-5 text-ink" style={{ background: evt.couleur }}>
        <span aria-hidden className="absolute -right-10 -bottom-12 size-40 rotate-12 rounded-[44px] bg-white/25" />
        <span className="relative block font-display text-[34px] leading-[0.9] font-extrabold tracking-tight">{evt.titre}</span>
      </div>

      {mine ? (
        <StandResult statut={mine.statut} inscriptionId={mine.id} nom={nom} gratuit={evt.gratuit} />
      ) : !access ? (
        <p className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm font-bold text-soft">
          Scanne à nouveau le QR affiché sur l&apos;écran du stand : il change toutes les 30 secondes.
        </p>
      ) : !user ? (
        <>
          <p className="text-muted">Connecte-toi pour t&apos;inscrire. Tu as 15 minutes, même si le QR change entre-temps.</p>
          <Link
            href={`/connexion?retour=${encodeURIComponent(`/stand/${session}`)}`}
            className="press flex h-14.5 items-center justify-center gap-3 rounded-full bg-paper text-[17px] font-extrabold text-ink"
          >
            Continuer avec Google
          </Link>
        </>
      ) : (
        <StandInscriptionForm sessionId={session} needPhone={evt.telephoneRequis && !personne?.telephone} nom={nom} gratuit={evt.gratuit} />
      )}
    </Screen>
  );
}
