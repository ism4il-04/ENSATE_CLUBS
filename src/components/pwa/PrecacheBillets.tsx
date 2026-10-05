"use client";

import { useEffect } from "react";

/**
 * Sur « Mes billets » : demande au service worker de garder chaque billet à venir,
 * pour qu'il s'ouvre sans réseau à l'entrée, même s'il n'a jamais été ouvert.
 */
export function PrecacheBillets({ urls }: { urls: string[] }) {
  const liste = urls.join("|");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !liste) return;
    const envoyer = () => navigator.serviceWorker.controller?.postMessage({ type: "cache-billets", urls: ["/moi/billets", ...liste.split("|")] });
    if (navigator.serviceWorker.controller) envoyer();
    navigator.serviceWorker.addEventListener("controllerchange", envoyer);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", envoyer);
  }, [liste]);
  return null;
}
