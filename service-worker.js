const CACHE_NAME = "pokemon-campaign-v5";
const RUNTIME_CACHE = "pokemon-campaign-runtime-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(
              key =>
                key !== CACHE_NAME &&
                key !== RUNTIME_CACHE
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
    version.json must always come directly from GitHub.
    Never serve an old cached copy.
  */
  if (
    url.origin === self.location.origin &&
    url.pathname.endsWith("/version.json")
  ) {
    event.respondWith(
      fetch(request, {
        cache: "no-store"
      })
    );
    return;
  }

  /*
    Page loads:
    Try GitHub first so the newest index.html is used.
    Fall back to the cached app if offline.
  */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches
              .open(CACHE_NAME)
              .then(cache =>
                cache.put("./index.html", copy)
              );
          }

          return response;
        })
        .catch(() =>
          caches.match("./index.html")
        )
    );

    return;
  }

  /*
    Same-origin app files:
    Use cached copy immediately while refreshing it
    in the background.
  */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        const networkFetch =
          fetch(request)
            .then(response => {
              if (response && response.ok) {
                const copy = response.clone();

                caches
                  .open(CACHE_NAME)
                  .then(cache =>
                    cache.put(request, copy)
                  );
              }

              return response;
            })
            .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    );

    return;
  }

  /*
    External Pokémon artwork:
    Cache images after they load successfully.
  */
  if (request.destination === "image") {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then(response => {
            const copy = response.clone();

            caches
              .open(RUNTIME_CACHE)
              .then(cache =>
                cache.put(request, copy)
              );

            return response;
          });
      })
    );
  }
});
