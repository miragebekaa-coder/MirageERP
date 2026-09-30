/* ══════════════════════════════════════════════════════════
   ميراج ERP — عامل الخدمة (Service Worker)
   1) يجعل النظام قابلاً للتثبيت على الهاتف ويفتح صفحاته المحفوظة بلا إنترنت.
   2) يستقبل إشعارات الهاتف ويعرضها حتى والتطبيق مغلق.
   الصفحات تُطلب من الشبكة أولاً دائماً، فأي تحديث تنشره يصل فوراً؛
   والنسخة المحفوظة تُستخدم فقط حين لا يوجد اتصال.
   ══════════════════════════════════════════════════════════ */

const CACHE = "mirage-v4";
const SHELL = [
  "index.html", "app.css", "app.js", "mirage-api.js", "config.js", "mirage.png",
  "icon-192.png", "badge-96.png", "manifest.webmanifest",
  // المكتبات والخط صارت داخل الموقع، فتُحفَظ معه ويعمل النظام بلا إنترنت
  "vendor/sweetalert2.js", "vendor/supabase.js", "vendor/fonts.css",
  "vendor/fonts/tajawal-arabic-400-normal.woff2",
  "vendor/fonts/tajawal-arabic-500-normal.woff2",
  "vendor/fonts/tajawal-arabic-700-normal.woff2",
  "vendor/fonts/tajawal-arabic-900-normal.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ملفات الموقع نفسه فقط — لا يمسّ طلبات قاعدة البيانات ولا المكتبات الخارجية */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) =>
          hit || (req.mode === "navigate" ? caches.match("index.html") : undefined)
        )
      )
  );
});

/* ─────────── إشعارات الهاتف ─────────── */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (_) { d = { body: e.data ? e.data.text() : "" }; }

  const title = d.title || "ميراج — إشعار جديد";
  const opts = {
    body: d.body || "",
    icon: "icon-192.png",
    badge: "badge-96.png",
    dir: "rtl",
    lang: "ar",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    // الإشعار يبقى معروضاً حتى يلمسه المستخدم، ولا يختفي وحده
    requireInteraction: true,
    silent: false,
    // اهتزاز واضح يوقظ الشاشة المقفلة
    vibrate: [400, 150, 400, 150, 400],
    timestamp: Date.now(),
    actions: [
      { action: "open",    title: "فتح الإشعار" },
      { action: "dismiss", title: "إخفاء" }
    ],
    data: { url: d.url || "notifications.html", title: title, body: d.body || "" }
  };

  e.waitUntil(Promise.all([
    self.registration.showNotification(title, opts),
    // إن كان النظام مفتوحاً: حدّث عدّاد الجرس، واعرض الإشعار وسط الشاشة
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => list.forEach((c) => c.postMessage({
        type: "mirage-push", title: title, body: opts.body, url: opts.data.url
      })))
  ]));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "dismiss") return;
  const target = new URL((e.notification.data && e.notification.data.url) || "notifications.html",
                         self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          return c.navigate(target).then((w) => (w || c).focus()).catch(() => c.focus());
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

/* المتصفح غيّر الاشتراك (نادر): اطلب من الصفحة المفتوحة إعادة التسجيل */
self.addEventListener("pushsubscriptionchange", () => {
  self.clients.matchAll({ type: "window" }).then((list) =>
    list.forEach((c) => c.postMessage({ type: "mirage-resubscribe" })));
});
