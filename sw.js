// 📁 sw.js - Service Worker สำหรับ Dol Quest Log
const CACHE_NAME = 'dol-quest-v4';
const urlsToCache = [
    './',
    './index.html'
];

// 🟢 ติดตั้ง Service Worker
self.addEventListener('install', event => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .catch(err => console.error('[SW] Cache failed:', err))
    );
    self.skipWaiting(); // Activate ทันที
});

// 🔵 Activate - ลบ cache เก่า
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // ควบคุมทุก tab ทันที
});

// 🟡 Fetch - ใช้ Cache First Strategy
self.addEventListener('fetch', event => {
    // ข้าม request ที่ไม่ใช่ GET
    if (event.request.method !== 'GET') return;
    
    // ข้าม Google Apps Script (ต้อง fetch จาก network เสมอ)
    if (event.request.url.includes('script.google.com')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // มีใน cache → ใช้เลย + อัปเดต cache ในพื้นหลัง
                    fetchAndUpdateCache(event.request);
                    return cachedResponse;
                }
                
                // ไม่มีใน cache → fetch จาก network
                return fetch(event.request)
                    .then(networkResponse => {
                        // เก็บลง cache สำหรับครั้งต่อไป
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(event.request, responseToCache));
                        }
                        return networkResponse;
                    })
                    .catch(err => {
                        console.error('[SW] Fetch failed:', err);
                        // ถ้า offline และไม่มี cache → แสดง error
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// 🔄 ฟังก์ชันช่วย: Fetch แล้วอัปเดต cache
async function fetchAndUpdateCache(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
        }
    } catch (err) {
        // เงียบๆ ถ้า fetch ล้มเหลว (ใช้ cache เก่าต่อไป)
    }
}
