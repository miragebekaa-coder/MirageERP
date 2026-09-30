/* ══════════════════════════════════════════════════════════
   إدارة النظام — لائحة المخالفات وجزاءاتها المتدرّجة
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

var TIERS = ['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6'];

function paintCatalog(list) {
  document.getElementById('catCount').textContent = list.length + ' مخالفة';
  document.getElementById('catRows').innerHTML = list.length
    ? list.map(function (c) {
        return '<tr>' +
          '<td><span class="cell-link" onclick=\'editCat(' + JSON.stringify(c).replace(/'/g, "&#39;") + ')\'>' +
            esc(c.code) + '</span></td>' +
          '<td style="font-weight:700">' + esc(c.vtype) + '</td>' +
          TIERS.map(function (t) { return '<td>' + esc(c[t] || '—') + '</td>'; }).join('') +
          '<td><button class="btn btn-danger btn-sm" onclick="delCat(\'' + esc(c.code) + '\')">حذف</button></td>' +
          '</tr>';
      }).join('')
    : '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:26px">' +
      'اللائحة فارغة — أضف مخالفاتك من النموذج أعلاه</td></tr>';
}

function editCat(c) {
  document.getElementById('c_code').value = c.code;
  document.getElementById('c_code').readOnly = true;
  document.getElementById('c_type').value = c.vtype;
  TIERS.forEach(function (t, i) { document.getElementById('c_t' + (i + 1)).value = c[t] || ''; });
  document.getElementById('catTitle').textContent = 'تعديل المخالفة رقم ' + c.code;
  var b = document.getElementById('catSave');
  b.classList.remove('btn-primary'); b.classList.add('btn-warn');
  b.querySelector('.btn-text').textContent = 'تحديث المخالفة';
  document.getElementById('catCancel').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetCat() {
  document.getElementById('catForm').reset();
  document.getElementById('c_code').readOnly = false;
  document.getElementById('catTitle').textContent = 'إضافة مخالفة إلى اللائحة';
  var b = document.getElementById('catSave');
  b.classList.remove('btn-warn'); b.classList.add('btn-primary');
  b.querySelector('.btn-text').textContent = 'حفظ المخالفة';
  document.getElementById('catCancel').style.display = 'none';
}

document.getElementById('catForm').onsubmit = function (e) {
  e.preventDefault();
  if (!document.getElementById('c_t1').value.trim()) return Mirage.note('الدرجة الأولى من الجزاء مطلوبة');
  var b = document.getElementById('catSave');
  Mirage.busy(b, true);
  var data = { code: document.getElementById('c_code').value.trim(), vtype: document.getElementById('c_type').value.trim() };
  TIERS.forEach(function (t, i) { data[t] = document.getElementById('c_t' + (i + 1)).value.trim(); });
  Mirage.api('catalog_save', data).then(function (res) {
    Mirage.busy(b, false);
    if (res.status !== 'success') return Mirage.fail(res);
    Mirage.toast(res.mode === 'update' ? 'حُدِّثت المخالفة' : 'أُضيفت المخالفة');
    resetCat();
    Mirage.clearListCache();
    loadAll();
  });
};

function delCat(code) {
  Mirage.confirm('سيُحذف رقم ' + code + ' من اللائحة. البلاغات المسجّلة عليه تبقى كما هي.').then(function (yes) {
    if (!yes) return;
    Mirage.api('catalog_delete', { code: code }).then(function (res) {
      if (res.status !== 'success') return Mirage.fail(res);
      Mirage.clearListCache();
      Mirage.toast('حُذفت المخالفة');
      loadAll();
    });
  });
}

/* ─── المسارات: العام، والخاص بكل مستخدم ─── */
