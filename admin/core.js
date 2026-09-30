/* ══════════════════════════════════════════════════════════
   إدارة النظام — الحالة المشتركة، والإقلاع، والتبويبات
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

var LISTS = { centers: [], roles: [], projects: [], jobs: [], subjects: [], users: [], centerRows: [] };
var STATIONS = [];
var USER_FLOWS = [];
var EDITING = null;
var NOTICE_LOG = null;

/* رموز المحطات الديناميكية — تُحلّ إلى أشخاص لحظة تقديم النموذج */
var TOKENS = {
  '@manager':   'المسؤول المباشر لمُقدِّم النموذج',
  '@dept_head': 'مسؤول قسم مُقدِّم النموذج',
  '@hr_head':   'رئيس قسم شؤون الموظفين',
  '@gm':        'المدير العام'
};

Mirage.boot({
  page: 'admin', title: 'إدارة النظام',
  sub: 'غرفة التحكم بالبيانات والصلاحيات والمسارات', badge: 'Admin'
});

document.querySelectorAll('.tab').forEach(function (t) {
  t.onclick = function () {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function (x) { x.classList.remove('active'); });
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  };
});

document.getElementById('pageChecks').innerHTML = MIRAGE_PAGES.filter(function (p) { return !p.open && !p.top; }).map(function (p) {
  return '<label class="check-item"><input type="checkbox" value="' + p.key + '"> ' +
         p.ico + ' ' + esc(p.label) + '</label>';
}).join('');
document.querySelectorAll('#pageChecks input, #f_can_notify').forEach(function (c) {
  c.onchange = function () { c.closest('.check-item').classList.toggle('checked', c.checked); };
});

/* النماذج اليومية التي لها مسار */
Mirage.fillSelect('flowForm', Object.keys(MirageAPI.FORMS).map(function (k) {
  return { value: k, text: MirageAPI.FORMS[k] };
}));

/* ─── تحميل الصفحة كاملة في طلب واحد ─── */
