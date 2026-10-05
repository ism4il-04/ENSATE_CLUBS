"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const noop = () => () => {};
const plateforme = () => {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installee";
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "autre";
};
const CLE = "pwa-bandeau-ferme";
const bandeauFerme = () => {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
};

/**
 * Installation de l'application (PWA) :
 * - Android / ordinateur : bouton qui ouvre l'invite d'installation du navigateur ;
 * - iPhone : Safari n'a pas d'invite, on explique « Partager → Sur l'écran d'accueil » ;
 * - rien si l'application est déjà installée.
 * `bandeau` : version compacte, refermable, pour l'accueil sur téléphone.
 */
export function InstallerApp({ bandeau = false }: { bandeau?: boolean }) {
  const plat = useSyncExternalStore(noop, plateforme, () => "serveur");
  const ferme0 = useSyncExternalStore(noop, bandeauFerme, () => true);
  const [ferme, setFerme] = useState(false);
  const [invite, setInvite] = useState<PromptEvent | null>(null);
  const [installee, setInstallee] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // on garde l'invite pour notre propre bouton
      setInvite(e as PromptEvent);
    };
    const onInstalled = () => setInstallee(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (plat === "serveur" || plat === "installee" || installee) return null;
  if (plat === "autre" && !invite) return null; // navigateur sans installation possible
  if (bandeau && (ferme || ferme0)) return null;

  const installer = async () => {
    if (!invite) return;
    await invite.prompt();
    const { outcome } = await invite.userChoice;
    if (outcome === "accepted") setInstallee(true);
    setInvite(null);
  };
  const fermer = () => {
    setFerme(true);
    try {
      localStorage.setItem(CLE, "1");
    } catch {}
  };

  return (
    <div className={`flex items-center gap-3 rounded-3xl border border-accent/50 bg-accent/8 p-4 ${bandeau ? "md:hidden" : ""}`}>
      <span className="grid size-11 flex-none place-items-center rounded-2xl bg-accent font-display text-xl font-extrabold text-ink">e</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-extrabold">Installer l&apos;application</span>
        <span className="text-[13px] leading-snug text-muted">
          {plat === "ios" ? (
            <>
              Dans Safari, touche <b className="text-paper">Partager</b> puis <b className="text-paper">« Sur l&apos;écran d&apos;accueil »</b>.
            </>
          ) : (
            "Accès en un geste depuis l'écran d'accueil, billets disponibles hors ligne."
          )}
        </span>
      </div>
      {plat !== "ios" && (
        <button type="button" onClick={installer} className="press h-10 flex-none rounded-full bg-accent px-4 text-[13px] font-extrabold text-ink">
          Installer
        </button>
      )}
      {bandeau && (
        <button type="button" aria-label="Fermer" onClick={fermer} className="press grid size-9 flex-none place-items-center rounded-full text-muted">
          <Icon name="x" size={16} stroke={2.6} />
        </button>
      )}
    </div>
  );
}
