const CACHE_NAME = "pokemon-campaign-v5";
const RUNTIME_CACHE = "pokemon-campaign-runtime-v2";

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

  /*
    PAGE LOADS:
    Always try GitHub first so index.html updates automatically.
    If there is no internet connection, use the cached app instead.
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
    APP FILES:
    Use the cached file immediately, while checking for a newer
    copy in the background.
  */
  if (
    new URL(request.url).origin ===
    self.location.origin
  ) {
    event.respondWith(
      caches
        .match(request)
        .then(cachedResponse => {

          const networkFetch =
            fetch(request)
              .then(response => {

                if (
                  response &&
                  response.ok
                ) {
                  const copy =
                    response.clone();

                  caches
                    .open(CACHE_NAME)
                    .then(cache =>
                      cache.put(
                        request,
                        copy
                      )
                    );
                }

                return response;
              })
              .catch(
                () => cachedResponse
              );

          return (
            cachedResponse ||
            networkFetch
          );
        })
    );

    return;
  }

  /*
    POKÉMON IMAGES:
    Save images after they have been loaded once so previously
    viewed Pokémon artwork can still appear while offline.
  */
  if (
    request.destination === "image"
  ) {
    event.respondWith(
      caches
        .match(request)
        .then(cachedResponse => {

          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(request)
            .then(response => {

              const copy =
                response.clone();

              caches
                .open(
                  RUNTIME_CACHE
                )
                .then(cache =>
                  cache.put(
                    request,
                    copy
                  )
                );

              return response;
            });
        })
    );
  }
});