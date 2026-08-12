const CACHE_NAME = 'store-apps-v1';

self.addEventListener('install', function (event) {
    console.log('Store Apps Service Worker Installed');
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    console.log('Store Apps Service Worker Activated');

    event.waitUntil(
        self.clients.claim()
    );
});

self.addEventListener('fetch', function (event) {
    // Network-first.
    // We intentionally do not cache application files here
    // to avoid serving outdated Store Apps code.
});
