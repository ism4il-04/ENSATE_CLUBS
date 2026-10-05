// Service worker ensate/clubs.
// - Fichiers statiques (_next/static, icônes, polices) : cache d'abord.
// - Pages : réseau d'abord, puis page « hors ligne ».
// - Billets (/moi/billets et /moi/billets/…) : gardés en cache pour être présentés sans réseau.
//   La page « Mes billets » demande aussi de mettre de côté chaque billet à venir (message « cache-billets »).
// - À la déconnexion, la page envoie « clear-private » : les billets sont effacés de l'appareil.
const VERSION = "v3";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const BILLETS = "billets";
const OFFLINE_URL = "/hors-ligne";

const estBillet = (pathname) => pathname === "/moi/billets" || /^\/moi\/billets\/[0-9a-f-]{36}$/.test(pathname);

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

/** Récupère une page de billet avec la session de l'utilisateur et la garde si c'est bien un billet. */
async function garderBillet(url) {
  const res = await fetch(url, { credentials: "same-origin", redirect: "follow" });
  // Jamais une redirection (ex. vers /connexion) ni une erreur : seul le vrai billet est gardé.
  if (res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) {
    await (await caches.open(BILLETS)).put(url, res.clone());
  }
  return res;
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "clear-private") {
    event.waitUntil(caches.delete(BILLETS));
    return;
  }
  if (data && data.type === "cache-billets" && Array.isArray(data.urls)) {
    const urls = data.urls
      .map((u) => new URL(u, self.location.origin))
      .filter((u) => u.origin === self.location.origin && estBillet(u.pathname))
      .slice(0, 30);
    event.waitUntil(Promise.allSettled(urls.map((u) => garderBillet(u.href))));
  }
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
    const billet = estBillet(url.pathname);
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (billet && res.ok && !res.redirected) (await caches.open(BILLETS)).put(url.pathname, res.clone());
          return res;
        } catch {
          const cached = billet ? await caches.match(url.pathname, { cacheName: BILLETS }) : null;
          return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
        }
      })(),
    );
  }
});
