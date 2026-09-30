/* ══════════════════════════════════════════════════════════
   إدارة النظام — فحص الخادم وإشعارات الهاتف
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

function checkServer() {
  var btn = document.getElementById('pingBtn');
  var box = document.getElementById('pingResult');
  if (!box) return;

  box.innerHTML = '<div class="alert alert-info" style="margin:0">جارٍ الفحص…</div>';
  Mirage.busy(btn, true);

  if (typeof MirageAPI === 'undefined') {
    Mirage.busy(btn, false);
    box.innerHTML = '<div class="alert alert-danger" style="margin:0">' +
      'ملف mirage-api.js غير محمّل. تأكّد أنه موجود في المجلد وأن الصفحة تستدعيه.</div>';
    return;
  }

  Mirage.api('ping', {}).then(function (res) {
    Mirage.busy(btn, false);
    if (res.status === 'success') {
      var tone = res.ms < 600 ? 'alert-info' : 'alert-warn';
      box.innerHTML = '<div class="alert ' + tone + '" style="margin:0">' +
        'قاعدة البيانات تستجيب — <b>' + esc(res.backend || '—') + '</b><br>' +
        'أسرع قياس: <b>' + res.ms + ' ملّي ثانية</b> — التقييم: <b>' + esc(res.verdict || '') + '</b><br>' +
        (res.samples ? 'القياسات الثلاثة: ' + res.samples.join(' · ') + ' ملّي ثانية<br>' : '') +
        (res.cold ? '<span style="color:var(--text-muted)">القياس الأول أبطأ بكثير، وهذا طبيعي: ' +
          'يحمل فتح الاتصال وإيقاظ المشروع من الخمول.</span><br>' : '') +
        '<span style="font-weight:500">' + esc(res.hint || '') + '</span><br>' +
        '<span style="font-size:12px;color:var(--text-muted)">وقت الفحص: ' + esc(res.time || '') + '</span>' +
        '</div>';
    } else {
      box.innerHTML = '<div class="alert alert-danger" style="margin:0">' + esc(res.message) +
        (res.detail ? '<br><span style="font-weight:500">' + esc(res.detail) + '</span>' : '') +
        (res.raw ? '<pre style="direction:ltr;text-align:left;white-space:pre-wrap;font-size:11px;' +
          'background:#fff;padding:10px;border-radius:8px;margin-top:10px;max-height:160px;overflow:auto">' +
          esc(res.raw) + '</pre>' : '') + '</div>';
    }
  }).catch(function (e) {
    Mirage.busy(btn, false);
    box.innerHTML = '<div class="alert alert-danger" style="margin:0">' +
      'توقّف الفحص بخطأ: ' + esc((e && e.message) || e) + '</div>';
  });
}

// الربط بالجافاسكربت لا بـ onclick، حتى يظهر الخطأ إن فشل التحميل
(function () {
  var b = document.getElementById('pingBtn');
  if (b) b.addEventListener('click', checkServer);
})();

/* ─────────── إشعارات الهاتف: تجهيز لمرة واحدة ─────────── */
function pushAdmin() {
  var box = document.getElementById('pushAdminBody');
  if (!box) return;
  Promise.all([Mirage.api('push_status', {}), Mirage.api('push_ping', {})]).then(function (r) {
    var st = r[0], ping = r[1];
    var dbOk = st.status === 'success';
    var fnOk = ping.status === 'success';
    var keysOk = dbOk && st.has_keys;
    var urlOk = dbOk && st.function_url === (MIRAGE_URL + '/functions/v1/send-push');
    var row = function (ok, title, text) {
      return '<div class="check-row" style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border-light)">' +
        '<span style="font-size:18px">' + (ok ? '✅' : '⬜') + '</span>' +
        '<div style="flex:1"><b>' + title + '</b><div class="hint" style="margin:2px 0 0">' + text + '</div></div></div>';
    };
    box.innerHTML =
      row(dbOk, '1. قاعدة البيانات', dbOk ? 'نُفّذ الملف ' + Mirage.ltr('12_push.sql') + '.' : esc(st.message || '') + ' — نفّذ ' + Mirage.ltr('12_push.sql') + ' في SQL Editor.') +
      row(fnOk, '2. الدالة send-push في Supabase', fnOk ? 'منشورة وتستقبل الطلبات.' : esc(ping.message || '') + ' ' + esc(ping.detail || '')) +
      row(keysOk && urlOk, '3. مفاتيح التوقيع ورابط الدالة', keysOk && urlOk
          ? 'جاهزة ومحفوظة في قاعدة البيانات.'
          : 'تُولَّد في متصفحك وتُحفظ في قاعدة البيانات بضغطة واحدة.') +
      (dbOk ? '<div class="hint" style="margin:12px 0">الأجهزة المفعّلة الآن: <b>' + (st.devices || 0) + '</b> لـ <b>' + (st.users || 0) + '</b> مستخدم.</div>' : '') +
      '<div class="btn-row" style="margin-top:12px">' +
        (dbOk && !(keysOk && urlOk) ? '<button class="btn btn-primary btn-sm" id="pushSetupBtn"><span class="btn-text">تجهيز الإشعارات</span><span class="spinner"></span></button>' : '') +
        '<button class="btn btn-ghost btn-sm" onclick="pushAdmin()">إعادة الفحص</button>' +
        (keysOk ? '<button class="btn btn-danger btn-sm" id="pushResetBtn">توليد مفاتيح جديدة</button>' : '') +
      '</div>' +
      (keysOk && urlOk ? '<div style="margin-top:18px"><b>هذا الجهاز</b><div id="pushAdminDevice" style="margin-top:10px"></div></div>' : '');

    if (keysOk && urlOk) Mirage.push.card('pushAdminDevice');
    var setup = document.getElementById('pushSetupBtn');
    if (setup) setup.onclick = function () { pushSetup(setup, false); };
    var reset = document.getElementById('pushResetBtn');
    if (reset) reset.onclick = function () {
      Mirage.confirm('ستُولَّد مفاتيح جديدة وتُلغى اشتراكات كل الأجهزة، فيعيد كل مستخدم تفعيل الإشعارات على جهازه (يتم تلقائياً عند فتح النظام إن كان قد سمح بها). استخدمه فقط إن تسرّبت المفاتيح.')
        .then(function (yes) { if (yes) pushSetup(reset, true); });
    };
  });
}

/** يولّد زوج مفاتيح VAPID في المتصفح ويحفظه — لا يغادر المفتاح الخاص إلا إلى قاعدة بياناتك */
function pushSetup(btn, reset) {
  Mirage.busy(btn, true);
  crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    .then(function (kp) {
      return Promise.all([crypto.subtle.exportKey('raw', kp.publicKey), crypto.subtle.exportKey('jwk', kp.privateKey)]);
    })
    .then(function (k) {
      var jwk = { kty: k[1].kty, crv: k[1].crv, x: k[1].x, y: k[1].y, d: k[1].d };
      return Mirage.api('push_setup', { public: Mirage.push._bytesToB64u(k[0]), private: JSON.stringify(jwk), reset: reset ? '1' : '0' });
    })
    .then(function (res) {
      Mirage.busy(btn, false);
      if (res.status !== 'success') return Mirage.fail(res);
      Mirage.toast(reset ? 'وُلّدت مفاتيح جديدة' : 'جُهّزت إشعارات الهاتف');
      pushAdmin();
    })
    .catch(function (e) { Mirage.busy(btn, false); Mirage.fail({ message: 'تعذّر توليد المفاتيح في هذا المتصفح', raw: String(e) }); });
}
pushAdmin();
