/* ══════════════════════════════════════════════════════════
   إدارة النظام — الاستيراد والتصدير بإكسل
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

/* ═══════════════ استيراد وتصدير ═══════════════ */

/* أسماء الأوراق وأعمدتها: الاسم العربي في الملف ← المفتاح الذي يفهمه الخادم */
var SH_EMP = 'الموظفون';
var SH_USR = 'المستخدمون';
var SH_REF = 'القيم المسموحة';

var EMP_COLS = {
  'الرقم الوظيفي': 'id', 'الاسم': 'name', 'الوظيفة': 'job', 'المشروع': 'project',
  'المركز أو القسم': 'center', 'تاريخ التوظيف': 'hire_date', 'تاريخ بدء التدريب': 'training_start',
  'ساعات العمل': 'hours', 'الجنسية': 'nationality', 'رقم الهوية': 'national_id',
  'الهاتف': 'phone', 'المسؤول المباشر': 'supervisor', 'الحالة': 'state', 'ملاحظات': 'notes'
};
var USR_COLS = {
  'اسم المستخدم': 'username', 'الاسم الكامل': 'real_name', 'المسمى الوظيفي': 'job_title',
  'المركز أو القسم': 'center', 'الصلاحية والدور': 'role', 'يتبع لـ': 'manager',
  'المشروع': 'project', 'مستوى الصلاحية': 'access_level', 'الحالة': 'state',
  'يرسل إشعارات': 'can_notify', 'الصفحات المسموحة': 'pages',
  'الرقم الوظيفي': 'emp_id', 'كلمة المرور': 'password'
};

var IMP = null;   /* { emp: [], usr: [] } بعد قراءة الملف */

function ioStamp() { return Mirage.today().replace(/-/g, ''); }

function ioFail(e) {
  Mirage.fail({ message: (e && e.message) || 'تعذّر تنفيذ العملية', raw: String(e) });
}

/** يحوّل صفوف الورقة إلى مفاتيح الخادم، ويتجاهل الأعمدة الزائدة */
function mapRows(rows, cols) {
  return (rows || []).map(function (r) {
    var o = {};
    Object.keys(cols).forEach(function (ar) {
      var v = r[ar];
      if (v === undefined || v === null) v = '';
      o[cols[ar]] = String(v).trim();
    });
    return o;
  }).filter(function (o) {
    return Object.keys(o).some(function (k) { return o[k] !== ''; });
  });
}

function exportSheet(what) {
  var btn = document.getElementById(what === 'emp' ? 'exEmp' : what === 'usr' ? 'exUsr' : 'exAll');
  Mirage.busy(btn, true);

  var jobs = [];
  if (what !== 'usr') jobs.push(Mirage.api('export_employees', {}));
  if (what !== 'emp') jobs.push(Mirage.api('export_users', {}));

  Promise.all(jobs).then(function (res) {
    for (var i = 0; i < res.length; i++) {
      if (res[i].status !== 'success') { Mirage.busy(btn, false); return Mirage.fail(res[i]); }
    }
    var sheets = [];
    if (what !== 'usr') sheets.push({ name: SH_EMP, header: Object.keys(EMP_COLS).concat(['أدخلها', 'تاريخ الإدخال']), rows: res[0].rows });
    if (what !== 'emp') sheets.push({ name: SH_USR, header: Object.keys(USR_COLS).filter(function (h) { return h !== 'كلمة المرور'; }).concat(['تاريخ الإنشاء']), rows: res[what === 'usr' ? 0 : 1].rows });

    var nm = what === 'emp' ? 'الموظفون' : what === 'usr' ? 'المستخدمون' : 'بيانات_ميراج';
    return Mirage.saveXlsx(sheets, nm + '-' + ioStamp() + '.xlsx').then(function () {
      Mirage.busy(btn, false);
      Mirage.toast('نُزِّل الملف');
    });
  }).catch(function (e) { Mirage.busy(btn, false); ioFail(e); });
}

function downloadTemplate() {
  var btn = document.getElementById('tplBtn');
  Mirage.busy(btn, true);

  Mirage.api('import_lists', {}).then(function (res) {
    if (res.status !== 'success') { Mirage.busy(btn, false); return Mirage.fail(res); }
    var L = res.lists || {};

    /* ورقة القيم المسموحة: كل قائمة عمود، تُنسخ منه القيمة كما هي */
    var cols = [
      ['المشروع', L.projects || []], ['المركز أو القسم', L.centers || []],
      ['الوظيفة / المسمى الوظيفي', L.jobs || []], ['الصلاحية والدور', L.roles || []],
      ['مستوى الصلاحية', L.levels || []], ['المسؤول المباشر (مستخدمو النظام)', L.people || []],
      ['الحالة', L.states || []]
    ];
    var high = cols.reduce(function (m, c) { return Math.max(m, c[1].length); }, 0);
    var ref = [];
    for (var i = 0; i < high; i++) {
      var row = {};
      cols.forEach(function (c) { row[c[0]] = c[1][i] || ''; });
      ref.push(row);
    }

    var guide = [
      { 'التعليمات': '١ — لا تغيّر أسماء الأوراق («' + SH_EMP + '» و«' + SH_USR + '») ولا عناوين الأعمدة.' },
      { 'التعليمات': '٢ — اكتب سطراً لكل شخص تحت العناوين مباشرة، وابدأ من السطر الثاني.' },
      { 'التعليمات': '٣ — في ورقة «' + SH_EMP + '»: «الاسم» إلزامي. واترك «الرقم الوظيفي» فارغاً للجديد ليُولَّد تلقائياً.' },
      { 'التعليمات': '٤ — في ورقة «' + SH_USR + '»: «اسم المستخدم» و«الاسم الكامل» إلزاميان، و«كلمة المرور» للحساب الجديد وحده.' },
      { 'التعليمات': '٥ — اسم المستخدم حروف إنكليزية صغيرة وأرقام بلا مسافات، مثل ahmad.m' },
      { 'التعليمات': '٦ — التواريخ هكذا: 2026-01-25 · ساعات العمل رقم بين 1 و 24 · «يرسل إشعارات»: نعم أو لا.' },
      { 'التعليمات': '٧ — المشروع والقسم والوظيفة والصلاحية: انسخها من ورقة «' + SH_REF + '» حرفاً بحرف.' },
      { 'التعليمات': '٨ — مستوى الصلاحية: اكتب الرقم وحده (0 أو 1 أو 2 …).' },
      { 'التعليمات': '٩ — إعادة استيراد الملف نفسه لا تُنشئ نسخة ثانية: الموجود يُحدَّث والجديد يُضاف.' },
      { 'التعليمات': '١٠ — الفحص لا يكتب شيئاً في النظام؛ الكتابة تتم بزر «تنفيذ الاستيراد» وحده.' }
    ];

    var sheets = [
      { name: SH_EMP, header: Object.keys(EMP_COLS), rows: [] },
      { name: SH_USR, header: Object.keys(USR_COLS), rows: [] },
      { name: SH_REF, header: cols.map(function (c) { return c[0]; }), rows: ref, widths: [22, 22, 26, 20, 24, 30, 12] },
      { name: 'التعليمات', header: ['التعليمات'], rows: guide, widths: [110] }
    ];

    return Mirage.saveXlsx(sheets, 'نموذج_استيراد_ميراج-' + ioStamp() + '.xlsx').then(function () {
      Mirage.busy(btn, false);
      Mirage.ok('نُزِّل النموذج. املأ ورقتَي «' + SH_EMP + '» و«' + SH_USR + '» ثم ارفعه في خانة الاستيراد.', 'جاهز');
    });
  }).catch(function (e) { Mirage.busy(btn, false); ioFail(e); });
}

function pickFile() {
  var f = document.getElementById('impFile').files[0];
  var box = document.getElementById('impBox');
  IMP = null;
  document.getElementById('impCheck').disabled = true;
  document.getElementById('impApply').disabled = true;
  if (!f) { box.innerHTML = ''; return; }

  box.innerHTML = '<span class="hint">جارٍ قراءة الملف…</span>';
  Mirage.readXlsx(f).then(function (sheets) {
    var emp = mapRows(sheets[SH_EMP], EMP_COLS);
    var usr = mapRows(sheets[SH_USR], USR_COLS);

    if (!sheets[SH_EMP] && !sheets[SH_USR]) {
      box.innerHTML = '<div class="alert alert-warn">لم أجد ورقة باسم «' + SH_EMP + '» ولا «' + SH_USR +
        '». نزّل النموذج من الأعلى واكتب بياناتك فيه.</div>';
      return;
    }
    if (!emp.length && !usr.length) {
      box.innerHTML = '<div class="alert alert-warn">الملف مقروء لكنه بلا بيانات.</div>';
      return;
    }

    IMP = { emp: emp, usr: usr, name: f.name };
    document.getElementById('impCheck').disabled = false;
    box.innerHTML = '<div class="alert alert-info">قُرئ الملف: <b>' + esc(f.name) + '</b> — ' +
      'الموظفون: ' + emp.length + ' سطراً · المستخدمون: ' + usr.length + ' سطراً. ' +
      'اضغط «فحص الملف» قبل التنفيذ.</div>';
  }).catch(function (e) { box.innerHTML = ''; ioFail(e); });
}

function runImport(apply) {
  if (!IMP) return Mirage.note('اختر ملف إكسل أولاً.');
  var btn = document.getElementById(apply ? 'impApply' : 'impCheck');
  var add = document.getElementById('impAdd').checked;

  var go = apply
    ? Mirage.confirm('سيُكتب في قاعدة البيانات الآن: الموجود يُحدَّث والجديد يُضاف. ' +
                     'راجِع نتيجة الفحص قبل المتابعة.', 'تأكيد الاستيراد')
    : Promise.resolve(true);

  go.then(function (yes) {
    if (!yes) return;
    Mirage.busy(btn, true);

    var jobs = [];
    if (IMP.emp.length) jobs.push(Mirage.api('import_employees', { rows: IMP.emp, apply: apply, add_missing: add }));
    if (IMP.usr.length) jobs.push(Mirage.api('import_users', { rows: IMP.usr, apply: apply, add_missing: add }));

    return Promise.all(jobs).then(function (res) {
      Mirage.busy(btn, false);
      for (var i = 0; i < res.length; i++) {
        if (res[i].status !== 'success') return Mirage.fail(res[i]);
      }
      var parts = [];
      var k = 0;
      if (IMP.emp.length) parts.push({ title: 'الموظفون', r: res[k++] });
      if (IMP.usr.length) parts.push({ title: 'المستخدمون', r: res[k++] });

      paintImport(parts, apply);

      var errs = parts.reduce(function (a, p) { return a + p.r.errors; }, 0);
      if (!apply) {
        document.getElementById('impApply').disabled = (errs > 0 && parts.every(function (p) {
          return p.r.inserted + p.r.updated === 0;
        }));
        if (errs) {
          Mirage.note('فيه ' + errs + ' سطراً لا يمكن استيراده — صحّحها في الملف ثم أعد الفحص. ' +
                      'وإن نفّذت الآن فستُستورَد السطور السليمة وحدها.', 'نتيجة الفحص');
        } else {
          Mirage.ok('الملف سليم بالكامل. اضغط «تنفيذ الاستيراد».', 'نتيجة الفحص');
        }
      } else {
        document.getElementById('impApply').disabled = true;
        Mirage.ok('تم الاستيراد.' + (errs ? ' وبقي ' + errs + ' سطراً لم يُستورَد — راجع الجدول.' : ''), 'تم');
        loadAll();
      }
    });
  }).catch(function (e) { Mirage.busy(btn, false); ioFail(e); });
}

function paintImport(parts, applied) {
  var h = '';
  parts.forEach(function (p) {
    var r = p.r;
    h += '<div class="card" style="margin-bottom:14px">' +
         '<div class="card-head"><div><h2>' + esc(p.title) + '</h2>' +
         '<p>' + (applied ? 'ما نُفِّذ فعلاً' : 'ما سيحدث عند التنفيذ — لم يُكتب شيء بعد') + '</p></div></div>' +
         '<div class="btn-row" style="gap:18px;flex-wrap:wrap">' +
         '<span class="tag tag-green">' + (applied ? 'أُضيف' : 'سيُضاف') + ': ' + r.inserted + '</span>' +
         '<span class="tag tag-blue">' + (applied ? 'حُدِّث' : 'سيُحدَّث') + ': ' + r.updated + '</span>' +
         '<span class="tag ' + (r.errors ? 'tag-red' : 'tag-gray') + '">مرفوض: ' + r.errors + '</span>' +
         '<span class="hint">من أصل ' + r.total + ' سطراً</span></div>';

    if (r.added.length) {
      var uniq = {};
      r.added.forEach(function (a) { uniq[a.list + ' → ' + a.value] = 1; });
      h += '<p class="hint" style="margin-top:12px">' +
           (applied ? 'أُضيفت إلى القوائم: ' : 'ستُضاف إلى القوائم: ') +
           esc(Object.keys(uniq).join(' · ')) + '</p>';
    }

    if (r.rows.length) {
      h += '<div class="table-wrap" style="margin-top:12px"><table><thead><tr>' +
           '<th>السطر</th><th>الاسم</th><th>سبب الرفض</th></tr></thead><tbody>' +
           r.rows.map(function (x) {
             return '<tr><td>' + (x.row || '—') + '</td><td>' + esc(x.name) + '</td>' +
                    '<td>' + esc(x.message) + '</td></tr>';
           }).join('') + '</tbody></table></div>';
    }
    h += '</div>';
  });
  document.getElementById('impBox').innerHTML = h;
}
