/* ══════════════════════════════════════════════════════════
   إدارة النظام — كلمات المرور
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

/* ═══════════════ كلمات المرور ═══════════════ */

function setPwd(username, realName) {
  Mirage.password.set(username, realName, function () { pwdLog(); });
}

function pwdLog() {
  var box = document.getElementById('pwdBox');
  box.innerHTML = '<span class="hint">جارٍ التحميل…</span>';
  Mirage.api('password_events', { limit: 100 }).then(function (res) {
    if (res.status !== 'success') { box.innerHTML = ''; return Mirage.fail(res); }
    var items = res.items || [];
    if (!items.length) {
      box.innerHTML = '<div class="empty"><span class="ico">🔑</span><b>لا تغييرات بعد</b>' +
                      'سيظهر هنا كل تغيير لكلمة مرور، بصاحبه وتاريخه.</div>';
      return;
    }
    box.innerHTML =
      '<div class="table-wrap"><table><thead><tr>' +
      '<th>التاريخ</th><th>الحساب</th><th>غيّرها</th><th>الصفة</th>' +
      '</tr></thead><tbody>' +
      items.map(function (e) {
        return '<tr><td style="white-space:nowrap">' + Mirage.ltr(e.at) + '</td>' +
          '<td>' + esc(e.name || e.username) + '</td>' +
          '<td>' + esc(e.by) + '</td>' +
          '<td>' + (e.self ? '<span class="tag tag-green">بنفسه</span>'
                           : '<span class="tag tag-blue">مدير النظام</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  });
}
