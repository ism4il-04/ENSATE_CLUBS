"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/**
 * Enregistre le service worker (production) et affiche :
 * - un bandeau « Hors ligne » quand le réseau est coupé ;
 * - une invite de rechargement quand une nouvelle version vient d'être installée.
 */
export function ServiceWorkerRegister() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [miseAJour, setMiseAJour] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const avait = !!navigator.serviceWorker.controller; // première installation : pas d'invite
    const onChange = () => avait && setMiseAJour(true);
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  return (
    <>
      {!online && (
        <div role="status" className="fixed inset-x-0 top-0 z-50 bg-amber px-4 py-1.5 text-center text-[13px] font-extrabold text-ink">
          Hors ligne · tes billets déjà enregistrés restent disponibles
        </div>
      )}
      {miseAJour && (
        <div role="status" className="animate-toast fixed right-4 bottom-24 z-50 flex items-center gap-3 rounded-[18px] bg-paper px-4 py-3 text-sm font-extrabold text-ink shadow-2xl md:bottom-6">
          Nouvelle version disponible
          <button type="button" onClick={() => location.reload()} className="press h-9 rounded-full bg-ink px-3.5 text-[13px] font-extrabold text-paper">
            Recharger
          </button>
        </div>
      )}
    </>
  );
}

/** À appeler avant la déconnexion : efface les billets gardés hors ligne. */
export function clearPrivateCache() {
  navigator.serviceWorker?.controller?.postMessage("clear-private");
}
