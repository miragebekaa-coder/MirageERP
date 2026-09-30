/* ══════════════════════════════════════════════════════════
   إدارة النظام — صحّة النظام: الترقيات وسجلّ الأعطال
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

/* ═══════════════ صحّة النظام ═══════════════ */

var LAST_STEP = 26;   /* آخر ترقية يعرفها هذا الإصدار من الواجهة */

function healthLoad() {
  var box = document.getElementById('verBox');
  box.innerHTML = '<span class="hint">جارٍ التحميل…</span>';
  Mirage.api('schema_version', {}).then(function (res) {
    var steps = (res && res.steps) || [];
    var last = (res && res.last) || 0;
    var ok = last >= LAST_STEP;

    box.innerHTML =
      '<div class="alert alert-' + (ok ? 'success' : 'warn') + '" style="margin:0 0 14px">' +
        (ok
          ? 'قاعدتك محدَّثة بالكامل — آخر ترقية منفَّذة: ' + Mirage.ltr(String(last)) + '.'
          : 'ينقص قاعدتك ترقيات. آخر منفَّذة: ' + Mirage.ltr(String(last || 0)) +
            '، والمطلوب: ' + Mirage.ltr(String(LAST_STEP)) +
            '. نفّذ الملفات الناقصة من مجلد «not in system» بالترتيب.') +
      '</div>' +
      (steps.length
        ? '<div class="table-wrap"><table><thead><tr><th>الترقية</th><th>ما أضافته</th>' +
          '<th>تاريخ التنفيذ</th></tr></thead><tbody>' +
          steps.map(function (x) {
            return '<tr><td>' + Mirage.ltr(String(x.step)) + '</td><td>' + esc(x.title) + '</td>' +
                   '<td style="white-space:nowrap">' + Mirage.ltr(x.at) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="hint">جدول الترقيات غير موجود — نفّذ ملف الترقية ٢٦.</p>');
  });
}

function errLoad() {
  var box = document.getElementById('errBox');
  box.innerHTML = '<span class="hint">جارٍ التحميل…</span>';
  Mirage.api('errors_list', { limit: 100 }).then(function (res) {
    if (res.status !== 'success') { box.innerHTML = ''; return Mirage.fail(res); }
    ERRS = res.items || [];
    if (!ERRS.length) {
      box.innerHTML = '<div class="empty"><span class="ico">✅</span><b>لا أعطال مسجّلة</b>' +
                      'لم يقع خطأ عند أحد منذ آخر تفريغ.</div>';
      return;
    }
    var kinds = { js: 'سكربت', api: 'خادم', promise: 'طلب' };
    box.innerHTML =
      '<div class="table-wrap"><table><thead><tr>' +
      '<th>التاريخ</th><th>المستخدم</th><th>الصفحة</th><th>النوع</th><th>العطل</th><th></th>' +
      '</tr></thead><tbody>' +
      ERRS.map(function (e, i) {
        return '<tr><td style="white-space:nowrap">' + Mirage.ltr(e.at) + '</td>' +
          '<td>' + esc(e.who) + '</td><td>' + esc(e.page) + '</td>' +
          '<td><span class="tag tag-gray">' + esc(kinds[e.kind] || e.kind) + '</span></td>' +
          '<td>' + esc(e.message.slice(0, 90)) + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" onclick="errOne(' + i + ')">تفصيل</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="hint" style="margin-top:10px">' + Mirage.ltr(String(ERRS.length)) + ' عطلاً مسجّلاً</p>';
  });
}

var ERRS = [];
function errOne(i) {
  var e = ERRS[i]; if (!e) return;
  Swal.fire({
    title: 'تفصيل العطل',
    html: '<div style="text-align:right;direction:rtl;font-size:13.5px;line-height:1.9">' +
            '<b>' + esc(e.message) + '</b><br>' +
            '<span style="color:#64748B">' + esc(e.who) + ' · ' + esc(e.page) + ' · ' +
            Mirage.ltr(e.at) + '</span>' +
            (e.detail ? '<pre style="direction:ltr;text-align:left;white-space:pre-wrap;font-size:11px;' +
              'background:#F1F5F9;padding:10px;border-radius:8px;margin-top:12px;max-height:220px;' +
              'overflow:auto">' + esc(e.detail) + '</pre>' : '') +
            (e.agent ? '<p style="font-size:11px;color:#94A3B8;direction:ltr;text-align:left;margin-top:8px">' +
              esc(e.agent) + '</p>' : '') +
          '</div>',
    width: 620, confirmButtonText: 'إغلاق', confirmButtonColor: '#2563EB'
  });
}

function errClear() {
  Mirage.confirm('سيُمحى سجلّ الأعطال كله. لا يمسّ هذا بيانات النظام.', 'تفريغ السجلّ')
    .then(function (yes) {
      if (!yes) return;
      Mirage.api('errors_clear', { days: 0 }).then(function (res) {
        if (res.status !== 'success') return Mirage.fail(res);
        Mirage.toast('حُذف ' + res.deleted + ' سطراً'); errLoad();
      });
    });
}

document.querySelector('.tab[data-tab="hl"]').addEventListener('click', function () {
  healthLoad(); errLoad();
});
