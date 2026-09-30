/* ══════════════════════════════════════════════════════════
   إدارة النظام — إعدادات القوائم: المراكز والمشاريع والوظائف والمستويات
   ------------------------------------------------------------
   جزء من صفحة admin.html. كانت الصفحة ملفاً واحداً من ألفَي سطر،
   فقُسّمت إلى وحدات يُقرأ كلٌّ منها وحده ويُعدَّل بلا خوف على غيره.
   ══════════════════════════════════════════════════════════ */

function loadAll() {
  return Mirage.api('admin_data', { form: document.getElementById('flowForm').value })
    .then(function (res) {
      if (res.status !== 'success') { Mirage.fail(res); return; }
      USER_FLOWS = res.user_flows || [];
      paintSettings(res);
      paintUsers(res.users || []);
      paintCatalog(res.catalog || []);
      paintUserFlows();
      if (document.getElementById('flowUser').value) loadFlow();
      else { STATIONS = res.flow || []; renderFlow(); }
    });
}

function loadSettings() { return loadAll(); }

function stationText(tok) { return Mirage.stationLabel(tok); }

function paintSettings(res) {
    LISTS.centers  = res.centers  || [];
    LISTS.roles    = res.roles    || [];
    LISTS.jobs     = res.jobs     || [];
    LISTS.subjects = res.subjects || [];
    LISTS.projects = res.projects || [];
    LISTS.users    = (res.users || []).filter(function (u) { return u.state === 'نشط'; });
    LISTS.centerRows = res.center_rows || [];

    paintCenters();
    document.getElementById('roleList').innerHTML    = chips('roles',    LISTS.roles);
    paintJobs();
    loadLevels();
    document.getElementById('subjectList').innerHTML = chips('subjects', LISTS.subjects);

    document.getElementById('projectRows').innerHTML = LISTS.projects.length
      ? LISTS.projects.map(function (p) {
          var n = esc(p.name);
          return '<tr><td style="font-weight:800">' + n + '</td>' +
            cell(n, 'workers', p.workers) + cell(n, 'supervisors', p.supervisors) +
            cell(n, 'managers', p.managers) +
            '<td style="font-weight:900">' + (p.workers + p.supervisors + p.managers) + '</td>' +
            '<td><button class="btn btn-danger btn-sm" onclick="delItem(\'projects\',\'' + n + '\')">حذف</button></td></tr>';
        }).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:26px">لم تُضف مشاريع بعد</td></tr>';

    Mirage.fillSelect('f_center',    LISTS.centers, 'اختر المركز…');
    Mirage.fillSelect('f_role',      LISTS.roles,   'اختر الصلاحية…');
    Mirage.jobField('f_job_title');
    Mirage.fillSelect('f_project',   LISTS.projects.map(function (p) { return p.name; }), 'بلا مشروع محدد');
    fillManagers();
    fillStations();
    fillFlowUsers();

    Mirage.adder('f_center', 'centers', 'مركز', loadSettings);
    Mirage.adder('f_role', 'roles', 'صلاحية', loadSettings);
    Mirage.adder('f_project', 'projects', 'مشروع', loadSettings);

    // الحذف من القوائم — لمدير النظام وحده
    Mirage.remover('f_center',    'centers',  'المراكز والأقسام',     loadSettings);
    Mirage.remover('f_role',      'roles',    'الصلاحيات والأدوار',   loadSettings);
    Mirage.remover('f_project',   'projects', 'المشاريع',             loadSettings);
    // «يتبع لـ»: إن كانت القيمة صلاحية حُذفت من قائمة الصلاحيات، وإن كانت شخصاً أُفرغ الحقل
    Mirage.remover('f_manager', null, 'الصلاحيات والأدوار', loadSettings, {
      resolve: function (v) { return LISTS.roles.indexOf(v) > -1 ? 'roles' : ''; }
    });
    // مستوى الصلاحية ثابت في النظام: الزر يُعيد الحقل إلى المستوى الأساسي
    Mirage.remover('f_access', null, 'مستوى الصلاحية', null, { clearOnly: true, clearTo: '0' });

    fillMergeNew();                    // اقتراحات «القيمة الجديدة» في تبويب توحيد البيانات
}

/** «يتبع لـ»: الأشخاص أولاً، والصلاحيات القديمة للتوافق فقط */
function fillManagers() {
  var el = document.getElementById('f_manager');
  var cur = el.value;
  el.innerHTML = '<option value="">بلا مسؤول مباشر</option>' +
    '<optgroup label="الأشخاص">' + LISTS.users.map(function (u) {
      return '<option value="' + esc(u.real_name) + '">' + esc(u.real_name) +
        (u.job_title ? ' — ' + esc(u.job_title) : '') + '</option>';
    }).join('') + '</optgroup>' +
    '<optgroup label="صلاحية (النظام القديم — يُفضَّل اختيار شخص)">' + LISTS.roles.map(function (r) {
      return '<option value="' + esc(r) + '">' + esc(r) + '</option>';
    }).join('') + '</optgroup>';
  el.value = cur;
}

/* ─── الأقسام ورؤساؤها ─── */
function paintCenters() {
  var box = document.getElementById('centerList');
  if (!LISTS.centerRows.length) {
    box.innerHTML = '<span style="color:var(--text-muted);font-size:13px">لا أقسام بعد</span>';
    return;
  }
  var people = LISTS.users.map(function (u) { return u.real_name; });
  box.innerHTML =
    '<div class="center-row" style="font-size:12.5px;color:var(--text-muted);font-weight:800;padding-top:0">' +
      '<span>القسم</span><span>رئيس القسم</span><span>نوع القسم</span><span></span></div>' +
    LISTS.centerRows.map(function (c) {
      var n = esc(c.name);
      return '<div class="center-row">' +
        '<b style="color:var(--brand-dark)">' + n + '</b>' +
        '<select data-center="' + n + '" data-f="head"><option value="">— لم يُحدَّد —</option>' +
          people.map(function (p) {
            return '<option value="' + esc(p) + '"' + (p === c.head ? ' selected' : '') + '>' + esc(p) + '</option>';
          }).join('') + '</select>' +
        '<select data-center="' + n + '" data-f="kind">' +
          '<option value=""' + (!c.kind ? ' selected' : '') + '>قسم عادي</option>' +
          '<option value="hr"' + (c.kind === 'hr' ? ' selected' : '') + '>شؤون الموظفين</option>' +
          '<option value="top"' + (c.kind === 'top' ? ' selected' : '') + '>الإدارة العليا</option>' +
        '</select>' +
        '<button class="btn btn-danger btn-sm" onclick="delItem(\'centers\',\'' + n + '\')">حذف</button>' +
      '</div>';
    }).join('');

  box.querySelectorAll('select[data-center]').forEach(function (sel) {
    sel.onchange = function () {
      var name = sel.dataset.center;
      var row = LISTS.centerRows.filter(function (c) { return c.name === name; })[0] || {};
      var head = box.querySelector('select[data-center="' + CSS.escape(name) + '"][data-f="head"]').value;
      var kind = box.querySelector('select[data-center="' + CSS.escape(name) + '"][data-f="kind"]').value;
      Mirage.api('center_set', { name: name, head: head, kind: kind }).then(function (res) {
        if (res.status !== 'success') return Mirage.fail(res);
        row.head = head; row.kind = kind;
        Mirage.toast('حُفظ: ' + name);
        fillStations();
        previewRoute();
      });
    };
  });
}

function cell(project, key, value) {
  return '<td><input type="number" min="0" value="' + value + '" style="max-width:110px" ' +
         'onchange="setRequired(this, \'' + project + '\')" data-key="' + key + '"></td>';
}

function chips(list, items) {
  if (!items.length) return '<span style="color:var(--text-muted);font-size:13px">لا عناصر بعد</span>';
  return items.map(function (v) {
    return '<span class="chip">' + esc(v) +
      '<button title="حذف" onclick="delItem(\'' + list + '\',\'' + esc(v) + '\')">✕</button></span>';
  }).join('');
}

/* ─────────── الوظائف بمجموعتيها ─────────── */

var JOBS = [];

function paintJobs() {
  Mirage.api('my_jobs', {}).then(function (res) {
    JOBS = res.jobs || [];
    [0, 1].forEach(function (g) {
      var box = document.getElementById('jobList' + g);
      var items = JOBS.filter(function (j) { return (g ? j.level >= 1 : j.level === 0); });
      box.innerHTML = items.length
        ? items.map(function (j) {
            return '<span class="chip">' + esc(j.name) +
              '<button title="حذف" onclick="delJob(\'' + esc(j.name) + '\')">✕</button></span>';
          }).join('')
        : '<span style="color:var(--text-muted);font-size:13px">لا وظائف في هذه المجموعة</span>';
    });
  });
}

function addJob() {
  var el = document.getElementById('newJob');
  var v = el.value.trim();
  if (!v) { el.focus(); return; }
  Mirage.api('job_add', { name: v, level: document.getElementById('newJobLevel').value }).then(function (res) {
    if (res.status !== 'success') return Mirage.fail(res);
    el.value = '';
    Mirage.clearListCache();
    Mirage.toast('أُضيفت الوظيفة');
    paintJobs();
  });
}

function delJob(name) {
  Mirage.api('value_usage', { list: 'jobs', value: name }).then(function (u) {
    var n = (u.status === 'success' && u.total) || 0;
    Mirage.confirm(
      n ? 'الوظيفة «' + name + '» مستعملة في ' + n + ' سجلاً. حذفها لا يحذف السجلات، لكنها تبقى معلّقة ' +
          'على اسم غير موجود — الأفضل توحيدها من تبويب «توحيد البيانات».'
        : 'ستُحذف «' + name + '» من قائمة الوظائف. لا سجلات مرتبطة بها.',
      'حذف وظيفة'
    ).then(function (yes) {
      if (!yes) return;
      Mirage.api('job_delete', { name: name }).then(function (res) {
        if (res.status !== 'success') return Mirage.fail(res);
        Mirage.clearListCache(); Mirage.toast('حُذفت الوظيفة'); paintJobs();
      });
    });
  });
}

/* ─────────── مستويات الصلاحية ─────────── */

var LEVELS = [];

function loadLevels() {
  Mirage.api('access_levels', {}).then(function (res) {
    LEVELS = res.levels || [];
    // قائمة المستوى في نموذج المستخدم تُبنى من الجدول نفسه
    var keep = document.getElementById('f_access').value;
    document.getElementById('f_access').innerHTML = LEVELS.map(function (l) {
      return '<option value="' + l.level + '">' + l.level + ' — ' + esc(l.name) + '</option>';
    }).join('');
    if (keep !== '' && LEVELS.filter(function (l) { return String(l.level) === String(keep); }).length) {
      document.getElementById('f_access').value = keep;
    }

    document.getElementById('levelRows').innerHTML = LEVELS.map(function (l) {
      return '<tr><td style="font-weight:900">' + l.level +
          (l.level >= 3 ? ' <span class="tag tag-red">صلاحيات مدير النظام</span>' : '') + '</td>' +
        '<td style="font-weight:800">' + esc(l.name) + '</td>' +
        '<td style="font-size:12.5px;line-height:1.8">' + esc(l.note || '—') + '</td>' +
        '<td style="font-weight:900">' + l.users + '</td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn btn-ghost btn-sm" onclick="editLevel(' + l.level + ')">تعديل</button> ' +
          (l.protected
            ? '<span class="hint" style="margin:0">أساسي</span>'
            : '<button class="btn btn-danger btn-sm" onclick="delLevel(' + l.level + ')">حذف</button>') +
        '</td></tr>';
    }).join('');
  });
}

function editLevel(level) {
  var l = LEVELS.filter(function (x) { return x.level === level; })[0];
  if (!l) return;
  document.getElementById('newLevel').value = l.level;
  document.getElementById('newLevelName').value = l.name;
  document.getElementById('newLevelNote').value = l.note || '';
  document.getElementById('newLevelName').focus();
}

function saveLevel() {
  var lv = document.getElementById('newLevel').value;
  var nm = document.getElementById('newLevelName').value.trim();
  var nt = document.getElementById('newLevelNote').value.trim();
  if (lv === '' || isNaN(+lv)) return Mirage.note('اكتب رقم المستوى.', 'ناقص');
  if (!nm) return Mirage.note('اكتب اسم المستوى.', 'ناقص');

  var go = function () {
    Mirage.api('access_level_save', { level: lv, name: nm, note: nt }).then(function (res) {
      if (res.status !== 'success') return Mirage.fail(res);
      document.getElementById('newLevel').value = '';
      document.getElementById('newLevelName').value = '';
      document.getElementById('newLevelNote').value = '';
      Mirage.toast('حُفظ المستوى');
      loadLevels();
    });
  };

  if (+lv >= 3) {
    Mirage.confirm('المستوى ' + lv + ' يمنح صاحبه صلاحيات مدير النظام كاملة: إدارة النظام والحذف وتوحيد البيانات. ' +
                   'هل تريد إنشاءه؟', 'مستوى بصلاحيات كاملة').then(function (yes) { if (yes) go(); });
  } else { go(); }
}

function delLevel(level) {
  var l = LEVELS.filter(function (x) { return x.level === level; })[0];
  if (!l) return;

  if (!l.users) {
    return Mirage.confirm('سيُحذف المستوى ' + level + ' — لا مستخدم عليه.', 'حذف مستوى').then(function (yes) {
      if (!yes) return;
      Mirage.api('access_level_delete', { level: level, move_to: '' }).then(function (res) {
        if (res.status !== 'success') return Mirage.fail(res);
        Mirage.toast('حُذف المستوى'); loadLevels();
      });
    });
  }

  var others = LEVELS.filter(function (x) { return x.level !== level; });
  Swal.fire({
    icon: 'warning',
    title: 'على المستوى ' + level + ' عدد ' + l.users + ' مستخدماً',
    html: '<div style="text-align:right;direction:rtl">' +
      '<div style="font-size:13.5px;line-height:1.9;margin-bottom:12px">' +
      'لا يُحذف مستوى فيه مستخدمون. اختر المستوى الذي يُنقلون إليه، فيُنقلون ثم يُحذف المستوى — ' +
      'بلا فقدان أي بيانات ولا حساب بلا مستوى.</div>' +
      '<label class="swal-lbl" for="mvLevel">يُنقلون إلى</label>' +
      '<select id="mvLevel" class="swal2-select" style="width:100%;margin:6px 0 0">' +
        others.map(function (x) {
          return '<option value="' + x.level + '">' + x.level + ' — ' + esc(x.name) + '</option>';
        }).join('') +
      '</select></div>',
    showCancelButton: true, confirmButtonText: 'انقلهم ثم احذف', cancelButtonText: 'إلغاء',
    confirmButtonColor: '#DC2626', cancelButtonColor: '#64748B', focusConfirm: false,
    preConfirm: function () { return document.getElementById('mvLevel').value; }
  }).then(function (r) {
    if (!r.isConfirmed) return;
    Mirage.api('access_level_delete', { level: level, move_to: r.value }).then(function (res) {
      if (res.status !== 'success') return Mirage.fail(res);
      Mirage.ok('نُقل ' + res.moved + ' مستخدماً إلى المستوى ' + r.value + '، وحُذف المستوى ' + level + '.', 'تمّ');
      loadLevels();
      loadUsers();
    });
  });
}

function addItem(list, inputId) {
  var el = document.getElementById(inputId);
  var v = el.value.trim();
  if (!v) { el.focus(); return; }
  Mirage.api('settings_add', { list: list, value: v }).then(function (res) {
    if (res.status !== 'success') return Mirage.fail(res);
    el.value = '';
    Mirage.clearListCache();
    Mirage.toast('تمت الإضافة');
    loadSettings();
  });
}

function addProject() {
  var name = document.getElementById('newProject').value.trim();
  if (!name) return document.getElementById('newProject').focus();
  Mirage.api('settings_add', {
    list: 'projects', value: name,
    workers: document.getElementById('newW').value || 0,
    supervisors: document.getElementById('newS').value || 0,
    managers: document.getElementById('newM').value || 0
  }).then(function (res) {
    if (res.status !== 'success') return Mirage.fail(res);
    document.getElementById('newProject').value = '';
    document.getElementById('newW').value = 0;
    document.getElementById('newS').value = 0;
    document.getElementById('newM').value = 0;
    Mirage.clearListCache();
    Mirage.toast('أُضيف المشروع');
    loadSettings();
  });
}

function setRequired(el, project) {
  var inputs = el.closest('tr').querySelectorAll('input[data-key]');
  var vals = {};
  inputs.forEach(function (i) { vals[i.dataset.key] = Math.max(0, parseInt(i.value, 10) || 0); });

  Mirage.api('settings_set_required', {
    project: project,
    workers: vals.workers, supervisors: vals.supervisors, managers: vals.managers
  }).then(function (res) {
    if (res.status !== 'success') return Mirage.fail(res);
    Mirage.clearListCache();
    Mirage.toast('حُدِّثت الأعداد');
    loadSettings();
  });
}

/** الحذف من القوائم: يُفحص الارتباط أولاً، فلا تبقى سجلات معلّقة على اسم محذوف */
function delItem(list, value) {
  Mirage.api('value_usage', { list: list, value: value }).then(function (u) {
    var n = (u.status === 'success' && u.total) || 0;
    var msg = n
      ? 'هذه القيمة مرتبطة بـ ' + n + ' سجلاً. حذفها من القائمة لا يحذف السجلات، لكنها تبقى معلّقة ' +
        'على الاسم القديم وقد تختفي من الشاشات. الأفضل توحيدها على اسم آخر من تبويب «توحيد البيانات».'
      : 'سيُحذف «' + value + '» من القوائم. لا سجلات مرتبطة به.';
    Swal.fire({
      icon: n ? 'warning' : 'question',
      title: n ? 'القيمة مستعملة في البيانات' : 'حذف «' + value + '»',
      text: msg,
      showCancelButton: true, showDenyButton: !!n,
      confirmButtonText: 'حذف على أي حال', denyButtonText: 'توحيدها بدل الحذف', cancelButtonText: 'إلغاء',
      confirmButtonColor: '#DC2626', denyButtonColor: '#2563EB', cancelButtonColor: '#64748B', width: 620
    }).then(function (r) {
      if (r.isDenied) return goMerge(list, value);
      if (!r.isConfirmed) return;
      Mirage.api('settings_delete', { list: list, value: value }).then(function (res) {
        if (res.status !== 'success') return Mirage.fail(res);
        Mirage.clearListCache(); Mirage.toast('تم الحذف'); loadSettings();
      });
    });
  });
}

/* ─────────── توحيد البيانات ─────────── */
