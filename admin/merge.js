/* ══════════════════════════════════════════════════════════
   إدارة النظام — توحيد البيانات والقيم المعلّقة
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

var MERGE_SRC = {
  roles: 'roles', jobs: 'jobs', centers: 'centers',
  projects: 'projects', subjects: 'subjects', people: 'people', employees: 'employees'
};

/** ينقلك إلى تبويب التوحيد بالقيمة جاهزة */
function goMerge(list, value) {
  document.querySelector('.tab[data-tab="merge"]').click();
  if (MERGE_SRC[list]) document.getElementById('mgList').value = list;
  fillMergeNew();
  document.getElementById('mgOld').value = value || '';
  document.getElementById('mgNew').focus();
}

/** قائمة الاقتراحات للقيمة الجديدة بحسب نوع القيمة */
function fillMergeNew() {
  var list = document.getElementById('mgList').value;
  var vals = list === 'roles'    ? LISTS.roles
           : list === 'jobs'     ? LISTS.jobs
           : list === 'centers'  ? LISTS.centers
           : list === 'projects' ? LISTS.projects.map(function (p) { return p.name; })
           : list === 'subjects' ? LISTS.subjects
           : list === 'people'   ? LISTS.users.map(function (u) { return u.real_name; })
           : [];
  document.getElementById('mgNewList').innerHTML = vals.map(function (v) {
    return '<option value="' + esc(v) + '">';
  }).join('');
}

function scanOrphans() {
  var box = document.getElementById('orphanBox');
  box.innerHTML = '<span class="hint">جارٍ الفحص…</span>';
  Mirage.api('orphan_values', {}).then(function (res) {
    if (res.status !== 'success') { box.innerHTML = '<span class="hint">' + esc(res.message) + '</span>'; return Mirage.fail(res); }
    var rows = res.rows || [];
    document.getElementById('mgOldList').innerHTML = rows.map(function (x) {
      return '<option value="' + esc(x.value) + '">';
    }).join('');
    if (!rows.length) {
      box.innerHTML = '<div class="alert alert-success" style="margin:0">لا قيم معلّقة — كل ما في البيانات موجود في القوائم.</div>';
      return;
    }
    var NAME = { roles: 'الصلاحية والدور', jobs: 'المسمى الوظيفي', centers: 'المركز أو القسم',
                 projects: 'المشروع', subjects: 'موضوع المراسلة' };
    box.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
      '<th>نوع القيمة</th><th>القيمة المفقودة</th><th>عدد السجلات</th><th></th></tr></thead><tbody>' +
      rows.map(function (x) {
        return '<tr><td>' + esc(NAME[x.list] || x.list) + '</td>' +
          '<td style="font-weight:800">' + esc(x.value) + '</td>' +
          '<td style="font-weight:900;color:var(--danger)">' + x.rows + '</td>' +
          '<td><button class="btn btn-primary btn-sm" type="button" onclick="goMerge(\'' +
            esc(x.list) + '\',\'' + esc(x.value) + '\')">توحيدها</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  });
}

var TBL_NAME = {
  app_users: 'المستخدمون', employees: 'الموظفون', violations: 'المخالفات', documents: 'المراسلات',
  followups: 'المهام والمتابعات', readiness: 'تقارير الجهوزية', new_hires: 'الموظفون الجدد',
  resignations: 'ترك العمل', suggestions: 'الاقتراحات', notifications: 'الإشعارات',
  notices: 'التعاميم', workflows: 'مسارات العمل', user_workflows: 'المسارات الخاصة',
  centers: 'الأقسام', roles: 'قائمة الصلاحيات', job_titles: 'قائمة المسميات',
  projects: 'المشاريع', doc_subjects: 'موضوعات المراسلات'
};

function mergeArgs() {
  var v = {
    list: document.getElementById('mgList').value,
    old:  document.getElementById('mgOld').value.trim(),
    new:  document.getElementById('mgNew').value.trim()
  };
  if (!v.old || !v.new) { Mirage.note('اكتب القيمة القديمة والقيمة الجديدة.', 'ناقص'); return null; }
  if (v.old === v.new)  { Mirage.note('القيمتان متطابقتان.', 'لا تغيير'); return null; }
  return v;
}

function mergeResult(res, applied) {
  var box = document.getElementById('mergeBox');
  if (!res.total) {
    box.innerHTML = '<div class="alert alert-warn" style="margin:0">لا سجل واحد يحمل هذه القيمة القديمة — ' +
      'تأكّد من كتابتها كما سُجّلت تماماً.</div>';
    return;
  }
  box.innerHTML = '<div class="alert ' + (applied ? 'alert-success' : 'alert-info') + '">' +
      (applied ? '<b>تمّ التوحيد:</b> ' : '<b>المعاينة:</b> سيتغيّر ') + res.total + ' سجلاً.' +
      (applied ? ' أُعيد ربط السجلات بالاسم الجديد.' : ' اضغط «تنفيذ التوحيد» لإتمام العملية.') + '</div>' +
    '<div class="table-wrap"><table><thead><tr><th>الجدول</th><th>الحقل</th><th>عدد السجلات</th></tr></thead><tbody>' +
    res.details.map(function (d) {
      return '<tr><td>' + esc(TBL_NAME[d.tbl] || d.tbl) + '</td><td>' + esc(d.col) + '</td>' +
        '<td style="font-weight:900">' + d.rows + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

function mergePreview() {
  var v = mergeArgs(); if (!v) return;
  var btn = document.getElementById('mgCheck');
  Mirage.busy(btn, true);
  Mirage.api('rename_value', { list: v.list, old: v.old, new: v.new, apply: false }).then(function (res) {
    Mirage.busy(btn, false);
    if (res.status !== 'success') return Mirage.fail(res);
    mergeResult(res, false);
  });
}

function mergeApply() {
  var v = mergeArgs(); if (!v) return;
  Mirage.confirm('سيُستبدل «' + v.old + '» بـ «' + v.new + '» في كل السجلات المرتبطة. ' +
                 'العملية لا تُحذف بيانات، لكنها لا تُلغى تلقائياً.', 'تأكيد التوحيد').then(function (yes) {
    if (!yes) return;
    var btn = document.getElementById('mgApply');
    Mirage.busy(btn, true);
    Mirage.api('rename_value', { list: v.list, old: v.old, new: v.new, apply: true }).then(function (res) {
      Mirage.busy(btn, false);
      if (res.status !== 'success') return Mirage.fail(res);
      mergeResult(res, true);
      Mirage.clearListCache();
      Mirage.ok('أُعيد ربط ' + res.total + ' سجلاً بالاسم «' + v.new + '».', 'تمّ التوحيد');
      loadSettings();
      scanOrphans();
    });
  });
}

/* ─── المستخدمون ─── */
