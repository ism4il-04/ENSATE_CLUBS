// Service worker ensate/clubs.
// - Fichiers statiques (_next/static, icônes, polices) : cache d'abord.
// - Pages : réseau d'abord, puis page « hors ligne ».
// - Billets (/moi/billets/…) : gardés en cache pour pouvoir les présenter sans réseau.
const VERSION = "v2";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const BILLETS = "billets";
const OFFLINE_URL = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![STATIC, PAGES, BILLETS].includes(k)).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  // Envoyé à la déconnexion : on oublie les billets de l'appareil.
  if (event.data === "clear-private") event.waitUntil(caches.delete(BILLETS));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    const isBillet = url.pathname.startsWith("/moi/billets/");
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // Jamais une redirection (ex. vers /connexion) : seul le vrai billet est gardé.
          if (isBillet && res.ok && !res.redirected) (await caches.open(BILLETS)).put(req, res.clone());
          return res;
        } catch {
          const cached = isBillet ? await caches.match(req) : null;
          return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
        }
      })(),
    );
  }
});
