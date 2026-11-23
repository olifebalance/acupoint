// 홈 화면에 추가(앱처럼 설치)할 수 있게 하는 최소한의 서비스 워커.
// 파일을 따로 저장해 두지 않는다: 마을은 늘 서버에서 새로 받아 와서, 고친 내용이 바로 보이게 한다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request));
});
