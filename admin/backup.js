/* ══════════════════════════════════════════════════════════
   إدارة النظام — النسخ الاحتياطي والاستعادة
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

/* ═══════════════ النسخ الاحتياطي ═══════════════ */

function bkSize(n) {
  n = Number(n || 0);
  if (n < 1024) return n + ' بايت';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' ك.ب';
  return (n / 1024 / 1024).toFixed(2) + ' م.ب';
}

function backupNew() {
  var btn = document.getElementById('bkNew');
  Mirage.busy(btn, true);
  Mirage.api('backup_new', { label: document.getElementById('bkLabel').value }).then(function (res) {
    Mirage.busy(btn, false);
    if (res.status !== 'success') return Mirage.fail(res);
    document.getElementById('bkLabel').value = '';
    Mirage.ok('حُفظت نسخة من ' + Mirage.ltr(String(res.tables)) + ' جدولاً · ' +
              Mirage.ltr(String(res.rows)) + ' صفاً · ' + bkSize(res.bytes) + '.', 'تمّت النسخة');
    backupsLoad();
  });
}

function backupsLoad() {
  var box = document.getElementById('bkBox');
  box.innerHTML = '<span class="hint">جارٍ التحميل…</span>';
  Mirage.api('backups_list', {}).then(function (res) {
    if (res.status !== 'success') { box.innerHTML = ''; return Mirage.fail(res); }
    var items = res.items || [];
    if (!items.length) {
      box.innerHTML = '<div class="empty"><span class="ico">📦</span><b>لا نسخة بعد</b>' +
                      'اضغط «أخذ نسخة احتياطية» في الأعلى.</div>';
      return;
    }
    var total = items.reduce(function (a, x) { return a + x.bytes; }, 0);
    box.innerHTML =
      '<div class="table-wrap"><table><thead><tr>' +
      '<th>التاريخ</th><th>الوسم</th><th>أخذها</th><th>الحجم</th><th>الجداول</th><th>الصفوف</th><th></th>' +
      '</tr></thead><tbody>' +
      items.map(function (b) {
        return '<tr><td style="white-space:nowrap">' + Mirage.ltr(b.at) + '</td>' +
          '<td>' + (b.label ? esc(b.label) : '<span class="hint">—</span>') + '</td>' +
          '<td>' + esc(b.by) + '</td>' +
          '<td style="white-space:nowrap"><span class="tag tag-blue">' + bkSize(b.bytes) + '</span></td>' +
          '<td>' + Mirage.ltr(String(b.tables)) + '</td>' +
          '<td>' + Mirage.ltr(String(b.rows)) + '</td>' +
          '<td style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" onclick="backupGet(' + b.id + ')">تنزيل</button> ' +
            '<button class="btn btn-primary btn-sm" onclick="backupUse(' + b.id + ')">استعادة</button> ' +
            '<button class="btn btn-danger btn-sm" onclick="backupDrop(' + b.id + ')">حذف</button>' +
          '</td></tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<p class="hint" style="margin-top:10px">' + Mirage.ltr(String(items.length)) +
      ' نسخة · مجموع الأحجام ' + bkSize(total) + '</p>';
    BK = items;
  });
}

var BK = [];
function bkOne(id) {
  for (var i = 0; i < BK.length; i++) { if (BK[i].id === id) return BK[i]; }
  return null;
}

function backupGet(id) {
  var b = bkOne(id); if (!b) return;
  Mirage.api('backup_url', { path: b.path }).then(function (res) {
    if (res.status !== 'success') return Mirage.fail(res);
    var a = document.createElement('a');
    a.href = res.url; a.download = b.path; document.body.appendChild(a); a.click(); a.remove();
    Mirage.toast('يُنزَّل الملف');
  });
}

function backupDrop(id) {
  var b = bkOne(id); if (!b) return;
  Mirage.confirm('ستُحذف نسخة ' + Mirage.ltr(b.at) + ' نهائياً من المستودع والسجلّ.', 'حذف نسخة')
    .then(function (yes) {
      if (!yes) return;
      Mirage.api('backup_delete', { id: id, path: b.path }).then(function (res) {
        if (res.status !== 'success') return Mirage.fail(res);
        Mirage.toast('حُذفت النسخة'); backupsLoad();
      });
    });
}

function backupUse(id) {
  var b = bkOne(id); if (!b) return;
  Mirage.api('backup_read', { path: b.path }).then(function (res) {
    if (res.status !== 'success') return Mirage.fail(res);
    askRestore(res.data, 'نسخة ' + b.at + ' (' + bkSize(b.bytes) + ')');
  });
}

function restoreFromFile() {
  var f = document.getElementById('bkFile').files[0];
  if (!f) return;
  var fr = new FileReader();
  fr.onload = function () {
    var data;
    try { data = JSON.parse(fr.result); }
    catch (e) { return Mirage.fail({ message: 'الملف ليس نسخة احتياطية صالحة' }); }
    if (!data || !data.data) return Mirage.fail({ message: 'الملف ليس نسخة احتياطية من ميراج' });
    askRestore(data, f.name + ' (' + bkSize(f.size) + ')');
  };
  fr.readAsText(f);
  document.getElementById('bkFile').value = '';
}

/** الحاجز الأخير قبل الاستعادة: كتابة كلمة «استعادة» بخط اليد */
function askRestore(data, what) {
  var info = 'أُخذت في ' + Mirage.ltr(data.made_at || '—') +
             ' — ' + Mirage.ltr(String(data.tables || 0)) + ' جدولاً · ' +
             Mirage.ltr(String(data.rows || 0)) + ' صفاً' +
             (data.made_by ? ' — بيد ' + data.made_by : '');

  Swal.fire({
    icon: 'warning',
    title: 'استعادة البيانات',
    html: '<div style="text-align:right;direction:rtl;font-size:14px;line-height:1.9">' +
            '<p style="margin:0 0 10px"><b>' + esc(what) + '</b><br>' +
            '<span style="font-size:12.5px;color:#64748B">' + esc(info) + '</span></p>' +
            '<div class="alert alert-warn" style="text-align:right;margin:0 0 12px">' +
              'كل البيانات الحالية في الجداول المشمولة ستُمحى ويحلّ محلّها ما في النسخة. ' +
              'لا رجعة عن هذا إلا بنسخة أحدث. وحسابات الدخول وكلمات المرور لا تُمسّ.' +
            '</div>' +
            '<label style="font-weight:800;font-size:13px">اكتب كلمة «استعادة» للتأكيد</label>' +
          '</div>',
    input: 'text',
    inputPlaceholder: 'استعادة',
    inputAttributes: { style: 'text-align:center;font-weight:900' },
    showCancelButton: true,
    confirmButtonText: 'نفّذ الاستعادة',
    cancelButtonText: 'إلغاء',
    confirmButtonColor: '#DC2626', cancelButtonColor: '#64748B',
    width: 580
  }).then(function (r) {
    if (!r.isConfirmed) return;
    if (String(r.value || '').trim() !== 'استعادة') {
      return Mirage.fail({ message: 'لم تُكتب كلمة التأكيد — لم يتغيّر شيء' });
    }
    Mirage.toast('جارٍ الاستعادة…', 'info');
    Mirage.api('backup_restore', { data: data, confirm: 'استعادة' }).then(function (res) {
      if (res.status !== 'success') return Mirage.fail(res);
      Swal.fire({
        icon: 'success', title: 'استُعيدت البيانات',
        html: '<div style="text-align:right;direction:rtl;font-size:14px;line-height:1.9">' +
              'أُعيد ' + Mirage.ltr(String(res.tables)) + ' جدولاً و' +
              Mirage.ltr(String(res.rows)) + ' صفاً.' +
              (res.skipped_users
                ? '<br><span style="color:#92400E">وتُجووِز عن ' + Mirage.ltr(String(res.skipped_users)) +
                  ' حساباً لا وجود لحساب دخول له.</span>' : '') +
              '<br>ستُحدَّث الصفحة الآن.</div>',
        confirmButtonText: 'حسناً', confirmButtonColor: '#2563EB'
      }).then(function () { location.reload(); });
    });
  });
}

document.querySelector('.tab[data-tab="bk"]').addEventListener('click', function () {
  if (!BK.length) backupsLoad();
});
