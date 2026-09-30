/* ══════════════════════════════════════════════════════════
   إدارة النظام — المستخدمون والصلاحيات
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

function loadUsers() { return loadAll(); }

function paintUsers(users) {
    var names = users.map(function (u) { return u.real_name; });
    var holders = {};
    users.forEach(function (u) { if (u.state === 'نشط' && u.role) holders[u.role] = (holders[u.role] || 0) + 1; });

    // «يتبع لـ» صلاحية يحملها أكثر من شخص: النظام لا يعرف من المقصود بالضبط
    var vague = users.filter(function (u) {
      return u.manager && names.indexOf(u.manager) === -1 && (holders[u.manager] || 0) !== 1;
    });
    document.getElementById('managerWarn').innerHTML = vague.length
      ? '<div class="alert alert-warn"><b>' + vague.length + ' مستخدم يتبع لصلاحية لا لشخص:</b> ' +
        vague.map(function (u) {
          return '<span class="cell-link" onclick=\'editUser(' + JSON.stringify(u).replace(/'/g, "&#39;") + ')\'>' +
            esc(u.real_name) + '</span> (يتبع لـ ' + esc(u.manager) + ')';
        }).join('، ') +
        '<br>الصلاحية يحملها أكثر من شخص، فيختار النظام أقربهم بحسب المشروع. اضغط على الاسم واختر المسؤول بالاسم لتحديده بدقة.</div>'
      : '';

    document.getElementById('userCount').textContent = users.length + ' مستخدم';
    document.getElementById('userRows').innerHTML = users.length
      ? users.map(function (x) {
          return '<tr>' +
            '<td><span class="cell-link" onclick=\'editUser(' + JSON.stringify(x).replace(/'/g, "&#39;") + ')\'>' + esc(x.username) + '</span></td>' +
            '<td>' + esc(x.real_name) + '</td><td>' + esc(x.center) + '</td>' +
            '<td><span class="tag tag-blue">' + esc(x.role) + '</span></td>' +
            '<td>' + esc(x.manager || '—') + '</td><td>' + esc(x.project || '—') + '</td>' +
            '<td>' + x.access_level + '</td>' +
            '<td><span class="tag tag-gray">' + x.pages.length + ' صفحة</span></td>' +
            '<td>' + (x.can_notify ? '<span class="tag tag-green">مسموح</span>' : '<span class="tag tag-gray">—</span>') + '</td>' +
            '<td>' + Mirage.tag(x.state) + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn btn-ghost btn-sm" onclick="setPwd(\'' + esc(x.username) + '\',\'' +
                esc(x.real_name).replace(/'/g, "") + '\')">🔑 كلمة المرور</button> ' +
              '<button class="btn btn-danger btn-sm" onclick="delUser(\'' + esc(x.username) + '\')">حذف</button>' +
            '</td>' +
            '</tr>';
        }).join('')
      : '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:26px">لا مستخدمين بعد</td></tr>';
}

function editUser(x) {
  document.querySelector('.tab[data-tab="users"]').click();
  EDITING = x.username;
  document.getElementById('f_username').value = x.username;
  document.getElementById('f_username').readOnly = true;
  document.getElementById('f_password').value = '';
  document.getElementById('pwHint').textContent = 'اتركها فارغة للإبقاء على كلمة المرور الحالية';
  document.getElementById('f_real_name').value = x.real_name;
  document.getElementById('f_job_title').value = x.job_title;
  document.getElementById('f_center').value  = x.center;
  document.getElementById('f_role').value    = x.role;
  var mgr = document.getElementById('f_manager');
  mgr.value = x.manager;
  if (x.manager && mgr.value !== x.manager) {      // قيمة قديمة لم تعد في القائمة
    mgr.insertAdjacentHTML('beforeend', '<option value="' + esc(x.manager) + '">' + esc(x.manager) + '</option>');
    mgr.value = x.manager;
  }
  document.getElementById('f_project').value = x.project;
  document.getElementById('f_access').value  = x.access_level;
  document.getElementById('f_state').value   = x.state;
  var cn = document.getElementById('f_can_notify');
  cn.checked = !!x.can_notify;
  cn.closest('.check-item').classList.toggle('checked', cn.checked);

  document.querySelectorAll('#pageChecks input').forEach(function (c) {
    c.checked = x.pages.indexOf(c.value) > -1;
    c.closest('.check-item').classList.toggle('checked', c.checked);
  });

  document.getElementById('userFormTitle').textContent = 'تعديل بيانات: ' + x.real_name;
  var btn = document.getElementById('saveUserBtn');
  btn.classList.remove('btn-primary'); btn.classList.add('btn-warn');
  btn.querySelector('.btn-text').textContent = 'تحديث البيانات';
  document.getElementById('resetUserBtn').style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetUserForm() {
  EDITING = null;
  document.getElementById('userForm').reset();
  document.getElementById('f_username').readOnly = false;
  document.getElementById('pwHint').textContent = 'مطلوبة للمستخدم الجديد';
  document.querySelectorAll('#pageChecks input, #f_can_notify').forEach(function (c) {
    c.checked = false; c.closest('.check-item').classList.remove('checked');
  });
  document.getElementById('userFormTitle').textContent = 'إضافة مستخدم جديد';
  var btn = document.getElementById('saveUserBtn');
  btn.classList.remove('btn-warn'); btn.classList.add('btn-primary');
  btn.querySelector('.btn-text').textContent = 'حفظ المستخدم';
  document.getElementById('resetUserBtn').style.display = 'none';
}

document.getElementById('userForm').onsubmit = function (e) {
  e.preventDefault();
  var pages = [];
  document.querySelectorAll('#pageChecks input:checked').forEach(function (c) { pages.push(c.value); });

  var pw = document.getElementById('f_password').value;
  if (!EDITING && !pw) return Mirage.note('كلمة المرور مطلوبة للمستخدم الجديد');
  if (!EDITING && !/^[a-z0-9._-]{2,30}$/i.test(document.getElementById('f_username').value.trim())) {
    return Mirage.note('اسم المستخدم بحروف إنجليزية وأرقام فقط، بلا مسافات');
  }
  if (document.getElementById('f_manager').value &&
      document.getElementById('f_manager').value === document.getElementById('f_real_name').value.trim()) {
    return Mirage.note('لا يمكن أن يكون المستخدم مسؤولاً مباشراً عن نفسه');
  }

  var btn = document.getElementById('saveUserBtn');
  Mirage.busy(btn, true);

  Mirage.api('user_save', {
    username: document.getElementById('f_username').value.trim(),
    password: pw,
    real_name: document.getElementById('f_real_name').value.trim(),
    job_title: document.getElementById('f_job_title').value,
    center: document.getElementById('f_center').value,
    role: document.getElementById('f_role').value,
    manager: document.getElementById('f_manager').value,
    project: document.getElementById('f_project').value,
    access_level: document.getElementById('f_access').value,
    pages: pages.join(','),
    state: document.getElementById('f_state').value,
    can_notify: document.getElementById('f_can_notify').checked ? '1' : '0'
  }).then(function (res) {
    Mirage.busy(btn, false);
    if (res.status !== 'success') return Mirage.fail(res);
    Mirage.toast(res.mode === 'update' ? 'حُدِّثت البيانات' : 'أُضيف المستخدم');
    resetUserForm();
    loadUsers();
  });
};

function delUser(username) {
  Mirage.confirm('سيُحذف المستخدم «' + username + '» ولن يستطيع الدخول.').then(function (yes) {
    if (!yes) return;
    Mirage.api('user_delete', { username: username }).then(function (res) {
      if (res.status !== 'success') return Mirage.fail(res);
      Mirage.toast('حُذف المستخدم'); loadUsers();
    });
  });
}

/* ─── لائحة المخالفات: ست درجات ─── */
