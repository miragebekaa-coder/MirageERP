/* ══════════════════════════════════════════════════════════
   إدارة النظام — الدوام والمواقع وأنواع الإجازات وسياسة الدوام
   ------------------------------------------------------------
   جزء من صفحة admin.html.
   ══════════════════════════════════════════════════════════ */

var SITES = [], LTYPES = [], SITE_EDIT = null;

function attLoad() {
  sitesLoad();
  ltLoad();
  policyLoad();
  Mirage.fillSelect('stProject', (LISTS.projects || []).map(function (p) {
    return { value: p.name || p, text: p.name || p };
  }), '—', '');
}

/* ─────────── المواقع ─────────── */

function resetSite() {
  SITE_EDIT = null;
  ['stName', 'stLat', 'stLng'].forEach(function (i) { document.getElementById(i).value = ''; });
  document.getElementById('stProject').value = '';
  document.getElementById('stMode').value = 'static';
  document.getElementById('stRadius').value = 150;
  document.getElementById('stActive').checked = true;
  document.getElementById('stCycle').value = '30';
  document.getElementById('stOne').checked = true;
  cycleUI();
}

/** الثواني بالعربية: ٣٠ ← «نصف دقيقة» ، ٨٦٤٠٠ ← «يوم» */
function cycleText(sec) {
  sec = Number(sec || 30);
  if (sec === 30) return 'نصف دقيقة';
  if (sec < 60) return Mirage.ltr(String(sec)) + ' ثانية';
  if (sec < 3600) return Mirage.ltr(String(Math.round(sec / 60))) + ' دقيقة';
  if (sec < 86400) return Mirage.ltr(String(Math.round(sec / 3600))) + ' ساعة';
  if (sec === 86400) return 'يوم';
  if (sec === 604800) return 'أسبوع';
  return Mirage.ltr(String(Math.round(sec / 86400))) + ' يوم';
}

/** كلام مفهوم بدل أرقام: ماذا يعني اختيار المدير هنا فعلاً */
function cycleUI() {
  var mode = document.getElementById('stMode').value;
  var row  = document.getElementById('cycleRow');
  if (!row) return;                       // admin.html قديم
  row.style.display = (mode === 'static') ? 'none' : '';
  if (mode === 'static') return;

  var sec  = Number(document.getElementById('stCycle').value || 30);
  var one  = document.getElementById('stOne').checked;
  var txt  = cycleText(sec);

  document.getElementById('cycleNote').innerHTML =
    'يتغيّر الرمز كل <b>' + txt + '</b>، ولا يُقبل الرمز القديم بعدها. ' +
    (sec <= 900
      ? 'اعرضه على شاشة أو جهاز لوحي عند المدخل.'
      : 'اطبعه واستبدله كل ' + txt + ' — اطبع الجديد من زرّ «الرمز».');

  document.getElementById('oneHint').innerHTML = one
    ? (sec <= 900
        ? 'كل حضور أو انصراف أو إجازة يلزمه مسح جديد — وهذا ما تريده.'
        : '<b style="color:#B91C1C">انتبه:</b> مع فترة بهذا الطول، من سجّل حضوره ' +
          'لن يستطيع تسجيل انصرافه إلا بعد تغيّر الرمز. ' +
          'اجعل الفترة ربع ساعة أو أقل، أو أطفئ هذا الخيار.')
    : 'الرمز الواحد يقبل أكثر من تسجيل ما دام صالحاً.';
}

function grabGeo() {
  var btn = document.getElementById('geoBtn');
  if (!navigator.geolocation) return Mirage.fail({ message: 'هذا المتصفح لا يدعم تحديد الموقع' });
  Mirage.busy(btn, true);
  navigator.geolocation.getCurrentPosition(function (pos) {
    Mirage.busy(btn, false);
    document.getElementById('stLat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('stLng').value = pos.coords.longitude.toFixed(6);
    Mirage.toast('التُقطت الإحداثيات (دقّة ' + Math.round(pos.coords.accuracy) + ' م)');
  }, function (e) {
    Mirage.busy(btn, false);
    Mirage.fail({
      message: e.code === 1 ? 'لم تسمح بالوصول إلى موقعك' : 'تعذّر تحديد الموقع',
      detail: 'يمكنك كتابة الإحداثيات يدوياً: افتح خرائط جوجل، اضغط مطوّلاً على مكان الموقع، فتظهر لك.'
    });
  }, { enableHighAccuracy: true, timeout: 15000 });
}

function saveSite() {
  var btn = document.getElementById('stSave');
  var name = document.getElementById('stName').value.trim();
  if (!name) return Mirage.fail({ message: 'اكتب اسم الموقع' });

  Mirage.busy(btn, true);
  Mirage.api('site_save', {
    id: SITE_EDIT ? SITE_EDIT.id : 0,
    name: name,
    project: document.getElementById('stProject').value,
    lat: document.getElementById('stLat').value.trim(),
    lng: document.getElementById('stLng').value.trim(),
    radius: document.getElementById('stRadius').value,
    mode: document.getElementById('stMode').value,
    active: document.getElementById('stActive').checked,
    cycle: document.getElementById('stCycle').value,
    one: document.getElementById('stOne').checked
  }).then(function (res) {
    Mirage.busy(btn, false);
    if (res.status !== 'success') return Mirage.fail(res);
    Mirage.toast(SITE_EDIT ? 'حُدّث الموقع' : 'أُضيف الموقع');
    resetSite();
    sitesLoad();
  });
}

function sitesLoad() {
  var box = document.getElementById('sitesBox');
  box.innerHTML = '<span class="hint">جارٍ التحميل…</span>';
  Mirage.api('sites_list', {}).then(function (res) {
    if (res.status !== 'success') { box.innerHTML = ''; return Mirage.fail(res); }
    SITES = res.sites || [];
    if (!SITES.length) {
      box.innerHTML = '<div class="empty"><span class="ico">📍</span><b>لا مواقع بعد</b>' +
                      'أضِف أول موقع من البطاقة أعلاه.</div>';
      return;
    }
    var modes = { static: 'ثابت دائماً', rotating: 'متجدّد', both: 'الاثنان' };
    box.innerHTML =
      '<div class="table-wrap"><table><thead><tr>' +
      '<th>الموقع</th><th>المشروع</th><th>الرمز</th><th>نوعه</th><th>النطاق</th>' +
      '<th>الإحداثيات</th><th>المسح</th><th>الحالة</th><th></th></tr></thead><tbody>' +
      SITES.map(function (s, i) {
        return '<tr><td><span class="cell-link" onclick="editSite(' + i + ')">' + esc(s.name) + '</span></td>' +
          '<td>' + esc(s.project || '—') + '</td>' +
          '<td><code style="direction:ltr;font-weight:900">' + esc(s.code) + '</code></td>' +
          '<td><span class="tag tag-blue">' + esc(modes[s.mode] || s.mode) + '</span>' +
            (s.mode === 'static' ? '' :
              '<div style="font-size:11px;color:#64748B;margin-top:3px">كل ' +
              cycleText(s.cycle) + (s.one === false ? '' : ' · مسحة لكل تسجيل') + '</div>') +
          '</td>' +
          '<td>' + Mirage.ltr(String(s.radius)) + ' م</td>' +
          '<td style="direction:ltr;font-size:11.5px;color:#64748B">' +
            (s.lat ? Number(s.lat).toFixed(4) + ', ' + Number(s.lng).toFixed(4)
                   : '<span style="color:#B91C1C">غير محدّدة</span>') + '</td>' +
          '<td>' + Mirage.ltr(String(s.scans)) + '</td>' +
          '<td>' + (s.active ? '<span class="tag tag-green">فعّال</span>'
                             : '<span class="tag tag-gray">موقوف</span>') + '</td>' +
          '<td style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" onclick="printQR(' + i + ')">🖨️ الرمز</button> ' +
            (s.mode !== 'static'
              ? '<button class="btn btn-primary btn-sm" onclick="liveQR(' + i + ')">📺 الشاشة</button> ' : '') +
            '<button class="btn btn-danger btn-sm" onclick="dropSite(' + i + ')">حذف</button>' +
          '</td></tr>';
      }).join('') + '</tbody></table></div>';
  });
}

function editSite(i) {
  var s = SITES[i]; if (!s) return;
  SITE_EDIT = s;
  document.getElementById('stName').value = s.name;
  document.getElementById('stProject').value = s.project || '';
  document.getElementById('stMode').value = s.mode;
  document.getElementById('stLat').value = s.lat === null ? '' : s.lat;
  document.getElementById('stLng').value = s.lng === null ? '' : s.lng;
  document.getElementById('stRadius').value = s.radius;
  document.getElementById('stActive').checked = s.active;
  var cy = document.getElementById('stCycle'), v = String(s.cycle || 30);
  // فترة محفوظة ليست من الفترات الجاهزة: تُضاف كي لا تُفقد عند التعديل
  if (!Array.prototype.some.call(cy.options, function (o) { return o.value === v; })) {
    cy.insertAdjacentHTML('beforeend',
      '<option value="' + esc(v) + '">' + esc(cycleText(s.cycle)) + '</option>');
  }
  cy.value = v;
  document.getElementById('stOne').checked = s.one !== false;
  cycleUI();
  document.getElementById('stName').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function dropSite(i) {
  var s = SITES[i]; if (!s) return;
  Mirage.confirm('سيُحذف موقع «' + s.name + '» نهائياً.', 'حذف موقع').then(function (yes) {
    if (!yes) return;
    Mirage.api('site_delete', { id: s.id }).then(function (res) {
      if (res.status !== 'success') return Mirage.fail(res);
      Mirage.toast('حُذف الموقع'); sitesLoad();
    });
  });
}

/* ─────────── الرمز المطبوع ─────────── */

function qrSvg(text, size) {
  var q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: Math.max(4, Math.floor((size || 260) / q.getModuleCount())), margin: 2 });
}

function siteUrl(code, token) {
  var base = location.href.replace(/[^/]*$/, '');
  return base + 'checkin.html?s=' + encodeURIComponent(code) + (token ? '&t=' + token : '');
}

function printQR(i) {
  var s = SITES[i]; if (!s) return;
  var url = siteUrl(s.code);
  var html =
    '<div style="text-align:center;direction:rtl">' +
      '<div id="qrHere" style="display:flex;justify-content:center;margin-bottom:12px">' +
        qrSvg(url, 240) + '</div>' +
      '<div style="font-size:16px;font-weight:900;color:#0F172A">' + esc(s.name) + '</div>' +
      '<div style="font-size:12.5px;color:#64748B;margin-top:4px">رمز الموقع: <b style="direction:ltr;display:inline-block">' +
        esc(s.code) + '</b></div>' +
      (s.mode === 'rotating'
        ? '<div class="alert alert-warn" style="text-align:right;margin-top:12px;font-size:12.5px">' +
          'هذا الموقع مضبوط على <b>الرمز المتجدّد كل ' + cycleText(s.cycle) + '</b> — ' +
          'فالمطبوع الثابت لن يُقبل. اطبع الرمز المتجدّد من زرّ «الشاشة»، ' +
          'أو اجعل النوع «الاثنان» ليعمل المطبوع أيضاً.</div>'
        : '') +
    '</div>';

  Swal.fire({
    title: 'رمز الموقع',
    html: html, width: 420,
    showCancelButton: true,
    confirmButtonText: '🖨️ طباعة',
    cancelButtonText: 'إغلاق',
    confirmButtonColor: '#2563EB', cancelButtonColor: '#64748B'
  }).then(function (r) { if (r.isConfirmed) printSheet(s); });
}

/** ورقة جاهزة للتعليق: الرمز كبيراً واسم الموقع وتعليمات قصيرة */
function printSheet(s, url, extra) {
  var area = document.getElementById('printArea') || (function () {
    var d = document.createElement('div'); d.id = 'printArea'; document.body.appendChild(d); return d;
  })();
  area.innerHTML =
    '<div style="text-align:center;padding:40px 20px;font-family:Tajawal,sans-serif;direction:rtl">' +
      '<div style="font-size:30px;font-weight:900;color:#0F172A;margin-bottom:6px">' + esc(s.name) + '</div>' +
      '<div style="font-size:16px;color:#475569;font-weight:700;margin-bottom:26px">' +
        esc(s.project || '') + '</div>' +
      '<div style="display:flex;justify-content:center">' +
        qrSvg(url || siteUrl(s.code), 420) + '</div>' +
      '<div style="font-size:22px;font-weight:900;margin-top:26px;color:#0F172A">تسجيل الدوام</div>' +
      '<div style="font-size:15px;color:#475569;line-height:2;margin-top:10px">' +
        'وجّه كاميرا هاتفك إلى الرمز، فتفتح صفحة ميراج<br>' +
        'واختر: تسجيل الدوام · إجازة سنوية · إجازة مرضية' +
      '</div>' +
      (extra ? '<div style="font-size:14px;font-weight:800;color:#B91C1C;margin-top:14px">' +
               esc(extra) + '</div>' : '') +
      '<div style="font-size:12px;color:#94A3B8;margin-top:22px;direction:ltr">' + esc(s.code) + '</div>' +
    '</div>';
  var t = document.querySelector('.swal2-container');
  if (t) t.style.display = 'none';
  window.print();
  setTimeout(function () { area.innerHTML = ''; if (t) t.style.display = ''; Swal.close(); }, 400);
}

/* ─────────── شاشة الرمز المتجدّد ─────────── */

var LIVE = null, LIVE_NOW = null;

function liveQR(i) {
  var s = SITES[i]; if (!s) return;
  if (LIVE) { clearInterval(LIVE); LIVE = null; }

  Swal.fire({
    title: s.name,
    html: '<div style="text-align:center;direction:rtl">' +
            '<div id="liveQR" style="display:flex;justify-content:center;min-height:250px;' +
              'align-items:center"><span class="hint">جارٍ التوليد…</span></div>' +
            '<div style="font-size:22px;font-weight:900;color:#0F172A;margin-top:10px" id="liveLeft"></div>' +
            '<p style="font-size:12.5px;color:#64748B;line-height:1.9;margin:10px 0 0">' +
              'ارفع الشاشة أمام الموظفين. الرمز يتغيّر كل <b>' + cycleText(s.cycle) +
              '</b>، فلا ينفع تصويره.<br>' +
              (Number(s.cycle || 30) >= 3600
                ? 'ويمكنك طباعة هذا الرمز وتعليقه، على أن تستبدله كل ' + cycleText(s.cycle) + '.'
                : 'وأبقِ هذه النافذة مفتوحة ما دام التسجيل جارياً.') +
            '</p>' +
            '<div style="margin-top:10px">' +
              '<button class="btn btn-ghost btn-sm" type="button" onclick="printLive()">🖨️ طباعة الرمز الحالي</button>' +
            '</div></div>',
    width: 460,
    showConfirmButton: false,
    showCloseButton: true,
    allowOutsideClick: false,
    didClose: function () { if (LIVE) { clearInterval(LIVE); LIVE = null; } }
  });

  var pull = function () {
    Mirage.api('attend_code', { id: s.id }).then(function (res) {
      var box = document.getElementById('liveQR');
      if (!box) { if (LIVE) { clearInterval(LIVE); LIVE = null; } return; }
      if (res.status !== 'success') { box.innerHTML = '<span class="hint">' + esc(res.message) + '</span>'; return; }
      box.innerHTML = qrSvg(siteUrl(res.code, res.token), 250);
      LIVE_NOW = { site: s, code: res.code, token: res.token, cycle: res.cycle };
      var left = res.left;
      var lbl = document.getElementById('liveLeft');
      if (lbl) lbl.textContent = '⏳ ' + left + ' ثانية';
      var tick = setInterval(function () {
        left--;
        var l = document.getElementById('liveLeft');
        if (!l) return clearInterval(tick);
        if (left <= 0) return clearInterval(tick);
        l.textContent = left > 120
          ? '⏳ يتجدّد بعد ' + Math.ceil(left / 60) + ' دقيقة'
          : '⏳ ' + left + ' ثانية';
      }, 1000);

      // نُعيد السؤال قبيل انقلاب الدورة، ولا نُتعب الخادم في الدورات الطويلة
      if (LIVE) { clearInterval(LIVE); }
      LIVE = setInterval(pull, Math.min(Math.max((res.left - 1) * 1000, 3000), 60000));
    });
  };
  pull();
}

/** طباعة الرمز المعروض الآن — للمواقع التي تتجدّد كل ساعة أو أكثر */
function printLive() {
  if (!LIVE_NOW) return;
  var s = LIVE_NOW.site;
  printSheet(s, siteUrl(LIVE_NOW.code, LIVE_NOW.token),
             'صالح ' + cycleText(LIVE_NOW.cycle) + ' من لحظة الطباعة');
}

/* ─────────── أنواع الإجازات ─────────── */

function ltLoad() {
  var box = document.getElementById('ltBox');
  box.innerHTML = '<span class="hint">جارٍ التحميل…</span>';
  Mirage.api('leave_types', {}).then(function (res) {
    if (res.status !== 'success') { box.innerHTML = ''; return Mirage.fail(res); }
    LTYPES = res.types || [];
    box.innerHTML =
      '<div class="table-wrap"><table><thead><tr>' +
      '<th>النوع</th><th>الرصيد السنوي</th><th>مدفوعة</th><th>يراها الموظف</th>' +
      '<th>السبب إلزامي</th><th></th></tr></thead><tbody>' +
      LTYPES.map(function (t, i) {
        return '<tr><td><b>' + esc(t.name) + '</b></td>' +
          '<td>' + (t.quota > 0 ? Mirage.ltr(String(t.quota)) + ' يوماً'
                                : '<span class="hint">بلا سقف</span>') + '</td>' +
          '<td>' + (t.paid ? '<span class="tag tag-green">نعم</span>'
                           : '<span class="tag tag-gray">لا</span>') + '</td>' +
          '<td>' + (t.self ? '<span class="tag tag-blue">نعم</span>'
                           : '<span class="tag tag-gray">لا</span>') + '</td>' +
          '<td>' + (t.needs_note ? 'نعم' : '—') + '</td>' +
          '<td style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" onclick="ltEdit(' + i + ')">تعديل</button> ' +
            '<button class="btn btn-danger btn-sm" onclick="ltDrop(' + i + ')">حذف</button>' +
          '</td></tr>';
      }).join('') + '</tbody></table></div>';
  });
}

function ltNew() { ltForm({ name: '', quota: 0, paid: true, self: true, needs_note: false, sort: 50 }); }
function ltEdit(i) { if (LTYPES[i]) ltForm(LTYPES[i], true); }

function ltForm(t, editing) {
  Swal.fire({
    title: editing ? 'تعديل ' + t.name : 'نوع إجازة جديد',
    html:
      '<div style="text-align:right;direction:rtl">' +
        '<label style="font-size:13px;font-weight:800;display:block;margin-bottom:4px">الاسم</label>' +
        '<input type="text" id="ltName" class="swal2-input" style="margin:0 0 12px;width:100%" ' +
          'value="' + esc(t.name) + '"' + (editing ? ' readonly' : '') + '>' +
        '<label style="font-size:13px;font-weight:800;display:block;margin-bottom:4px">' +
          'الرصيد السنوي بالأيام (صفر = بلا سقف)</label>' +
        '<input type="number" id="ltQuota" class="swal2-input" style="margin:0 0 12px;width:100%" ' +
          'min="0" value="' + t.quota + '">' +
        '<label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13.5px">' +
          '<input type="checkbox" id="ltPaid"' + (t.paid ? ' checked' : '') + '> مدفوعة الأجر</label>' +
        '<label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13.5px">' +
          '<input type="checkbox" id="ltSelf"' + (t.self ? ' checked' : '') + '> تظهر للموظف عند مسح الرمز</label>' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:13.5px">' +
          '<input type="checkbox" id="ltNote"' + (t.needs_note ? ' checked' : '') + '> السبب إلزامي</label>' +
      '</div>',
    width: 460,
    showCancelButton: true,
    confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
    confirmButtonColor: '#2563EB', cancelButtonColor: '#64748B',
    focusConfirm: false,
    preConfirm: function () {
      var n = document.getElementById('ltName').value.trim();
      if (!n) { Swal.showValidationMessage('اكتب اسم النوع'); return false; }
      return {
        name: n,
        quota: document.getElementById('ltQuota').value,
        paid: document.getElementById('ltPaid').checked,
        self: document.getElementById('ltSelf').checked,
        needs_note: document.getElementById('ltNote').checked,
        sort: t.sort || 50
      };
    }
  }).then(function (r) {
    if (!r.isConfirmed) return;
    Mirage.api('leave_type_save', r.value).then(function (res) {
      if (res.status !== 'success') return Mirage.fail(res);
      Mirage.toast('حُفظ النوع'); ltLoad();
    });
  });
}

function ltDrop(i) {
  var t = LTYPES[i]; if (!t) return;
  Mirage.confirm('سيُحذف نوع «' + t.name + '».', 'حذف نوع إجازة').then(function (yes) {
    if (!yes) return;
    Mirage.api('leave_type_delete', { name: t.name }).then(function (res) {
      if (res.status !== 'success') return Mirage.fail(res);
      Mirage.toast('حُذف النوع'); ltLoad();
    });
  });
}

/* ─────────── سياسة الدوام ─────────── */

function policyLoad() {
  // admin.html قديم على الخادم بينما attend.js جديد — يُقال صراحةً لا صامتاً
  if (!document.getElementById('wpOut')) {
    var card = document.getElementById('wpSave');
    if (card && card.parentNode) {
      card.parentNode.insertAdjacentHTML('beforebegin',
        '<div class="alert alert-warn" style="text-align:right">' +
          '<b>ملف admin.html على الخادم قديم</b><br>' +
          'حقول «ضبط النطاق وكشف التجاوز» موجودة في نسخة الترقية ٢٨. ' +
          'ارفع admin.html الجديد فوق القديم ثم حدّث الصفحة بـ Ctrl+F5.' +
        '</div>');
    }
    return;
  }

  Mirage.api('work_policy', {}).then(function (res) {
    var p = (res && res.policy) || {};
    if (p.daily) document.getElementById('wpDaily').value = p.daily;
    if (p.week_days) document.getElementById('wpDays').value = p.week_days;
    if (p.grace !== undefined) document.getElementById('wpGrace').value = p.grace;
    if (p.gap !== undefined) document.getElementById('wpGap').value = p.gap;
    if (p.max_shift) document.getElementById('wpMax').value = p.max_shift;
    document.getElementById('wpLoc').checked = p.require_location !== false;

    document.getElementById('wpOut').value = p.outside || 'block';
    if (p.max_acc !== undefined) document.getElementById('wpAcc').value = p.max_acc;
    if (p.max_speed !== undefined) document.getElementById('wpSpeed').value = p.max_speed;
    document.getElementById('wpDev').checked    = p.device_guard !== false;
    document.getElementById('wpLvOut').checked  = p.leave_outside !== false;
    document.getElementById('wpNotify').checked = p.notify_flags !== false;
  });
}

function policySave() {
  var btn = document.getElementById('wpSave');
  Mirage.busy(btn, true);
  Mirage.api('work_policy_save', {
    daily: document.getElementById('wpDaily').value,
    week_days: document.getElementById('wpDays').value,
    grace: document.getElementById('wpGrace').value,
    gap: document.getElementById('wpGap').value,
    max_shift: document.getElementById('wpMax').value,
    require_location: document.getElementById('wpLoc').checked,
    outside: document.getElementById('wpOut').value,
    max_acc: document.getElementById('wpAcc').value,
    max_speed: document.getElementById('wpSpeed').value,
    device_guard: document.getElementById('wpDev').checked,
    leave_outside: document.getElementById('wpLvOut').checked,
    notify_flags: document.getElementById('wpNotify').checked
  }).then(function (res) {
    Mirage.busy(btn, false);
    if (res.status !== 'success') return Mirage.fail(res);
    Mirage.toast('حُفظت سياسة الدوام');
  });
}

document.querySelector('.tab[data-tab="att"]').addEventListener('click', function () {
  if (!SITES.length && !LTYPES.length) attLoad();
});
