/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
// Enables cross-origin isolation (SharedArrayBuffer) on hosts that can't set
// COOP/COEP headers themselves, e.g. GitHub Pages. It installs a service worker
// that re-serves responses with the isolation headers, then reloads once.
//
// We use COEP `credentialless` (not `require-corp`) so cross-origin subresources
// like the on-device captions model download from the HuggingFace CDN keep
// working without needing CORP headers. `coepDegrade` makes a browser that can't
// isolate this way fall back to NO isolation (so the app still works, just on the
// single-thread ffmpeg core) instead of ending up in a broken state.
let coepCredentialless = false;
if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener('message', (ev) => {
    if (!ev.data) {
      return;
    } else if (ev.data.type === 'deregister') {
      self.registration
        .unregister()
        .then(() => self.clients.matchAll())
        .then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        });
    } else if (ev.data.type === 'coepCredentialless') {
      coepCredentialless = ev.data.value;
    }
  });

  self.addEventListener('fetch', function (event) {
    const r = event.request;
    if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') {
      return;
    }

    const request =
      coepCredentialless && r.mode === 'no-cors'
        ? new Request(r, { credentials: 'omit' })
        : r;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) {
            return response;
          }

          const newHeaders = new Headers(response.headers);
          newHeaders.set(
            'Cross-Origin-Embedder-Policy',
            coepCredentialless ? 'credentialless' : 'require-corp',
          );
          if (!coepCredentialless) {
            newHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
          }
          newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch((e) => console.error(e)),
    );
  });
} else {
  (() => {
    const reloadedBySelf = window.sessionStorage.getItem('coiReloadedBySelf');
    window.sessionStorage.removeItem('coiReloadedBySelf');
    const coepDegrading = reloadedBySelf == 'coepdegrade';

    // You can customize the behavior of this script through a global `coi` variable.
    const coi = {
      shouldRegister: () => !reloadedBySelf,
      shouldDeregister: () => false,
      coepCredentialless: () => true,
      coepDegrade: () => true,
      doReload: () => window.location.reload(),
      quiet: false,
      ...window.coi,
    };

    const n = navigator;
    const controlling = n.serviceWorker && n.serviceWorker.controller;

    // Record the failure if the page is served by serviceWorker.
    if (controlling && !window.crossOriginIsolated) {
      window.sessionStorage.setItem('coiCoepHasFailed', 'true');
    }
    const coepHasFailed = window.sessionStorage.getItem('coiCoepHasFailed');

    if (controlling) {
      // Reload only on the first failure.
      const reloadToDegrade = coi.coepDegrade() && !(coepDegrading || window.crossOriginIsolated);
      n.serviceWorker.controller.postMessage({
        type: 'coepCredentialless',
        value:
          reloadToDegrade || (coepHasFailed && coi.coepDegrade())
            ? false
            : coi.coepCredentialless(),
      });
      if (reloadToDegrade) {
        !coi.quiet && console.log('Reloading page to degrade COEP.');
        window.sessionStorage.setItem('coiReloadedBySelf', 'coepdegrade');
        coi.doReload('coepdegrade');
      }
    } else if (coi.shouldRegister()) {
      if (!window.isSecureContext) {
        !coi.quiet &&
          console.log('COOP/COEP Service Worker not registered, a secure context is required.');
      } else {
        n.serviceWorker.register(window.document.currentScript.src).then(
          (registration) => {
            !coi.quiet && console.log('COOP/COEP Service Worker registered', registration.scope);

            registration.addEventListener('updatefound', () => {
              !coi.quiet &&
                console.log('Reloading page to make use of updated COOP/COEP Service Worker.');
              window.sessionStorage.setItem('coiReloadedBySelf', 'updatefound');
              coi.doReload();
            });

            // If the registration is active, but it's not controlling the page
            if (registration.active && !n.serviceWorker.controller) {
              !coi.quiet && console.log('Reloading page to make use of COOP/COEP Service Worker.');
              window.sessionStorage.setItem('coiReloadedBySelf', 'notcontrolling');
              coi.doReload();
            }
          },
          (err) => {
            !coi.quiet && console.error('COOP/COEP Service Worker failed to register:', err);
          },
        );
      }
    }
  })();
}
