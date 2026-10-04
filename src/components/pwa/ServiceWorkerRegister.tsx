"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

/** À appeler avant la déconnexion : efface les billets gardés hors ligne. */
export function clearPrivateCache() {
  navigator.serviceWorker?.controller?.postMessage("clear-private");
}
