/* ══════════════════════════════════════════════════════════
   إدارة النظام — مسارات العمل ومعاينة من يعتمد
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

function fillStations() {
  var el = document.getElementById('flowStation');
  var heads = LISTS.centerRows.filter(function (c) { return c.head; });
  el.innerHTML = '<option value="">اختر محطة…</option>' +
    '<optgroup label="بحسب مُقدِّم النموذج">' +
      Object.keys(TOKENS).map(function (k) {
        return '<option value="' + k + '">' + esc(TOKENS[k]) + '</option>';
      }).join('') + '</optgroup>' +
    '<optgroup label="رئيس قسم محدد">' +
      LISTS.centerRows.map(function (c) {
        return '<option value="@center:' + esc(c.name) + '">رئيس ' + esc(c.name) +
          (c.head ? ' (' + esc(c.head) + ')' : ' — لم يُحدَّد رئيسه') + '</option>';
      }).join('') + '</optgroup>' +
    '<optgroup label="شخص بعينه">' +
      LISTS.users.map(function (u) {
        return '<option value="user:' + esc(u.real_name) + '">' + esc(u.real_name) +
          (u.job_title ? ' — ' + esc(u.job_title) : '') + '</option>';
      }).join('') + '</optgroup>';
  if (!heads.length) el.title = 'حدّد رؤساء الأقسام من تبويب إعدادات القوائم';
}

function fillFlowUsers() {
  var el = document.getElementById('flowUser'), cur = el.value;
  el.innerHTML = '<option value="">المسار العام — لكل المستخدمين</option>' +
    '<optgroup label="مسار خاص بمستخدم">' + LISTS.users.map(function (u) {
      var has = USER_FLOWS.some(function (f) { return f.username === u.username && f.form === document.getElementById('flowForm').value; });
      return '<option value="' + esc(u.username) + '">' + esc(u.real_name) + (has ? ' ★ له مسار خاص' : '') + '</option>';
    }).join('') + '</optgroup>';
  el.value = cur;

  var pv = document.getElementById('previewUser'), pcur = pv.value;
  pv.innerHTML = '<option value="">اختر مستخدماً…</option>' + LISTS.users.map(function (u) {
    return '<option value="' + esc(u.username) + '">' + esc(u.real_name) + '</option>';
  }).join('');
  pv.value = pcur;
}

function loadFlow() {
  var form = document.getElementById('flowForm').value;
  var user = document.getElementById('flowUser').value;
  var hint = document.getElementById('flowUserHint');
  document.getElementById('dropUserFlow').style.display = 'none';

  if (user) {
    var f = USER_FLOWS.filter(function (x) { return x.username === user && x.form === form; })[0];
    if (f) {
      STATIONS = (f.stations || []).slice();
      hint.textContent = 'لهذا المستخدم مسار خاص يحلّ محلّ المسار العام.';
      document.getElementById('dropUserFlow').style.display = 'inline-flex';
      renderFlow();
      return;
    }
    hint.textContent = 'لا مسار خاص له بعد — المعروض هو المسار العام. عدّله واحفظه ليصبح خاصاً به.';
  } else {
    hint.textContent = 'يُطبَّق على كل من ليس له مسار خاص.';
  }
  Mirage.api('flows_get', { form: form }).then(function (res) {
    if (res.status !== 'success') return Mirage.fail(res);
    STATIONS = (res.stations || []).map(function (x) { return x.station; });
    renderFlow();
  });
}

function renderFlow() {
  var line = document.getElementById('flowLine');
  if (!STATIONS.length) {
    line.innerHTML = '<span style="color:var(--text-muted);font-size:13px">لا محطات — النموذج لن يُحال لأحد.</span>';
    return;
  }
  line.innerHTML = STATIONS.map(function (x, i) {
    return (i ? '<span class="flow-arrow">←</span>' : '') +
      '<span class="flow-step">' + (i + 1) + '. ' + esc(stationText(x)) +
      (i > 0 ? '<button title="تقديم" onclick="moveStation(' + i + ',-1)">↑</button>' : '') +
      '<button title="إزالة" onclick="rmStation(' + i + ')">✕</button></span>';
  }).join('');
  previewRoute();
}

function addStation() {
  var v = document.getElementById('flowStation').value;
  if (!v) return;
  if (STATIONS.indexOf(v) > -1) return Mirage.note('هذه المحطة موجودة في المسار');
  STATIONS.push(v);
  renderFlow();
}

function rmStation(i) { STATIONS.splice(i, 1); renderFlow(); }
function moveStation(i, d) {
  var j = i + d; if (j < 0 || j >= STATIONS.length) return;
  var t = STATIONS[i]; STATIONS[i] = STATIONS[j]; STATIONS[j] = t; renderFlow();
}

function saveFlow() {
  var btn = document.getElementById('saveFlowBtn');
  var form = document.getElementById('flowForm').value;
  var user = document.getElementById('flowUser').value;
  Mirage.busy(btn, true);
  var call = user
    ? Mirage.api('user_flow_save', { username: user, form: form, stations: STATIONS })
    : Mirage.api('flow_save', { form: form, stations: STATIONS });
  call.then(function (res) {
    Mirage.busy(btn, false);
    if (res.status !== 'success') return Mirage.fail(res);
    Mirage.ok((user ? 'حُفظ المسار الخاص' : 'حُفظ المسار العام') + ' بـ ' + res.count + ' محطة');
    loadAll();
  });
}

function dropUserFlow() {
  var user = document.getElementById('flowUser').value;
  if (!user) return;
  Mirage.confirm('سيُحذف المسار الخاص ويعود هذا المستخدم إلى المسار العام.').then(function (yes) {
    if (!yes) return;
    Mirage.api('user_flow_save', { username: user, form: document.getElementById('flowForm').value, stations: [] })
      .then(function (res) {
        if (res.status !== 'success') return Mirage.fail(res);
        Mirage.toast('عاد إلى المسار العام'); loadAll();
      });
  });
}

function paintUserFlows() {
  var rows = USER_FLOWS.map(function (f) {
    var u = LISTS.users.filter(function (x) { return x.username === f.username; })[0];
    return '<tr><td style="font-weight:800">' + esc(u ? u.real_name : f.username) + '</td>' +
      '<td>' + esc(MirageAPI.FORMS[f.form] || f.form) + '</td>' +
      '<td>' + (f.stations || []).map(function (x) { return esc(stationText(x)); }).join(' ← ') + '</td>' +
      '<td><button class="btn btn-ghost btn-sm" onclick="openUserFlow(\'' + esc(f.username) + '\',\'' + esc(f.form) + '\')">تعديل</button></td></tr>';
  });
  document.getElementById('userFlowRows').innerHTML = rows.length ? rows.join('')
    : '<tr><td colspan="4" class="td-empty">لا مسارات خاصة — الجميع على المسار العام.</td></tr>';
}

function openUserFlow(username, form) {
  document.getElementById('flowForm').value = form;
  fillFlowUsers();
  document.getElementById('flowUser').value = username;
  loadFlow();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** المسار المحفوظ محسوباً بأسماء الأشخاص لمستخدم معيّن */
function previewRoute() {
  var user = document.getElementById('previewUser').value || document.getElementById('flowUser').value;
  var box = document.getElementById('previewBox');
  if (!user) { box.innerHTML = '<span class="hint">اختر مستخدماً لمعاينة مساره في النموذج المحدّد أعلاه.</span>'; return; }
  Mirage.api('route_preview', { form: document.getElementById('flowForm').value, username: user }).then(function (res) {
    if (res.status !== 'success') return Mirage.fail(res);
    var u = LISTS.users.filter(function (x) { return x.username === user; })[0];
    box.innerHTML = '<div class="hint" style="margin-bottom:12px">مسار <b>' + esc(u ? u.real_name : user) +
      '</b> المحفوظ في «' + esc(MirageAPI.FORMS[document.getElementById('flowForm').value]) + '»:</div>' +
      Mirage.routeHtml(res.route, -1, false) +
      '<div class="hint" style="margin-top:12px">المحطة التي لا شاغل لها، أو يشغلها مُقدِّم النموذج نفسه، أو تكرّر شخصاً سابقاً، تُتخطّى تلقائياً. ' +
      'التعديلات غير المحفوظة لا تظهر هنا.</div>';
  });
}

document.getElementById('flowForm').onchange = function () { fillFlowUsers(); loadFlow(); };
document.getElementById('flowUser').onchange = loadFlow;
document.getElementById('previewUser').onchange = previewRoute;

/* ─── الإشعارات الموجّهة وسجلّها ─── */
NOTICE_LOG = Mirage.noticeLog('noticeLog');
Mirage.notifyComposer('composer', { onSent: function () { NOTICE_LOG.reload(); } });

/* ─── فحص الاتصال ─── */
