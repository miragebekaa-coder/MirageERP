/* ══════════════════════════════════════════════════════════
   ميراج ERP — الطبقة المشتركة
   يُستدعى في كل صفحة قبل أي سكربت آخر:
     <script src="app.js"></script>
   ══════════════════════════════════════════════════════════ */

/* الاتصال بقاعدة البيانات يقع في mirage-api.js
   وإعداد المشروع (الرابط والمفتاح) في أوّل ذلك الملف. */

/** خريطة الصفحات — المفتاح هو نفسه المستخدم في عمود «الصفحات_المسموحة» */
const MIRAGE_PAGES = [
  { key: "new_hire",            file: "new_hire.html",            label: "موظف جديد",           ico: "🆕", group: "النماذج اليومية" },
  { key: "form_readiness",      file: "form_readiness.html",      label: "تقرير الجهوزية",      ico: "👥", group: "النماذج اليومية" },
  { key: "resignations",        file: "resignations.html",        label: "ترك العمل",           ico: "🚪", group: "النماذج اليومية" },
  { key: "upload",              file: "upload.html",              label: "إرسال ملف",           ico: "📁", group: "النماذج اليومية" },
  { key: "my_tasks",            file: "my_tasks.html",            label: "مهامي",               ico: "✅", group: "النماذج اليومية", tone: "followup", open: true },
  { key: "followups",           file: "followups.html",           label: "تكليف مهمة ومتابعة", ico: "📋", group: "النماذج اليومية", tone: "followup" },
  { key: "form_violation",      file: "form_violation.html",      label: "تقديم بلاغ مخالفة",  ico: "📝", group: "النماذج اليومية" },
  { key: "notifications",       file: "notifications.html",       label: "الإشعارات",           ico: "🔔", group: "التواصل", open: true },
  { key: "my_files",            file: "my_files.html",            label: "ملفاتي",              ico: "🗂️", group: "التواصل", open: true },
  { key: "suggestions",         file: "suggestions.html",         label: "اقتراحات تحسينية",    ico: "💡", group: "التواصل", open: true },
  { key: "employees",           file: "employees.html",           label: "بيانات الموظفين",     ico: "🧾", group: "البيانات الأساسية" },
  { key: "dashboard",           file: "dashboard.html",           label: "المخالفات والقرارات", ico: "⚖️", group: "لوحات الإدارة" },
  { key: "followups_dashboard", file: "followups_dashboard.html", label: "متابعة المهام",       ico: "📈", group: "لوحات الإدارة", tone: "followup" },
  { key: "dashboard_readiness", file: "dashboard_readiness.html", label: "إحصاءات الجهوزية",    ico: "📊", group: "لوحات الإدارة" },
  { key: "achievements",        file: "achievements.html",        label: "منجزات المستخدمين",   ico: "🏅", group: "لوحات الإدارة", top: true },
  { key: "admin",               file: "admin.html",               label: "إدارة النظام",        ico: "⚙️", group: "الإعدادات" }
];

const Mirage = {

  /* ─────────── الجلسة ─────────── */

  session: function () {
    var pages = [];
    try { pages = JSON.parse(localStorage.getItem("allowedPages") || "[]"); } catch (e) { pages = []; }
    return {
      username:      localStorage.getItem("userName") || "",
      realName:      localStorage.getItem("realName") || "",
      jobTitle:      localStorage.getItem("userJobTitle") || "",
      department:    localStorage.getItem("userDept") || "",
      role:          localStorage.getItem("userRole") || "",
      project:       localStorage.getItem("userProject") || "",
      directManager: localStorage.getItem("directManager") || "",
      accessLevel:   parseInt(localStorage.getItem("accessLevel"), 10) || 0,
      canNotify:     localStorage.getItem("canNotify") === "1",
      pages:         pages
    };
  },

  saveSession: function (d) {
    localStorage.setItem("userName",      d.username || "");
    localStorage.setItem("realName",      d.real_name || "");
    localStorage.setItem("userJobTitle",  d.job_title || "");
    localStorage.setItem("userDept",      d.department || "");
    localStorage.setItem("userRole",      d.role || "");
    localStorage.setItem("userProject",   d.project || "");
    localStorage.setItem("directManager", d.direct_manager || "");
    localStorage.setItem("accessLevel",   d.access_level || 0);
    localStorage.setItem("allowedPages",  JSON.stringify(d.allowed_pages || []));
    localStorage.setItem("canNotify",     d.can_notify ? "1" : "0");
  },

  logout: function () {
    var done = function () {
      try { sessionStorage.clear(); } catch (e) {}
      localStorage.clear();
      location.href = "index.html";
    };
    if (typeof MirageAPI !== "undefined") {
      // يُلغى ربط هذا الجهاز بالمستخدم أولاً، فلا تصل إشعاراته إلى من يدخل بعده
      var detach = (Mirage.push && Mirage.push.detach) ? Mirage.push.detach() : Promise.resolve();
      detach.then(function () { return MirageAPI.call("logout", {}); }).then(done, done);
    } else { done(); }
  },

  /** هل يملك المستخدم صلاحية صفحة؟ */
  can: function (key) {
    var u = this.session();
    if (!u.realName) return false;
    if (key === "admin") return this.isAdmin();       // مدير النظام وحده
    // صفحات الإدارة العليا: مدير النظام ومن مستواه 2 فأعلى — والخادم يتحقّق مجدداً
    var m0 = MIRAGE_PAGES.filter(function (p) { return p.key === key; })[0];
    if (m0 && m0.top) return this.isAdmin() || u.accessLevel >= 2;
    if (u.accessLevel >= 2 || u.role === "Admin") return true;
    // صفحة الإشعارات مفتوحة للجميع: صندوق الوارد لكل مستخدم، والإرسال لمن مُنح الصلاحية
    var meta = MIRAGE_PAGES.filter(function (p) { return p.key === key; })[0];
    if (meta && meta.open) return true;
    return u.pages.indexOf(key) > -1;
  },

  /* ─────────── الاتصال بالخادم ─────────── */

  /**
   * ينفّذ إجراءً على الخادم.
   * يُرسل كـ FormData لتجنّب طلب preflight الذي يرفضه Apps Script.
   */
  api: function (action, data) {
    if (typeof MirageAPI === "undefined") {
      return Promise.resolve({
        status: "error",
        message: "طبقة الاتصال غير محمّلة.",
        detail: "تأكّد أن mirage-api.js مُستدعى في الصفحة قبل app.js."
      });
    }
    return MirageAPI.call(action, data);
  },

  /**
   * القوائم المشتركة في طلب واحد، مع تخزين في الجلسة.
   * كل الصفحات تستدعيها بدل get_lists / flows_get / employees_list المتفرقة.
   * opts: { employees: true } لتضمين قائمة الموظفين، { force: true } لتجاهل الكاش.
   */
  lists: function (opts) {
    opts = opts || {};
    var u = this.session();
    var key = "mg_boot_" + u.username + (opts.employees ? "_emp" : "");
    var self = this;

    if (!opts.force) {
      try {
        var raw = sessionStorage.getItem(key);
        if (raw) {
          var box = JSON.parse(raw);
          if (Date.now() - box.at < 600000) return Promise.resolve(box.data);
        }
      } catch (e) {}
    }

    return this.api("bootstrap", {
      user: u.realName,
      project: u.project || "",
      need_employees: opts.employees ? "1" : "0"
    }).then(function (res) {
      if (res.status === "success") {
        try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data: res })); } catch (e) {}
      }
      return res;
    });
  },

  /** يُفرِغ كاش الجلسة — يُستدعى بعد أي إضافة إلى القوائم */
  clearListCache: function () {
    try {
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf("mg_boot_") === 0) sessionStorage.removeItem(k);
      });
    } catch (e) {}
  },

  /* ─────────── التنبيهات ─────────── */

  ok:   function (text, title) { return Swal.fire({ icon: "success", title: title || "تم", text: text, confirmButtonColor: "#2563EB", confirmButtonText: "حسناً" }); },
  /**
   * res إما نص رسالة، أو كائن الاستجابة كاملاً لعرض التشخيص.
   */
  fail: function (res, title) {
    var isObj = res && typeof res === "object";
    var text = isObj ? (res.message || "حدث خطأ") : (res || "حدث خطأ");
    var html = '<div style="text-align:right;font-size:14px">' + esc(text) + '</div>';

    if (isObj && res.detail) {
      html += '<div style="text-align:right;font-size:13px;color:#64748B;margin-top:10px">' +
              esc(res.detail) + '</div>';
    }
    if (isObj && res.raw) {
      html += '<details style="text-align:right;margin-top:14px">' +
              '<summary style="cursor:pointer;font-size:12.5px;color:#2563EB;font-weight:700">' +
              'رد الخادم الفعلي' + (res.action ? ' — الإجراء: ' + esc(res.action) : '') + '</summary>' +
              '<pre style="text-align:left;direction:ltr;white-space:pre-wrap;font-size:11px;' +
              'background:#F1F5F9;padding:10px;border-radius:8px;margin-top:8px;max-height:180px;' +
              'overflow:auto">' + esc(res.raw) + '</pre></details>';
    }

    return Swal.fire({
      icon: "error", title: title || "تعذّر التنفيذ", html: html,
      confirmButtonColor: "#2563EB", confirmButtonText: "حسناً", width: 560
    });
  },
  note: function (text, title) { return Swal.fire({ icon: "info",    title: title || "تنبيه", text: text, confirmButtonColor: "#2563EB", confirmButtonText: "حسناً" }); },
  confirm: function (text, title) {
    return Swal.fire({
      icon: "warning", title: title || "تأكيد", text: text,
      showCancelButton: true, confirmButtonText: "نعم، تابع",
      cancelButtonText: "إلغاء", confirmButtonColor: "#DC2626",
      cancelButtonColor: "#64748B"
    }).then(function (r) { return r.isConfirmed; });
  },
  toast: function (text, icon) {
    return Swal.fire({
      toast: true, position: "top-start", timer: 2600, showConfirmButton: false,
      icon: icon || "success", title: text
    });
  },

  /** حالة التحميل على الأزرار */
  busy: function (btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle("loading", !!on);
  },

  /* ─────────── بناء الواجهة ─────────── */

  /**
   * يبني القائمة الجانبية والشريط الأعلى ويتحقّق من الصلاحية.
   * @param {{page:string, title:string, sub?:string, badge?:string, guard?:boolean}} cfg
   */
  boot: function (cfg) {
    cfg = cfg || {};
    var self = this;
    var u = this.session();

    if (!u.realName) { location.href = "index.html"; return null; }
    if (cfg.guard !== false && cfg.page && !this.can(cfg.page)) {
      document.body.innerHTML =
        '<div class="login-wrap"><div class="login-card">' +
        '<h1>لا تملك صلاحية هذه الصفحة</h1>' +
        '<p class="lead">راجع مدير النظام لمنحك صلاحية الوصول.</p>' +
        '<button class="btn btn-primary btn-block" onclick="location.href=\'index.html\'">العودة للرئيسية</button>' +
        '</div></div>';
      return null;
    }

    var side = document.getElementById("sidebar");
    if (side) side.innerHTML = this._sidebarHTML(u, cfg.page);

    // دليل المُدخِلين يُحمَّل مبكراً لمدير النظام وحده، ليظهر «أدخلها فلان» مع الجداول
    this.entryNames();

    var bar = document.getElementById("topbar");
    if (bar) {
      bar.innerHTML =
        '<div style="display:flex;align-items:center;gap:14px;min-width:0">' +
          '<button class="burger" id="burger" aria-label="القائمة">☰</button>' +
          '<div style="min-width:0"><h1>' + esc(cfg.title || "") + '</h1>' +
          (cfg.sub ? '<div class="sub">' + esc(cfg.sub) + '</div>' : '') + '</div>' +
        '</div>' +
        '<div class="topbar-right">' +
          (cfg.badge ? '<span class="badge-pill">' + esc(cfg.badge) + '</span>' : '') +
          '<span class="net-pill net-on" id="mgNet"><span class="dot"></span><span class="txt">متصل</span></span>' +
          '<button class="bell-btn" id="mgInstall" type="button" title="تثبيت التطبيق على هذا الجهاز" style="display:none">📲</button>' +
          '<button class="bell-btn" id="mgBell" type="button" title="الإشعارات">🔔</button>' +
          '<button class="bell-btn" id="mgAbout" type="button" title="حول النظام">ℹ️</button>' +
          '<button class="user-chip" id="mgMe" type="button" title="صورتك الشخصية">' +
            Mirage.avatar.html(u.realName, "mgAvatar") +
            '<span>' + esc(u.realName) + '</span>' +
          '</button>' +
        '</div>';

      Mirage.net.paint();
      var me = document.getElementById("mgMe");
      if (me) me.onclick = function () { Mirage.myAccount(); };
      Mirage.avatar.paint();

      var inst = document.getElementById("mgInstall");
      if (inst && self.pwa) { inst.onclick = function () { self.pwa.install(); }; self.pwa.paintButton(); }
      if (self.push) setTimeout(function () { self.push.refresh(); }, 1500);

      var info = document.getElementById("mgAbout");
      if (info) info.onclick = function () { self.about(); };

      var bell = document.getElementById("mgBell");
      if (bell) {
        bell.onclick = function () { self.showNotifications(); };
        this.refreshBell();
      }

      var burger = document.getElementById("burger");
      if (burger && side) {
        burger.onclick = function () {
          side.classList.add("open");
          var scrim = document.createElement("div");
          scrim.className = "scrim";
          scrim.onclick = function () { side.classList.remove("open"); scrim.remove(); };
          document.body.appendChild(scrim);
        };
      }
    }
    return u;
  },

  _sidebarHTML: function (u, current) {
    var self = this;
    var html =
      '<div class="sidebar-brand">' +
        '<img src="mirage.png" alt="" onerror="this.style.visibility=\'hidden\'">' +
        '<div><b>ميراج</b><span>المنظومة الإدارية</span></div>' +
      '</div>' +
      '<div class="sidebar-user" style="display:flex;align-items:center;gap:10px">' +
        Mirage.avatar.html(u.realName, "", "avatar-md") +
        '<div style="min-width:0">' +
          '<div class="name">' + esc(u.realName) + '</div>' +
          '<div class="role">' + esc(u.jobTitle || u.role) + (u.project ? ' · ' + esc(u.project) : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<nav class="sidebar-nav">' +
        '<button class="nav-item' + (current === "home" ? " active" : "") + '" onclick="location.href=\'index.html\'">' +
        '<span class="ico">🏠</span> الرئيسية</button>';

    var groups = {};
    MIRAGE_PAGES.forEach(function (p) {
      if (!self.can(p.key)) return;
      (groups[p.group] = groups[p.group] || []).push(p);
    });

    Object.keys(groups).forEach(function (g) {
      html += '<div class="nav-group">' + esc(g) + '</div>';
      groups[g].forEach(function (p) {
        var cls = "nav-item" + (current === p.key ? " active" : "") + (p.tone ? " tone-" + p.tone : "");
        html += '<button class="' + cls + '" onclick="location.href=\'' + p.file + '\'">' +
                '<span class="ico">' + p.ico + '</span> ' + esc(p.label) + '</button>';
      });
    });

    html += '</nav><div class="sidebar-foot">' +
            '<button class="btn-logout-side" onclick="Mirage.logout()">تسجيل الخروج</button></div>';
    return html;
  },

  /** بطاقة «حول النظام» */
  about: function () {
    return Swal.fire({
      title: "حول النظام",
      html:
        '<div style="text-align:center;direction:rtl;line-height:2">' +
          '<div style="font-size:19px;font-weight:900;color:#0F172A">نظام الميسر</div>' +
          '<div style="height:1px;background:#E2E8F0;margin:16px 0"></div>' +
          '<div style="font-size:13.5px;color:#64748B;font-weight:700">' +
            'المبرمج والمتخصص في الذكاء الاصطناعي</div>' +
          '<div style="font-size:16px;font-weight:900;color:#2563EB;margin-top:4px">' +
            'مصطفى العوطة</div>' +
          '<div style="margin-top:12px">' +
            '<a href="tel:03810375" style="font-size:16px;font-weight:900;color:#0F172A;' +
            'text-decoration:none;direction:ltr;display:inline-block">03810375</a>' +
          '</div>' +
        '</div>',
      confirmButtonText: "إغلاق",
      confirmButtonColor: "#2563EB",
      width: 420
    });
  },

  /**
   * لوحة توقيع بالإصبع أو الفأرة.
   * ترجع كائناً فيه isEmpty() و clear() و dataURL()
   */
  signature: function (canvasId) {
    var cv = document.getElementById(canvasId);
    if (!cv) return null;
    var ctx = cv.getContext("2d");
    var drawing = false, dirty = false;

    function size() {
      var keep = dirty ? cv.toDataURL() : null;
      var w = (cv.parentNode && cv.parentNode.clientWidth) || 600;
      cv.width = w; cv.height = 180;
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "#0F172A"; ctx.lineWidth = 2.4;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (keep) { var img = new Image(); img.onload = function () { ctx.drawImage(img, 0, 0); }; img.src = keep; }
    }
    size();
    window.addEventListener("resize", size);

    function pos(e) {
      var r = cv.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function start(e) {
      e.preventDefault(); drawing = true; dirty = true;
      var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
      if (cv.parentNode) cv.parentNode.classList.add("signed");
    }
    function move(e) { if (!drawing) return; e.preventDefault(); var p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    function end() { drawing = false; }

    cv.addEventListener("mousedown", start);
    cv.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    cv.addEventListener("touchstart", start, { passive: false });
    cv.addEventListener("touchmove", move, { passive: false });
    cv.addEventListener("touchend", end);

    return {
      isEmpty: function () { return !dirty; },
      clear: function () {
        dirty = false; size();
        if (cv.parentNode) cv.parentNode.classList.remove("signed");
      },
      dataURL: function () { return dirty ? cv.toDataURL("image/png") : ""; }
    };
  },

  /** يعرض إشعارات المستخدم في نافذة */
  showNotifications: function () {
    var self = this;
    return this.api("notifications_list", {}).then(function (res) {
      if (res.status !== "success") return self.fail(res);
      var items = res.items || [];
      if (!items.length) {
        return Swal.fire({
          icon: "info", title: "لا إشعارات",
          text: "لا توجد إشعارات لديك الآن.",
          confirmButtonText: "إغلاق", confirmButtonColor: "#2563EB"
        });
      }

      var html = '<div style="text-align:right;direction:rtl;max-height:340px;overflow-y:auto">' +
        items.map(function (n) {
          var color = n.kind === "completed" ? "#10B981"
                    : (n.kind === "note" ? "#2563EB" : "#8B5CF6");
          return '<div style="border-right:3px solid ' + color + ';background:' +
            (n.read ? "#F8FAFC" : "#EFF6FF") + ';border-radius:8px;padding:11px 13px;margin-bottom:9px">' +
            '<div style="font-weight:900;font-size:13.5px;color:#0F172A">' + esc(n.title) +
            (n.read ? '' : ' <span style="color:#DC2626;font-size:11px">جديد</span>') + '</div>' +
            '<div style="font-size:12.5px;color:#334155;margin-top:4px">' + esc(n.body) + '</div>' +
            '<div style="font-size:11px;color:#94A3B8;margin-top:4px">' + esc(n.at) + '</div>' +
            '</div>';
        }).join('') + '</div>';

      return Swal.fire({
        title: "الإشعارات", html: html, width: 520,
        showCancelButton: true,
        confirmButtonText: "عرض كل الإشعارات",
        cancelButtonText: "تحديد الكل كمقروء",
        confirmButtonColor: "#8B5CF6", cancelButtonColor: "#64748B"
      }).then(function (r) {
        return self.api("notifications_read", {}).then(function () {
          if (r.isConfirmed) location.href = "notifications.html";
          else self.refreshBell();
        });
      });
    });
  },

  /** يحدّث عدّاد الجرس في الشريط الأعلى، ويعرض الجديد وسط الشاشة */
  refreshBell: function (announce) {
    var self = this;
    var bell = document.getElementById("mgBell");
    if (!bell) return;
    this.api("notifications_list", { unread: "1" }).then(function (res) {
      var items = (res && res.items) ? res.items : [];
      var n = items.length;
      bell.innerHTML = "🔔" + (n ? '<span class="bell-dot">' + n + '</span>' : '');
      bell.title = n ? n + " إشعار غير مقروء" : "لا إشعارات جديدة";
      if (announce !== false) self.announce(items);
    });
  },

  /* ─────────── إظهار الإشعار وسط الشاشة ───────────
     الإشعار الواصل إلى الهاتف يظهره النظام نفسه على الشاشة المقفلة،
     وهذه النافذة تكمّله داخل التطبيق: تفتح وسط الشاشة، ولا تُغلق
     من تلقائها، ولا يظهر الإشعار نفسه مرتين لأن رقمه يُحفَظ. */

  _seenKey: function () {
    return "mgSeenNotes:" + (this.session().username || "u");
  },
  _seen: function () {
    try { return JSON.parse(localStorage.getItem(this._seenKey()) || "[]"); }
    catch (e) { return []; }
  },
  _markSeen: function (ids) {
    try {
      var all = this._seen().concat(ids);
      if (all.length > 300) all = all.slice(-300);
      localStorage.setItem(this._seenKey(), JSON.stringify(all));
    } catch (e) {}
  },

  /** الإشعارات غير المقروءة التي لم تُعرض بعد: تظهر وسط الشاشة مرة واحدة */
  announce: function (items) {
    if (!items || !items.length) return;
    // على صفحة الإشعارات نفسها لا حاجة لنافذة: القائمة أمامه
    if ((location.pathname.split("/").pop() || "") === "notifications.html") {
      this._markSeen(items.map(function (x) { return x.id; }));
      return;
    }
    var seen = this._seen();
    var fresh = items.filter(function (x) { return seen.indexOf(x.id) === -1; });
    if (!fresh.length) return;

    this._markSeen(fresh.map(function (x) { return x.id; }));

    var top = fresh[0];
    this.alertCenter({
      title: top.title,
      body: top.body,
      sender: this.isAdmin() ? top.sender : "",
      at: this.isAdmin() ? top.at : "",
      more: fresh.length - 1,
      url: "notifications.html"
    });
  },

  /** نافذة كبيرة وسط الشاشة لإشعار واحد */
  alertCenter: function (n) {
    if (!n || (!n.title && !n.body)) return;
    var here = location.pathname.split("/").pop() || "";
    var url = n.url || "notifications.html";

    // الاهتزاز لا يُسمح به قبل أول لمسة من المستخدم على الصفحة
    try {
      var acted = !navigator.userActivation || navigator.userActivation.hasBeenActive;
      if (acted && navigator.vibrate) navigator.vibrate([300, 120, 300]);
    } catch (e) {}

    var html =
      '<div style="text-align:right;direction:rtl">' +
        '<div style="font-size:19px;font-weight:800;color:#0F172A;line-height:1.6;margin-bottom:10px">' +
          esc(n.title || "إشعار جديد") + '</div>' +
        (n.body ? '<div style="font-size:15px;color:#334155;line-height:1.9;white-space:pre-wrap">' +
                  esc(n.body) + '</div>' : '') +
        (n.sender || n.at
          ? '<div style="font-size:12.5px;color:#64748B;margin-top:14px;' +
            'border-top:1px solid #E2E8F0;padding-top:10px">' +
            (n.sender ? '👤 ' + esc(n.sender) : '') +
            (n.at ? ' · 🕒 ' + this.ltr(n.at) : '') + '</div>'
          : '') +
        (n.more > 0
          ? '<div style="font-size:13px;color:#1D4ED8;font-weight:700;margin-top:12px">' +
            'ولديك أيضاً ' + this.ltr(String(n.more)) + ' من الإشعارات غير المقروءة</div>'
          : '') +
      '</div>';

    var sameHere = here === url.split("?")[0];
    return Swal.fire({
      html: '<div style="font-size:38px;line-height:1;margin-bottom:6px">🔔</div>' + html,
      width: 520,
      allowOutsideClick: false,
      showCancelButton: !sameHere,
      confirmButtonText: sameHere ? "حسناً" : "فتح الإشعارات",
      cancelButtonText: "لاحقاً",
      confirmButtonColor: "#2563EB",
      cancelButtonColor: "#64748B"
    }).then(function (r) {
      if (r.isConfirmed && !sameHere) location.href = url;
    });
  },

  /** هل المستخدم مدير نظام؟ (إضافة الخيارات السريعة محصورة به) */
  isAdmin: function () {
    var u = this.session();
    return u.role === "Admin" || u.accessLevel >= 3;
  },

  /**
   * يضيف زر (+) بجانب قائمة منسدلة لإضافة خيار جديد فوراً.
   * يظهر لمدير النظام فقط. list = centers | roles | projects | jobs | subjects
   */
  /**
   * حقل «الوظيفة» بمجموعتيه: يعرض ما يراه المستخدم بحسب مستواه،
   * ويضيف ويحذف الخيارات في المجموعة المسموحة له — لا لمدير النظام وحده.
   * يُستدعى بعد تعبئة الصفحة: Mirage.jobField('f_job', onChange)
   */
  jobField: function (selectId, onDone) {
    var el = typeof selectId === "string" ? document.getElementById(selectId) : selectId;
    if (!el) return;
    var self = this;
    var lvl = this.isAdmin() ? 99 : (this.session().accessLevel || 0);

    var fill = function (keep) {
      return self.api("my_jobs", {}).then(function (res) {
        var jobs = (res.jobs || []);
        var g0 = jobs.filter(function (j) { return j.level === 0; });
        var g1 = jobs.filter(function (j) { return j.level >= 1; });
        var opt = function (j) {
          return '<option value="' + esc(j.name) + '">' + esc(j.name) + '</option>';
        };
        el.innerHTML = '<option value="">اختر الوظيفة…</option>' +
          (g0.length ? '<optgroup label="وظائف عامة">' + g0.map(opt).join('') + '</optgroup>' : '') +
          (g1.length ? '<optgroup label="وظائف إشرافية وإدارية">' + g1.map(opt).join('') + '</optgroup>' : '');
        if (keep && el.querySelector('option[value="' + String(keep).replace(/"/g, '\\"') + '"]')) el.value = keep;
        el._jobs = jobs;
        if (typeof onDone === "function") onDone(jobs);
      });
    };

    // الإضافة والحذف من قائمة المسميات لمدير النظام وحده؛ وبقية المستخدمين يختارون فقط
    if (this.isAdmin() && el.dataset.jobField !== "1") {
      el.dataset.jobField = "1";

      var wrap = el.parentNode && el.parentNode.classList.contains("with-adder") ? el.parentNode : null;
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "with-adder";
        el.parentNode.insertBefore(wrap, el);
        wrap.appendChild(el);
      }

      var add = document.createElement("button");
      add.type = "button"; add.className = "adder-btn"; add.textContent = "+";
      add.title = "إضافة وظيفة إلى القائمة";
      wrap.appendChild(add);

      var del = document.createElement("button");
      del.type = "button"; del.className = "adder-btn del-btn"; del.textContent = "🗑";
      del.title = "حذف الوظيفة المختارة من القائمة";
      wrap.appendChild(del);

      add.onclick = function () {
        var canGroup = lvl >= 1;
        Swal.fire({
          title: "إضافة وظيفة",
          html: '<div style="text-align:right;direction:rtl">' +
            '<label class="swal-lbl" for="jbName">اسم الوظيفة</label>' +
            '<input id="jbName" class="swal2-input" style="margin:6px 0 14px;width:100%;box-sizing:border-box" placeholder="مثال: عامل نظافة">' +
            (canGroup
              ? '<label class="swal-lbl" for="jbLvl">المجموعة</label>' +
                '<select id="jbLvl" class="swal2-select" style="width:100%;margin:6px 0 0">' +
                  '<option value="0">وظائف عامة — يراها كل المستخدمين</option>' +
                  '<option value="1">وظائف إشرافية وإدارية — يراها المسؤولون (مستوى 1 فأعلى)</option>' +
                '</select>'
              : '<div class="hint" style="margin:0">تُضاف إلى «وظائف عامة» — وهي المجموعة التي يراها مستواك.</div>') +
            '</div>',
          showCancelButton: true, confirmButtonText: "إضافة", cancelButtonText: "إلغاء",
          confirmButtonColor: "#2563EB", cancelButtonColor: "#64748B", focusConfirm: false,
          preConfirm: function () {
            var v = (document.getElementById("jbName").value || "").trim();
            if (v.length < 2) { Swal.showValidationMessage("اكتب اسم الوظيفة"); return false; }
            var g = canGroup ? Number(document.getElementById("jbLvl").value) : 0;
            return { name: v, level: g };
          }
        }).then(function (r) {
          if (!r.isConfirmed) return;
          self.api("job_add", r.value).then(function (res) {
            if (res.status !== "success") return self.fail(res);
            self.clearListCache();
            fill(r.value.name).then(function () {
              el.value = r.value.name;
              el.dispatchEvent(new Event("change"));
              self.toast("أُضيفت الوظيفة");
            });
          });
        });
      };

      del.onclick = function () {
        var v = el.value;
        if (!v) return self.note("اختر الوظيفة التي تريد حذفها من القائمة أولاً.", "لا وظيفة مختارة");
        self.api("value_usage", { list: "jobs", value: v }).then(function (u) {
          var n = (u.status === "success" && u.total) || 0;
          self.confirm(
            n ? "الوظيفة «" + v + "» مستعملة في " + n + " سجلاً. حذفها من القائمة لا يحذف السجلات، " +
                "لكنها تبقى معلّقة على اسم غير موجود. الأفضل توحيدها من «إدارة النظام ← توحيد البيانات»."
              : "ستُحذف «" + v + "» من قائمة الوظائف. لا سجلات مرتبطة بها.",
            "حذف وظيفة"
          ).then(function (yes) {
            if (!yes) return;
            self.api("job_delete", { name: v }).then(function (res) {
              if (res.status !== "success") return self.fail(res);
              self.clearListCache();
              fill("").then(function () {
                el.dispatchEvent(new Event("change"));
                self.toast("حُذفت الوظيفة");
              });
            });
          });
        });
      };
    }

    return fill(el.value);
  },

  /**
   * زر حذف بجانب القائمة المنسدلة — لمدير النظام وحده.
   * يحذف القيمة المختارة من القائمة نفسها في كل النظام (السجلات القديمة تبقى).
   * opts.clearOnly: حقل بلا قائمة (كمستوى الصلاحية) — يُفرَّغ الحقل فقط.
   * opts.resolve(value): تُعيد اسم القائمة التي تُحذف منها هذه القيمة، أو "" لتفريغ الحقل.
   */
  remover: function (selectId, list, label, onDone, opts) {
    if (!this.isAdmin()) return;
    opts = opts || {};
    var el = typeof selectId === "string" ? document.getElementById(selectId) : selectId;
    if (!el || el.dataset.remover === "1") return;
    el.dataset.remover = "1";

    var wrap = el.parentNode && el.parentNode.classList.contains("with-adder") ? el.parentNode : null;
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "with-adder";
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
    }

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "adder-btn del-btn";
    btn.textContent = "🗑";
    btn.title = opts.clearOnly ? "إفراغ هذا الحقل" : "حذف القيمة المختارة من القائمة";
    wrap.appendChild(btn);

    var self = this;
    var clear = function (msg) {
      el.value = opts.clearTo !== undefined ? opts.clearTo : "";
      el.dispatchEvent(new Event("change"));
      self.toast(msg || "أُفرغ الحقل");
    };

    btn.onclick = function () {
      var v = el.value;
      if (!v) return self.note("اختر القيمة أولاً ثم اضغط الحذف.", "لا قيمة مختارة");
      if (opts.clearOnly) return clear();

      var target = opts.resolve ? opts.resolve(v) : list;
      if (!target) return clear("أُفرغ الحقل — هذه القيمة ليست من قائمة تُحذف من هنا");

      self.confirm("سيُحذف «" + v + "» من قائمة " + (label || "الخيارات") +
                   " في كل النظام. السجلات القديمة تبقى كما هي.", "حذف من القائمة")
        .then(function (yes) {
          if (!yes) return;
          self.api("settings_delete", { list: target, value: v }).then(function (res) {
            if (res.status !== "success") return self.fail(res);
            self.clearListCache();
            var opt = el.querySelector('option[value="' + String(v).replace(/"/g, '\\"') + '"]');
            if (opt) opt.remove();
            el.value = "";
            el.dispatchEvent(new Event("change"));
            self.toast("حُذف من القائمة");
            if (typeof onDone === "function") onDone(v);
          });
        });
    };
  },

  adder: function (selectId, list, label, onAdded) {
    if (!this.isAdmin()) return;
    var el = typeof selectId === "string" ? document.getElementById(selectId) : selectId;
    if (!el || el.dataset.adder === "1") return;
    el.dataset.adder = "1";

    var wrap = document.createElement("div");
    wrap.className = "with-adder";
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "adder-btn";
    btn.textContent = "+";
    btn.title = "إضافة خيار جديد إلى القائمة";
    wrap.appendChild(btn);

    var self = this;
    btn.onclick = function () {
      // المشروع يحتاج أعداده التعاقدية، لأن تقرير الجهوزية يقرأها منه
      var isProject = list === "projects";
      Swal.fire({
        title: "إضافة " + (label || "خيار") + " جديد",
        html: isProject
          ? '<div style="text-align:right;direction:rtl">' +
              '<label class="swal-lbl" for="adName">اسم المشروع</label>' +
              '<input id="adName" class="swal2-input" style="margin:6px 0 14px;width:100%;box-sizing:border-box" placeholder="مثال: مستشفى دار الحكمة">' +
              '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">' +
                '<div><label class="swal-lbl" for="adW">عمال</label><input id="adW" type="number" min="0" value="0" class="swal2-input" style="margin:6px 0 0;width:100%;box-sizing:border-box"></div>' +
                '<div><label class="swal-lbl" for="adS">مشرفون</label><input id="adS" type="number" min="0" value="0" class="swal2-input" style="margin:6px 0 0;width:100%;box-sizing:border-box"></div>' +
                '<div><label class="swal-lbl" for="adM">مديرو مشروع</label><input id="adM" type="number" min="0" value="0" class="swal2-input" style="margin:6px 0 0;width:100%;box-sizing:border-box"></div>' +
              '</div>' +
              '<div style="font-size:12px;color:#64748B;margin-top:10px">الأعداد المطلوبة حسب العقد، ويُملأ منها تقرير الجهوزية تلقائياً.</div>' +
            '</div>'
          : undefined,
        input: isProject ? undefined : "text",
        inputPlaceholder: "اكتب الاسم…",
        showCancelButton: true,
        confirmButtonText: "إضافة",
        cancelButtonText: "إلغاء",
        confirmButtonColor: "#2563EB",
        cancelButtonColor: "#64748B",
        preConfirm: isProject ? function () {
          var name = document.getElementById("adName").value.trim();
          if (name.length < 2) { Swal.showValidationMessage("اكتب اسم المشروع"); return false; }
          var num = function (id) { return Math.max(0, parseInt(document.getElementById(id).value, 10) || 0); };
          return { name: name, workers: num("adW"), supervisors: num("adS"), managers: num("adM") };
        } : undefined
      }).then(function (r) {
        if (!r.isConfirmed) return;
        var v = isProject ? r.value.name : (r.value || "").trim();
        if (!v) return;
        var payload = isProject
          ? { list: list, value: v, workers: r.value.workers, supervisors: r.value.supervisors, managers: r.value.managers }
          : { list: list, value: v };
        self.api("settings_add", payload).then(function (res) {
          if (res.status !== "success") return self.fail(res.message);
          self.clearListCache();
          var opt = document.createElement("option");
          opt.value = v; opt.textContent = v;
          el.appendChild(opt);
          el.value = v;
          el.dispatchEvent(new Event("change"));
          self.toast("أُضيف إلى القائمة");
          if (typeof onAdded === "function") onAdded(v);
        });
      });
    };
  },

  /**
   * يملأ قائمة المشاريع بما يسمح به مستوى صلاحية المستخدم:
   *   المستوى 0 → مشروعه فقط، والقائمة مقفلة
   *   المستوى 1 → مشاريعه ومشاريع فريقه، مع خيار «كل مشاريعي»
   *   المستوى 2 → كل المشاريع، مع خيار «كل المشاريع»
   * يُرجع القيمة المختارة ابتداءً.
   */
  fillProjectScope: function (selectId, res, opts) {
    opts = opts || {};
    var el = typeof selectId === "string" ? document.getElementById(selectId) : selectId;
    if (!el) return "all";

    var mine = res.my_projects || [];
    var note = document.getElementById(el.id + "Note");

    // النماذج تحتاج مشروعاً واحداً محدداً، فلا خيار «الكل» فيها
    if (opts.single) {
      if (mine.length === 1) {
        el.disabled = true;
        el.innerHTML = '<option value="' + esc(mine[0]) + '" selected>' + esc(mine[0]) + '</option>';
        if (note) note.textContent = "مشروعك: " + mine[0];
        return mine[0];
      }
      if (!mine.length) {
        el.disabled = true;
        el.innerHTML = '<option value="">لا مشروع مرتبط بحسابك</option>';
        if (note) note.textContent = "لم يُربط حسابك بمشروع. راجع مدير النظام.";
        return "";
      }
      el.disabled = false;
      el.innerHTML = '<option value="">اختر المشروع…</option>' +
        mine.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join('');
      if (note) note.textContent = res.all_projects
        ? "" : "نطاقك " + mine.length + " مشاريع.";
      return "";
    }

    if (res.all_projects) {
      el.disabled = false;
      el.innerHTML = '<option value="all">كل المشاريع</option>' +
        mine.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join('');
      if (note) note.textContent = "لك حق الاطّلاع على كل مشاريع الشركة.";
      return "all";
    }

    if (mine.length <= 1) {
      var only = mine[0] || "";
      el.disabled = true;
      el.innerHTML = only
        ? '<option value="' + esc(only) + '" selected>' + esc(only) + '</option>'
        : '<option value="__none__">لا مشروع مرتبط بحسابك</option>';
      if (note) {
        note.textContent = only
          ? "نطاقك مشروع واحد: " + only
          : "لم يُربط حسابك بمشروع. راجع مدير النظام.";
      }
      return only || "__none__";
    }

    el.disabled = false;
    el.innerHTML = '<option value="all">كل مشاريعي (' + mine.length + ')</option>' +
      mine.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join('');
    if (note) note.textContent = "نطاقك " + mine.length + " مشاريع: " + mine.join(" · ");
    return "all";
  },

  /** يملأ عنصر select بقائمة نصوص */
  fillSelect: function (el, items, placeholder, selected) {
    if (typeof el === "string") el = document.getElementById(el);
    if (!el) return;
    var html = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
    (items || []).forEach(function (v) {
      var val = (v && v.value !== undefined) ? v.value : v;
      var txt = (v && v.text  !== undefined) ? v.text  : v;
      html += '<option value="' + esc(val) + '"' + (val === selected ? " selected" : "") + '>' + esc(txt) + '</option>';
    });
    el.innerHTML = html;
  },

  /** وسم ملوّن لحالة أو تصنيف */
  tag: function (text) {
    var map = {
      "عاجلة": "red", "مهمة": "yellow", "عادية": "green",
      "عالقة": "red", "قيد التنفيذ": "yellow", "أنجزت": "green",
      "مغلقة": "gray", "نشط": "green", "موقوف": "red",
      "جديد": "blue", "قيد الدراسة": "yellow", "نُفِّذ": "green",
      "مؤجَّل": "gray", "غير مناسب": "red"
    };
    var tone = map[String(text || "").trim()] || "blue";
    return '<span class="tag tag-' + tone + '">' + esc(text || "—") + '</span>';
  },

  /**
   * مسار الاعتماد مرسوماً بمحطاته: ما أُنجز، والحالية، والقادمة.
   * route = [{label, name}]، step = رقم المحطة الحالية، closed = البلاغ مغلق
   */
  routeHtml: function (route, step, closed) {
    if (!route || !route.length) return '<span class="hint">لا مسار محدَّد لهذا النموذج</span>';
    return '<ol class="route-track">' + route.map(function (s, i) {
      var st = closed || i < step ? "done" : (i === step ? "now" : "next");
      return '<li class="rt-' + st + '"><span class="rt-dot">' + (st === "done" ? "✓" : (i + 1)) + '</span>' +
        '<span class="rt-txt"><b>' + esc(s.name) + '</b><small>' + esc(s.label) +
        (st === "now" ? " · بانتظاره الآن" : "") + '</small></span></li>';
    }).join('') + '</ol>';
  },

  /* ─────────── سجلّ الإدخال: مَن أدخل السجل ومتى ─────────── */

  /**
   * يُحمَّل دليل المُدخِلين مرة واحدة لكل جلسة، ولمدير النظام وحده —
   * قاعدة البيانات نفسها لا تُعيد شيئاً لسواه.
   */
  entryNames: function () {
    if (!this.isAdmin()) return Promise.resolve({});
    if (this._entryNames) return Promise.resolve(this._entryNames);
    var self = this;
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem("entryNames") || "null"); } catch (e) {}
    if (cached) { this._entryNames = cached; return Promise.resolve(cached); }
    return this.api("entry_names", {}).then(function (res) {
      self._entryNames = (res && res.names) || {};
      try { sessionStorage.setItem("entryNames", JSON.stringify(self._entryNames)); } catch (e) {}
      self.fillEntryNames();
      return self._entryNames;
    });
  },

  /** يملأ أسماء المُدخِلين في الصفوف المرسومة قبل وصول الدليل */
  fillEntryNames: function () {
    var map = this._entryNames || {};
    var list = document.querySelectorAll(".entry-who[data-uid]");
    for (var i = 0; i < list.length; i++) {
      var uid = list[i].getAttribute("data-uid");
      list[i].textContent = map[uid] || (uid ? "مستخدم محذوف" : "—");
    }
  },

  /**
   * سطر «أدخلها فلان · التاريخ» يُلحق بخلية السجل — لمدير النظام وحده.
   * يُستدعى بعد رسم الجدول: Mirage.entryStamp(containerId, rows, idKey)
   * أو مباشرة داخل الصف بـ Mirage.entryLine(row) إن كان الدليل محمّلاً.
   */
  entryLine: function (row) {
    if (!this.isAdmin() || !row) return "";
    if (!row.entry_by && !row.entry_at) return "";
    var uid = row.entry_by || "";
    var at  = row.entry_at ? ' <span dir="ltr">' + esc(row.entry_at) + '</span>' : '';
    // سجل قديم سُجّل قبل تفعيل سجلّ الإدخال: التاريخ وحده
    if (!uid) return '<div class="entry-log" title="سجلّ الإدخال — يراه مدير النظام وحده">🕒' + at + '</div>';
    var who = (this._entryNames || {})[uid] || "…";
    return '<div class="entry-log" title="سجلّ الإدخال — يراه مدير النظام وحده">✍️ ' +
      '<span class="entry-who" data-uid="' + esc(uid) + '">' + esc(who) + '</span>' +
      (at ? ' ·' + at : '') + '</div>';
  },

  /** اسم المحطة كما يقرؤه الإنسان، من رمزها في مسار العمل */
  stationLabel: function (tok) {
    var map = {
      "@manager":   "المسؤول المباشر لمُقدِّم النموذج",
      "@dept_head": "مسؤول قسم مُقدِّم النموذج",
      "@hr_head":   "رئيس قسم شؤون الموظفين",
      "@gm":        "المدير العام"
    };
    tok = String(tok || "");
    if (map[tok]) return map[tok];
    if (tok.indexOf("@center:") === 0) return "رئيس " + tok.slice(8);
    if (tok.indexOf("user:") === 0) return tok.slice(5);
    return "صلاحية: " + tok;
  },

  /** المسار العام لنموذج: محطاته بلا أسماء، لأن شاغلها يُحسب لكل مُقدِّم */
  flowHtml: function (stations) {
    var self = this;
    return this.routeHtml((stations || []).map(function (s) {
      return {
        name: self.stationLabel(s && s.station ? s.station : s),
        label: "يُحدَّد شاغلها بحسب مُقدِّم النموذج"
      };
    }), -1, false);
  },

  /**
   * صندوق مسار الاعتماد أعلى النموذج — لمدير النظام وحده.
   * يعرض مسارك بأسمائه، فإن خلا (لا محطة فوقك أو أنت شاغلها) عرض محطات
   * المسار العام، ولا يُحذّر إلا إذا خلا المسار العام نفسه من المحطات.
   * opts: { form, intro, route }  —  route اختياري إذا كان مقروءاً مسبقاً
   */
  routeNote: function (elId, opts) {
    var note = document.getElementById(elId);
    if (!note) return;
    if (!this.isAdmin()) { note.style.display = "none"; return; }

    var self = this;
    opts = opts || {};
    var form  = opts.form || "المخالفات";
    var intro = opts.intro || "سيمرّ هذا النموذج بهؤلاء بالترتيب، وكلٌّ يبدي رأيه بدوره:";

    note.style.display = "";
    note.className = "alert alert-info";
    note.innerHTML = '<span class="hint">جارٍ قراءة مسار الاعتماد…</span>';

    var mine = opts.route
      ? Promise.resolve({ status: "success", route: opts.route })
      : this.api("my_route", { form: form });

    mine.then(function (res) {
      var st = (res && res.status === "success" && res.route) || [];
      if (st.length) {
        note.innerHTML = '<div style="font-weight:800;margin-bottom:10px">' + esc(intro) + '</div>' +
          self.routeHtml(st, -1, false);
        return;
      }
      return self.api("my_flow", { form: form }).then(function (f) {
        var stn = (f && f.stations) || [];
        if (!stn.length) {
          note.className = "alert alert-warn";
          note.textContent = "لا محطات لمسار هذا النموذج — حدِّدها من «إدارة النظام ← مسارات العمل».";
          return;
        }
        note.innerHTML =
          '<div style="font-weight:800;margin-bottom:10px">المسار المعتمد لهذا النموذج:</div>' +
          self.flowHtml(stn) +
          '<div class="hint" style="margin-top:8px">نموذجك أنت لا يمرّ على هذه المحطات — ' +
          'لا محطة فوقك أو أنت شاغلها — فيُسجَّل بانتظار الاعتماد العام دون إشعار أحد.</div>';
      });
    });
  },

  /**
   * منشئ الإشعارات — يُستخدم في صفحة الإدارة وصفحة الإشعارات.
   * النطاق يأتي من قاعدة البيانات (notice_scope)، وهي تتحقّق مجدداً عند الإرسال.
   * opts.onSent: يُستدعى بعد الإرسال (لتحديث السجل)
   */
  notifyComposer: function (containerId, opts) {
    opts = opts || {};
    var box = document.getElementById(containerId);
    if (!box) return;
    var self = this;
    var SCOPE = null, PICK = { centers: [], projects: [], users: [] };

    box.innerHTML = '<div class="empty" style="padding:22px">جارٍ تحميل نطاق الإرسال…</div>';

    Promise.all([this.api("notice_scope", {}), this.lists()]).then(function (res) {
      var sc = res[0], ls = res[1];
      if (sc.status !== "success") { box.innerHTML = ""; return self.fail(sc); }
      SCOPE = sc;
      if (!sc.can_send) {
        box.innerHTML = '<div class="alert alert-info" style="margin:0">لا تملك صلاحية إرسال الإشعارات. ' +
          'يمنحها مدير النظام للمسؤولين من صفحة «المستخدمون والصلاحيات».</div>';
        return;
      }
      var projects = sc.full ? (ls.projects || []) : (ls.my_projects || []);

      box.innerHTML =
        '<form id="ncForm" novalidate>' +
          '<div class="grid-2">' +
            '<div class="field"><label for="ncTitle">عنوان الإشعار <span class="req">*</span></label>' +
              '<input type="text" id="ncTitle" maxlength="120" placeholder="مثال: تعميم — دوام يوم الجمعة"></div>' +
            '<div class="field"><label for="ncProject">المشروع المعني</label>' +
              '<select id="ncProject"></select>' +
              '<div class="hint">يُحفظ مع الإشعار لتبحث عنه لاحقاً بحسب المشروع</div></div>' +
          '</div>' +
          '<div class="field"><label for="ncBody">مضمون الإشعار</label>' +
            '<textarea id="ncBody" rows="3" maxlength="1000" placeholder="التفاصيل التي يجب أن يقرأها المستلمون"></textarea></div>' +
          '<div class="field"><label>المستلمون <span class="req">*</span></label>' +
            '<div class="seg" id="ncType">' +
              '<label><input type="radio" name="ncType" value="all" checked><span>' +
                (sc.full ? 'كل المستخدمين' : 'كل فريقي') + '</span></label>' +
              '<label><input type="radio" name="ncType" value="centers"><span>أقسام</span></label>' +
              '<label><input type="radio" name="ncType" value="projects"><span>مشاريع</span></label>' +
              '<label><input type="radio" name="ncType" value="users"><span>أشخاص محدّدون</span></label>' +
            '</div>' +
            '<div id="ncPicker" style="margin-top:14px"></div>' +
            '<div class="alert alert-info" id="ncCount" style="margin:14px 0 0"></div>' +
          '</div>' +
          '<div class="btn-row"><button type="submit" class="btn btn-primary" id="ncSend">' +
            '<span class="btn-text">إرسال الإشعار</span><span class="spinner"></span></button></div>' +
        '</form>';

      self.fillSelect("ncProject", projects, "بلا مشروع محدد");
      box.querySelectorAll('input[name="ncType"]').forEach(function (r) { r.onchange = picker; });
      picker();

      document.getElementById("ncForm").onsubmit = function (e) {
        e.preventDefault();
        var title = document.getElementById("ncTitle").value.trim();
        var type = box.querySelector('input[name="ncType"]:checked').value;
        var list = type === "all" ? [] : PICK[type];
        if (!title) { document.getElementById("ncTitle").focus(); return self.note("اكتب عنوان الإشعار"); }
        if (type !== "all" && !list.length) return self.note("اختر المستلمين أولاً");
        var n = recipients().length;
        if (!n) return self.note("لا يوجد مستلمون في هذا الاختيار");

        self.confirm("سيُرسل «" + title + "» إلى " + n + " مستخدم. لا يمكن سحبه بعد الإرسال.", "تأكيد الإرسال")
          .then(function (yes) {
            if (!yes) return;
            var btn = document.getElementById("ncSend");
            self.busy(btn, true);
            self.api("notice_send", {
              title: title, body: document.getElementById("ncBody").value.trim(),
              project: document.getElementById("ncProject").value,
              target_type: type, targets: list
            }).then(function (res) {
              self.busy(btn, false);
              if (res.status !== "success") return self.fail(res);
              document.getElementById("ncForm").reset();
              PICK = { centers: [], projects: [], users: [] };
              picker();
              self.ok("أُرسل إلى " + res.sent + " مستخدم، وحُفظ في سجل الإشعارات.", "تم الإرسال");
              if (typeof opts.onSent === "function") opts.onSent();
            });
          });
      };
    });

    /** من سيصله الإشعار فعلاً — للعرض فقط، والحكم لقاعدة البيانات */
    function recipients() {
      var type = box.querySelector('input[name="ncType"]:checked').value;
      return SCOPE.users.filter(function (u) {
        if (type === "all") return true;
        if (type === "centers") return PICK.centers.indexOf(u.center) > -1;
        if (type === "projects") return PICK.projects.indexOf(u.project) > -1;
        return PICK.users.indexOf(u.name) > -1;
      });
    }

    function picker() {
      var type = box.querySelector('input[name="ncType"]:checked').value;
      var el = document.getElementById("ncPicker");
      var items = type === "centers" ? SCOPE.centers
                : type === "projects" ? SCOPE.projects
                : type === "users" ? SCOPE.users.map(function (u) { return u.name; }) : [];
      if (type === "all") { el.innerHTML = ""; count(); return; }
      if (!items.length) {
        el.innerHTML = '<div class="hint">لا عناصر في نطاقك لهذا الخيار.</div>'; count(); return;
      }
      var extra = function (v) {
        if (type !== "users") return "";
        var u = SCOPE.users.filter(function (x) { return x.name === v; })[0] || {};
        return ' <small style="color:var(--text-muted)">' + esc([u.center, u.project].filter(Boolean).join(" · ")) + '</small>';
      };
      el.innerHTML =
        (type === "users" ? '<input type="search" id="ncFind" placeholder="ابحث بالاسم…" style="margin-bottom:10px">' : '') +
        '<div class="check-grid pick-scroll">' + items.map(function (v) {
          var on = PICK[type].indexOf(v) > -1;
          return '<label class="check-item' + (on ? ' checked' : '') + '" data-v="' + esc(v) + '">' +
            '<input type="checkbox" value="' + esc(v) + '"' + (on ? ' checked' : '') + '> ' + esc(v) + extra(v) + '</label>';
        }).join('') + '</div>';
      el.querySelectorAll('input[type=checkbox]').forEach(function (c) {
        c.onchange = function () {
          c.closest('.check-item').classList.toggle('checked', c.checked);
          var arr = PICK[type], i = arr.indexOf(c.value);
          if (c.checked && i < 0) arr.push(c.value);
          if (!c.checked && i > -1) arr.splice(i, 1);
          count();
        };
      });
      var find = document.getElementById("ncFind");
      if (find) find.oninput = function () {
        var q = find.value.trim();
        el.querySelectorAll('.check-item').forEach(function (it) {
          it.style.display = !q || it.dataset.v.indexOf(q) > -1 ? "" : "none";
        });
      };
      count();
    }

    function count() {
      var n = recipients().length;
      document.getElementById("ncCount").innerHTML = n
        ? 'سيصل الإشعار إلى <b>' + n + '</b> مستخدم' + (SCOPE.full ? '' : ' من فريقك')
        : 'لم يُحدَّد مستلمون بعد';
    }
  },

  /** سجل الإشعارات المرسلة مع التصفية بالعنوان والمضمون والشهر والمشروع */
  noticeLog: function (containerId) {
    var box = document.getElementById(containerId);
    if (!box) return { reload: function () {} };
    var self = this, ITEMS = [];

    box.innerHTML =
      '<div class="grid-3 filters">' +
        '<div class="field"><label for="nlQ">بحث في العنوان والمضمون</label><input type="search" id="nlQ" placeholder="اكتب كلمة…"></div>' +
        '<div class="field"><label for="nlMonth">الشهر</label><input type="month" id="nlMonth"></div>' +
        '<div class="field"><label for="nlProject">المشروع</label><select id="nlProject"><option value="">كل المشاريع</option></select></div>' +
      '</div>' +
      '<div class="table-wrap"><table><thead><tr>' +
        '<th>التاريخ</th><th>العنوان</th><th>المضمون</th><th>المشروع</th><th>المستلمون</th><th>المُرسل</th>' +
      '</tr></thead><tbody id="nlRows"><tr><td colspan="6" class="td-empty">جارٍ التحميل…</td></tr></tbody></table></div>';

    document.getElementById("nlQ").oninput = paint;
    document.getElementById("nlProject").onchange = paint;
    document.getElementById("nlMonth").onchange = load;

    function load() {
      return self.api("notices_log", { month: document.getElementById("nlMonth").value }).then(function (res) {
        if (res.status !== "success") return self.fail(res);
        ITEMS = res.items || [];
        var projects = ITEMS.map(function (n) { return n.project; })
          .filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort();
        var cur = document.getElementById("nlProject").value;
        self.fillSelect("nlProject", projects, "كل المشاريع", cur);
        paint();
      });
    }

    function paint() {
      var q = document.getElementById("nlQ").value.trim();
      var pr = document.getElementById("nlProject").value;
      var list = ITEMS.filter(function (n) {
        if (pr && n.project !== pr) return false;
        if (q && (n.title + " " + n.body).indexOf(q) === -1) return false;
        return true;
      });
      document.getElementById("nlRows").innerHTML = list.length
        ? list.map(function (n) {
            return '<tr><td style="white-space:nowrap">' + esc(n.at) + '</td>' +
              '<td style="font-weight:800">' + esc(n.title) + '</td>' +
              '<td style="max-width:280px;white-space:pre-wrap">' + esc(n.body || '—') + '</td>' +
              '<td>' + esc(n.project || '—') + '</td>' +
              '<td><span class="cell-link" onclick="Mirage.note(\'' +
                esc(n.names.join('، ')).replace(/'/g, '&#39;') + '\', \'المستلمون (' + n.recipients + ')\')">' +
                esc(n.target) + (n.targets.length ? ': ' + esc(n.targets.slice(0, 2).join('، ')) +
                (n.targets.length > 2 ? '…' : '') : '') + ' · ' + n.recipients + '</span></td>' +
              '<td>' + esc(n.sender) + '</td></tr>';
          }).join('')
        : '<tr><td colspan="6" class="td-empty">لا إشعارات مطابقة.</td></tr>';
    }

    load();
    return { reload: load };
  },

  /* ─────────── ملفات إكسل ───────────
     المكتبة تُحمَّل عند أول استعمال فقط، فلا تُثقل بقية الصفحات. */

  xlsxLib: function () {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (this._xlsxP) return this._xlsxP;
    this._xlsxP = new Promise(function (ok, no) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.onload = function () {
        window.XLSX ? ok(window.XLSX) : no(new Error("تعذّر تحميل مكتبة إكسل"));
      };
      s.onerror = function () {
        no(new Error("تعذّر تحميل مكتبة إكسل — تأكّد من الاتصال بالإنترنت ثم أعد المحاولة"));
      };
      document.head.appendChild(s);
    });
    return this._xlsxP;
  },

  /**
   * يحفظ ملف إكسل على جهاز المستخدم.
   * @param {Array<{name:string, header?:string[], rows:Object[], widths?:number[]}>} sheets
   * @param {string} filename
   */
  saveXlsx: function (sheets, filename) {
    return this.xlsxLib().then(function (X) {
      var wb = X.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };

      sheets.forEach(function (sh) {
        var rows = sh.rows || [];
        var head = sh.header || (rows.length ? Object.keys(rows[0]) : []);
        var ws = rows.length
          ? X.utils.json_to_sheet(rows, head.length ? { header: head } : undefined)
          : X.utils.aoa_to_sheet([head]);
        ws["!cols"] = head.map(function (h, i) {
          return { wch: (sh.widths && sh.widths[i]) || Math.max(12, Math.min(34, String(h).length + 6)) };
        });
        X.utils.book_append_sheet(wb, ws, sh.name);
      });

      X.writeFile(wb, filename);
      return true;
    });
  },

  /** يقرأ ملف إكسل ويعيد { اسم الورقة: [ {العمود: القيمة} ] } */
  readXlsx: function (file) {
    return this.xlsxLib().then(function (X) {
      return file.arrayBuffer().then(function (buf) {
        var wb = X.read(new Uint8Array(buf), { type: "array", cellDates: true });
        var out = {};
        wb.SheetNames.forEach(function (n) {
          out[n] = X.utils.sheet_to_json(wb.Sheets[n], {
            defval: "", raw: false, dateNF: "yyyy-mm-dd"
          });
        });
        return out;
      });
    });
  },

  today: function () {
    var d = new Date(), p = function (n) { return ("0" + n).slice(-2); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  },
  thisMonth: function () { return this.today().slice(0, 7); },

  /* ─────────── فترة التجربة ───────────
     موظف تحت التجربة = لم تمضِ ثلاثة أشهر على تاريخ بدء عمله الفعلي (تاريخ التوظيف)
     في التاريخ المرجعي: اليوم، أو تاريخ المخالفة، أو تاريخ ترك العمل.
     القاعدة نفسها في قاعدة البيانات: on_probation(hire, ref). */
  /** يحفظ اتجاه التاريخ أو الرقم داخل جملة عربية (بدونه يظهر 2026-10-20 مقلوباً 20-10-2026) */
  ltr: function (s) { return s ? "\u2066" + s + "\u2069" : ""; },

  probationEnd: function (hire) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(hire || "");
    if (!m) return "";
    var y = +m[1], mo = +m[2] + 3, d = +m[3];
    if (mo > 12) { mo -= 12; y++; }
    var last = new Date(y, mo, 0).getDate();           // آخر يوم في الشهر الهدف
    var p = function (n) { return ("0" + n).slice(-2); };
    return y + "-" + p(mo) + "-" + p(Math.min(d, last));
  },
  onProbation: function (hire, ref) {
    var end = this.probationEnd(hire);
    return !!end && String(ref || this.today()).slice(0, 10) < end;
  },
  /** وسم «تحت التجربة» مع تاريخ انتهائها، أو نص فارغ */
  probationTag: function (hire, ref) {
    if (!this.onProbation(hire, ref)) return "";
    return '<span class="tag tag-purple" title="تنتهي فترة التجربة في ' + esc(this.probationEnd(hire)) +
           '">تحت التجربة</span>';
  },

  /* ─────────── الأشهر بالعربية ─────────── */
  MONTHS: ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
           "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"],
  monthName: function (m) {
    var x = /^(\d{4})-(\d{2})$/.exec(m || "");
    return x ? this.MONTHS[+x[2] - 1] + " " + x[1] : String(m || "");
  },
  /** قائمة أشهر من الأحدث: الشهر الحالي و(count-1) قبله، مع أي أشهر إضافية فيها بيانات */
  monthOptions: function (count, extra) {
    var d = new Date(), out = [];
    for (var i = 0; i < (count || 24); i++) {
      var t = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(t.getFullYear() + "-" + ("0" + (t.getMonth() + 1)).slice(-2));
    }
    (extra || []).forEach(function (m) { if (m && out.indexOf(m) === -1) out.push(m); });
    out.sort().reverse();
    var self = this;
    return out.map(function (m) { return { value: m, text: self.monthName(m) }; });
  }
};

/* ─────────── إظهار الأخطاء الصامتة ───────────
   بلا هذا الشريط، أي خطأ في السكربت يجعل الأزرار لا تفعل شيئاً
   بلا أي رسالة، وهو أصعب ما يُشخَّص بلا خبرة برمجية. */

(function () {
  function banner(text) {
    var bar = document.getElementById("mgErrBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "mgErrBar";
      bar.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:9999;background:#7F1D1D;color:#fff;" +
        "padding:11px 16px;font-family:Tajawal,sans-serif;font-size:13px;font-weight:700;" +
        "direction:rtl;text-align:right;box-shadow:0 2px 10px rgba(0,0,0,.35)";
      document.body.appendChild(bar);
    }
    bar.innerHTML = "⚠️ خطأ في الصفحة — " + esc(text) +
      '<button style="float:left;background:rgba(255,255,255,.2);border:none;color:#fff;' +
      'border-radius:6px;padding:3px 10px;cursor:pointer;font-family:inherit" ' +
      'onclick="this.parentNode.remove()">إخفاء</button>';
  }

  window.addEventListener("error", function (e) {
    var where = e.filename ? (" — " + String(e.filename).split("/").pop() + ":" + e.lineno) : "";
    banner((e.message || "خطأ غير معروف") + where);
  });

  window.addEventListener("unhandledrejection", function (e) {
    var m = (e.reason && (e.reason.message || e.reason)) || "طلب فشل بلا معالجة";
    banner(String(m));
  });
})();

/** تهريب النصوص قبل إدراجها في HTML */
function esc(v) {
  return String(v === undefined || v === null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ══════════════════════════════════════════════════════════
   حسابي: الصورة الشخصية وكلمة المرور
   ══════════════════════════════════════════════════════════ */

/** قائمة صغيرة تُفتح من زر الاسم في الشريط الأعلى */
Mirage.myAccount = function () {
  var u = this.session();
  return Swal.fire({
    title: esc(u.realName),
    html: '<div style="text-align:center;direction:rtl">' +
            '<div style="font-size:13px;color:#64748B;line-height:1.9">' +
              esc(u.jobTitle || u.role || "") + (u.project ? " · " + esc(u.project) : "") +
            '</div></div>',
    showCancelButton: true,
    // كلمة المرور من صلاحية مدير النظام وحده
    showDenyButton: this.isAdmin(),
    confirmButtonText: "🖼️ صورتي الشخصية",
    denyButtonText: "🔑 تغيير كلمة مروري",
    cancelButtonText: "إغلاق",
    confirmButtonColor: "#2563EB", denyButtonColor: "#0F172A", cancelButtonColor: "#64748B",
    width: 460
  }).then(function (r) {
    if (r.isConfirmed) return Mirage.avatar.dialog();
    if (r.isDenied) return Mirage.password.mine();
  });
};


Mirage.password = {
  /** كلمة مرور مدير النظام نفسه: الحالية، والجديدة مرتين */
  mine: function () {
    if (!Mirage.isAdmin()) {
      return Mirage.note("تغيير كلمات المرور من صلاحية مدير النظام وحده — راجعه.", "غير متاح");
    }
    return Swal.fire({
      title: "تغيير كلمة المرور",
      html:
        '<div style="text-align:right;direction:rtl">' +
          '<label style="font-size:13px;font-weight:800;display:block;margin-bottom:4px">كلمة المرور الحالية</label>' +
          '<input type="password" id="pwOld" class="swal2-input" style="margin:0 0 12px;width:100%" autocomplete="current-password">' +
          '<label style="font-size:13px;font-weight:800;display:block;margin-bottom:4px">الكلمة الجديدة</label>' +
          '<input type="password" id="pwNew" class="swal2-input" style="margin:0 0 12px;width:100%" autocomplete="new-password">' +
          '<label style="font-size:13px;font-weight:800;display:block;margin-bottom:4px">أعِد كتابتها</label>' +
          '<input type="password" id="pwNew2" class="swal2-input" style="margin:0 0 10px;width:100%" autocomplete="new-password">' +
          '<p style="font-size:12.5px;color:#64748B;line-height:1.8;margin:0">' +
            'ثمانية أحرف فأكثر. وتُطلب كلمتك الحالية أولاً، فلا يغيّرها من وجد جهازك مفتوحاً.<br>' +
            'ولتغيير كلمة مرور أي مستخدم آخر: إدارة النظام ← المستخدمون والصلاحيات ← زر 🔑.' +
          '</p>' +
        '</div>',
      width: 480,
      showCancelButton: true,
      confirmButtonText: "حفظ الكلمة الجديدة",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#2563EB", cancelButtonColor: "#64748B",
      focusConfirm: false,
      preConfirm: function () {
        var a = document.getElementById("pwOld").value;
        var b = document.getElementById("pwNew").value;
        var c = document.getElementById("pwNew2").value;
        if (!a) { Swal.showValidationMessage("اكتب كلمة المرور الحالية"); return false; }
        if (b.length < 8) { Swal.showValidationMessage("الكلمة الجديدة ثمانية أحرف فأكثر"); return false; }
        if (b !== c) { Swal.showValidationMessage("الكلمتان غير متطابقتين"); return false; }
        return { current: a, password: b };
      }
    }).then(function (r) {
      if (!r.isConfirmed) return;
      return Mirage.api("password_change", r.value).then(function (res) {
        if (res.status !== "success") return Mirage.fail(res);
        return Mirage.ok("غُيّرت كلمة مرورك. استعملها في الدخول القادم.", "تم");
      });
    });
  },

  /** مدير النظام يضع كلمة مرور لمستخدم آخر */
  set: function (username, realName, onDone) {
    return Swal.fire({
      title: "كلمة مرور لـ " + esc(realName || username),
      html:
        '<div style="text-align:right;direction:rtl">' +
          '<label style="font-size:13px;font-weight:800;display:block;margin-bottom:4px">الكلمة الجديدة</label>' +
          '<input type="text" id="apNew" class="swal2-input" style="margin:0 0 12px;width:100%" ' +
            'placeholder="ثمانية أحرف فأكثر">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="apGen" style="margin-bottom:12px">' +
            'وَلِّد كلمة قوية</button>' +
          '<div class="alert alert-warn" style="text-align:right;margin:0;font-size:12.5px;line-height:1.9">' +
            'ستعمل فوراً. سلّمها لصاحبها بنفسك واطلب منه تغييرها من زر اسمه في الأعلى. ' +
            'ويُسجَّل في سجلّ كلمات المرور أنك غيّرتها له، بتاريخه وساعته.' +
          '</div>' +
        '</div>',
      width: 500,
      showCancelButton: true,
      confirmButtonText: "تغيير كلمة المرور",
      cancelButtonText: "إلغاء",
      confirmButtonColor: "#DC2626", cancelButtonColor: "#64748B",
      focusConfirm: false,
      didOpen: function () {
        document.getElementById("apGen").onclick = function () {
          document.getElementById("apNew").value = Mirage.password.generate();
        };
      },
      preConfirm: function () {
        var v = document.getElementById("apNew").value;
        if (String(v).length < 8) { Swal.showValidationMessage("ثمانية أحرف فأكثر"); return false; }
        return v;
      }
    }).then(function (r) {
      if (!r.isConfirmed) return;
      return Mirage.api("password_set", { username: username, password: r.value }).then(function (res) {
        if (res.status !== "success") return Mirage.fail(res);
        if (onDone) onDone();
        return Swal.fire({
          icon: "success",
          title: "غُيّرت كلمة المرور",
          html: '<div style="text-align:right;direction:rtl;font-size:14px;line-height:1.9">' +
                  'حساب <b>' + esc(realName || username) + '</b> صار بكلمة المرور:' +
                  '<div style="font-family:monospace;direction:ltr;text-align:center;font-size:19px;' +
                  'font-weight:900;background:#F1F5F9;border-radius:10px;padding:12px;margin:10px 0">' +
                  esc(r.value) + '</div>' +
                  'انسخها الآن — لن تظهر مرة أخرى.</div>',
          confirmButtonText: "حسناً", confirmButtonColor: "#2563EB", width: 520
        });
      });
    });
  },

  /** كلمة قوية سهلة النقل: حروف وأرقام بلا ما يلتبس (0/O و1/l) */
  generate: function () {
    var A = "ABCDEFGHJKLMNPQRSTUVWXYZ", a = "abcdefghijkmnopqrstuvwxyz", n = "23456789";
    var all = A + a + n, out = "";
    var pick = function (s) { return s.charAt(Math.floor(Math.random() * s.length)); };
    out += pick(A) + pick(a) + pick(n);
    for (var i = 0; i < 7; i++) out += pick(all);
    return out.split("").sort(function () { return Math.random() - 0.5; }).join("");
  }
};


/* ══════════════════════════════════════════════════════════
   صورة المستخدم: تظهر بجانب اسمه في كل مكان
   ══════════════════════════════════════════════════════════ */

Mirage.avatar = {
  _urls: null,          // الاسم ← رابط مؤقت للصورة
  _asked: false,

  /** الحرفان الأولان من الاسم حين لا صورة */
  initials: function (name) {
    var p = String(name || "").trim().split(/\s+/);
    return ((p[0] || "").charAt(0) + (p[1] || "").charAt(0)) || "؟";
  },

  /** عنصر الصورة: يبدأ بالحرفين ثم تُستبدل بالصورة حين تصل */
  html: function (name, id, cls) {
    return '<span class="avatar ' + (cls || "") + '" ' +
           (id ? 'id="' + id + '" ' : '') +
           'data-avatar="' + esc(name || "") + '">' + esc(this.initials(name)) + '</span>';
  },

  /** يحمّل روابط الصور مرة واحدة ثم يملأ كل عنصر [data-avatar] في الصفحة */
  paint: function (force) {
    var self = this;
    var need = document.querySelectorAll("[data-avatar]");
    if (!need.length) return Promise.resolve();

    var go = function () {
      document.querySelectorAll("[data-avatar]").forEach(function (el) {
        var url = self._urls && self._urls[el.getAttribute("data-avatar")];
        if (url && el.getAttribute("data-done") !== url) {
          el.setAttribute("data-done", url);
          var who = el.getAttribute("data-avatar");
          // تعذّر تحميل الصورة: يعود الحرفان مكانها بلا أيقونة مكسورة
          el.innerHTML = '<img src="' + url + '" alt="" ' +
            'onerror="this.parentElement.textContent=\'' +
            String(Mirage.avatar.initials(who)).replace(/'/g, "") + '\'">';
        }
      });
    };

    if (this._urls && !force) { go(); return Promise.resolve(); }
    if (this._asked && !force) return Promise.resolve();
    this._asked = true;

    return Mirage.api("avatar_urls", {}).then(function (res) {
      self._urls = (res && res.urls) || {};
      go();
    }).catch(function () { self._urls = {}; });
  },

  /** نافذة الصورة الشخصية: عرض، تغيير، إزالة */
  dialog: function (username, name) {
    var self = this;
    var u = Mirage.session();
    var who = username || u.username;
    var nm = name || u.realName;
    var mine = who === u.username;
    if (!mine && !Mirage.isAdmin()) return;

    var url = this._urls && this._urls[nm];
    var pic = url
      ? '<img src="' + url + '" alt="" style="width:120px;height:120px;border-radius:50%;object-fit:cover;' +
        'border:3px solid #E2E8F0">'
      : '<div style="width:120px;height:120px;border-radius:50%;background:#F1F5F9;border:3px solid #E2E8F0;' +
        'display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:900;color:#2563EB">' +
        esc(this.initials(nm)) + '</div>';

    return Swal.fire({
      title: esc(nm),
      html: '<div style="text-align:center;direction:rtl">' +
              '<div style="display:flex;justify-content:center;margin-bottom:14px">' + pic + '</div>' +
              '<input type="file" id="avFile" accept="image/*" style="display:none">' +
              '<p style="font-size:13px;color:#64748B;line-height:1.9;margin:0">' +
                'صورة مربّعة أوضح. تُصغَّر تلقائياً قبل الرفع فلا تُثقل الهاتف.' +
              '</p>' +
            '</div>',
      width: 460,
      showCancelButton: true,
      showDenyButton: !!url,
      confirmButtonText: url ? "تغيير الصورة" : "اختيار صورة",
      denyButtonText: "إزالة الصورة",
      cancelButtonText: "إغلاق",
      confirmButtonColor: "#2563EB", denyButtonColor: "#DC2626", cancelButtonColor: "#64748B"
    }).then(function (r) {
      if (r.isDenied) return self.remove(who, nm);
      if (!r.isConfirmed) return;
      var inp = document.createElement("input");
      inp.type = "file"; inp.accept = "image/*";
      inp.onchange = function () {
        if (inp.files && inp.files[0]) self.upload(inp.files[0], who, nm);
      };
      inp.click();
    });
  },

  /** يصغّر الصورة إلى مربّع 256 بكسل ثم يرفعها */
  upload: function (file, username, name) {
    var self = this;
    if (!/^image\//.test(file.type)) return Mirage.fail({ message: "اختر ملف صورة" });

    Mirage.toast("جارٍ تجهيز الصورة…", "info");
    return this._square(file).then(function (blob) {
      return Mirage.api("avatar_upload", {
        blob: blob, username: username, ext: "jpg"
      });
    }).then(function (res) {
      if (!res || res.status !== "success") return Mirage.fail(res || {});
      self._asked = false;
      return self.paint(true).then(function () {
        Mirage.ok("حُفظت الصورة.", "تم");
      });
    }).catch(function (e) {
      Mirage.fail({ message: "تعذّر رفع الصورة", raw: String(e) });
    });
  },

  remove: function (username, name) {
    var self = this;
    return Mirage.confirm("ستُزال صورتك ويعود الحرفان مكانها.", "إزالة الصورة").then(function (yes) {
      if (!yes) return;
      return Mirage.api("avatar_save", { path: "", username: username }).then(function (res) {
        if (res.status !== "success") return Mirage.fail(res);
        if (self._urls) delete self._urls[name];
        document.querySelectorAll('[data-avatar="' + name + '"]').forEach(function (el) {
          el.removeAttribute("data-done");
          el.innerHTML = esc(self.initials(name));
        });
        Mirage.toast("أُزيلت الصورة");
      });
    });
  },

  /** قصّ مربّع من وسط الصورة وتصغيرها */
  _square: function (file) {
    return new Promise(function (ok, no) {
      var img = new Image();
      var fr = new FileReader();
      fr.onload = function () { img.src = fr.result; };
      fr.onerror = function () { no(new Error("تعذّرت قراءة الصورة")); };
      img.onload = function () {
        var S = 256;
        var side = Math.min(img.width, img.height);
        var sx = (img.width - side) / 2, sy = (img.height - side) / 2;
        var c = document.createElement("canvas");
        c.width = S; c.height = S;
        c.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, S, S);
        c.toBlob(function (b) { b ? ok(b) : no(new Error("تعذّر تجهيز الصورة")); }, "image/jpeg", 0.85);
      };
      img.onerror = function () { no(new Error("الملف ليس صورة صالحة")); };
      fr.readAsDataURL(file);
    });
  }
};


/* ══════════════════════════════════════════════════════════
   العمل دون إنترنت: ما يُدخَل يُحفَظ على الجهاز ويُرفع عند عودة الاتصال
   ══════════════════════════════════════════════════════════ */

Mirage.queue = {
  key: function () { return "mgQueue:" + (Mirage.session().username || "u"); },

  all: function () {
    try { return JSON.parse(localStorage.getItem(this.key()) || "[]"); }
    catch (e) { return []; }
  },
  _save: function (list) {
    try { localStorage.setItem(this.key(), JSON.stringify(list)); } catch (e) {}
    Mirage.net.paint();
  },
  count: function () { return this.all().length; },

  /** يضيف طلباً مؤجَّلاً ويعيد وصفه */
  add: function (action, data, label) {
    var list = this.all();
    var item = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      at: new Date().toISOString(),
      action: action, data: data || {},
      label: label || Mirage.queue.labels[action] || action,
      tries: 0, error: ""
    };
    list.push(item);
    this._save(list);
    return item;
  },

  remove: function (id) {
    this._save(this.all().filter(function (x) { return x.id !== id; }));
  },
  clear: function () { this._save([]); },

  /** أسماء عربية لما ينتظر الرفع */
  labels: {
    violation_new: "بلاغ مخالفة", violation_decide: "قرار على بلاغ",
    violation_signature: "توقيع على بلاغ",
    readiness_new: "تقرير جهوزية", resignation_new: "نموذج ترك عمل",
    new_hire_new: "نموذج موظف جديد",
    followup_new: "تكليف مهمة", followup_update: "تحديث مهمة",
    task_update: "تحديث مهمة",
    employee_save: "حفظ بيانات موظف", employee_delete: "حذف موظف",
    suggestion_new: "اقتراح تحسيني", suggestion_answer: "ردّ على اقتراح",
    document_forward: "تمرير ملف", document_hold: "ردّ ملف",
    notification_open: "فتح إشعار", notifications_read: "تعليم الإشعارات مقروءة"
  },

  /** يرفع ما انتظر، واحداً تلو الآخر، ويعيد حصيلة الرفع */
  flush: function (quiet) {
    var self = this;
    if (this._busy) return Promise.resolve(null);
    var list = this.all();
    if (!list.length) return Promise.resolve(null);
    if (!navigator.onLine) return Promise.resolve(null);

    this._busy = true;
    Mirage.net.paint("sync");

    var done = 0, failed = [];

    var step = function (i) {
      if (i >= list.length) return Promise.resolve();
      var it = list[i];
      var payload = {};
      Object.keys(it.data || {}).forEach(function (k) { payload[k] = it.data[k]; });
      payload.__fromQueue = true;

      return MirageAPI.call(it.action, payload).then(function (res) {
        if (res && res.status === "success" && !res.queued) {
          done++;
          self.remove(it.id);
        } else {
          it.tries = (it.tries || 0) + 1;
          it.error = (res && res.message) || "لم يُقبل";
          failed.push(it);
          // نُبقي الفاشل في الطابور مع سبب الرفض
          var cur = self.all().map(function (x) { return x.id === it.id ? it : x; });
          self._save(cur);
        }
        return step(i + 1);
      }).catch(function () {
        failed.push(it);
        return step(i + 1);
      });
    };

    return step(0).then(function () {
      self._busy = false;
      Mirage.net.paint();
      if (Mirage.refreshBell) Mirage.refreshBell(false);

      if (!quiet && (done || failed.length)) {
        if (done && !failed.length) {
          Mirage.toast("رُفع " + Mirage.ltr(String(done)) + " من العمل المحفوظ على جهازك");
        } else if (failed.length) {
          Mirage.fail({
            message: "رُفع " + done + " وتعذّر رفع " + failed.length + ". " +
                     "ما تعذّر يبقى محفوظاً على جهازك — افتح مؤشّر الاتصال لمراجعته.",
            detail: failed.map(function (f) { return f.label + ": " + (f.error || "—"); }).join(" · ")
          }, "رفع العمل المحفوظ");
        }
      }
      return { done: done, failed: failed.length };
    });
  },

  /** نافذة «ما ينتظر الرفع» */
  show: function () {
    var list = this.all();
    if (!list.length) {
      return Mirage.note("لا شيء ينتظر الرفع — كل ما أدخلته وصل إلى النظام.", "العمل المحفوظ");
    }
    var rows = list.map(function (x) {
      return '<tr><td>' + esc(x.label) + '</td>' +
             '<td style="white-space:nowrap">' + Mirage.ltr(localStamp(x.at)) + '</td>' +
             '<td>' + (x.error ? '<span class="tag tag-red">' + esc(x.error) + '</span>'
                               : '<span class="tag tag-blue">بانتظار الإنترنت</span>') + '</td></tr>';
    }).join("");

    return Swal.fire({
      title: "ينتظر الرفع: " + Mirage.ltr(String(list.length)),
      html: '<div style="text-align:right;direction:rtl">' +
            '<p style="font-size:13.5px;color:#64748B;line-height:1.9;margin:0 0 12px">' +
            'هذا ما أدخلته والإنترنت مقطوع. يُرفع وحده فور عودة الاتصال، ولا يضيع بإغلاق الصفحة.</p>' +
            '<div class="table-wrap"><table><thead><tr><th>العمل</th><th>التاريخ</th><th>الحالة</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div></div>',
      width: 620,
      showCancelButton: true,
      confirmButtonText: "حاول الرفع الآن",
      cancelButtonText: "إغلاق",
      confirmButtonColor: "#2563EB", cancelButtonColor: "#64748B"
    }).then(function (r) {
      if (r.isConfirmed) {
        if (!navigator.onLine) return Mirage.note("ما زال الجهاز دون إنترنت.", "تعذّر الرفع");
        return Mirage.queue.flush();
      }
    });
  }
};


Mirage.net = {
  online: function () { return navigator.onLine !== false; },

  init: function () {
    var self = this;
    window.addEventListener("online", function () {
      self.paint();
      Mirage.toast("عاد الاتصال بالإنترنت");
      setTimeout(function () { Mirage.queue.flush(); }, 700);
    });
    window.addEventListener("offline", function () {
      self.paint();
      Mirage.toast("انقطع الإنترنت — ما تُدخله يُحفَظ على جهازك", "warning");
    });
    // ما بقي من جلسة سابقة يُرفع عند أول فتح
    setTimeout(function () { Mirage.queue.flush(true); }, 2500);
  },

  /** يرسم الشارة: متصل · دون إنترنت · بانتظار الرفع · جارٍ الرفع */
  paint: function (force) {
    var el = document.getElementById("mgNet");
    if (!el) return;
    var n = Mirage.queue.count();
    var state = force || (!this.online() ? "off" : n ? "wait" : "on");

    var map = {
      on:   { cls: "net-on",   txt: "متصل",                              tip: "الاتصال بالإنترنت سليم" },
      off:  { cls: "net-off",  txt: n ? "دون إنترنت · " + n : "دون إنترنت",
              tip: "لا إنترنت — ما تُدخله يُحفَظ على جهازك ويُرفع تلقائياً" },
      wait: { cls: "net-wait", txt: "بانتظار الرفع · " + n,
              tip: "عمل محفوظ على جهازك لم يُرفع بعد — اضغط للمراجعة" },
      sync: { cls: "net-sync", txt: "جارٍ الرفع…", tip: "يُرفع العمل المحفوظ الآن" }
    };
    var m = map[state] || map.on;

    el.className = "net-pill " + m.cls;
    el.title = m.tip;
    el.innerHTML = '<span class="dot"></span><span class="txt">' + esc(m.txt) + '</span>';
    el.onclick = (state === "off" || state === "wait") ? function () { Mirage.queue.show(); } : null;
    el.style.cursor = el.onclick ? "pointer" : "default";
  }
};


/* ══════════════════════════════════════════════════════════
   التطبيق على الهاتف (PWA) وإشعارات الهاتف
   ══════════════════════════════════════════════════════════ */
Mirage.pwa = {
  deferred: null,                              // حدث التثبيت في أندرويد/كروم

  isIOS: function () {
    var ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  },
  standalone: function () {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
           window.navigator.standalone === true;
  },

  init: function () {
    var self = this;
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost") return;

    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
    navigator.serviceWorker.addEventListener("message", function (e) {
      var t = e.data && e.data.type;
      if (t === "mirage-push") {
        if (Mirage.refreshBell) Mirage.refreshBell();
        Mirage.alertCenter({ title: e.data.title, body: e.data.body, url: e.data.url });
      }
      if (t === "mirage-resubscribe") Mirage.push.refresh(true);
    });
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      self.deferred = e;
      self.paintButton();
    });
    window.addEventListener("appinstalled", function () {
      self.deferred = null;
      self.paintButton();
      Mirage.toast && Mirage.toast("ثُبّت التطبيق على جهازك");
    });
  },

  /** زر «تثبيت التطبيق» في الشريط العلوي: يظهر فقط حين يكون التثبيت ممكناً ولم يتم بعد */
  paintButton: function () {
    var b = document.getElementById("mgInstall");
    if (!b) return;
    var show = !this.standalone() && (!!this.deferred || this.isIOS());
    b.style.display = show ? "" : "none";
  },

  install: function () {
    var self = this;
    if (this.deferred) {
      this.deferred.prompt();
      this.deferred.userChoice.then(function () { self.deferred = null; self.paintButton(); });
      return;
    }
    if (this.isIOS()) return this.iosHelp();
    Swal.fire({
      icon: "info", title: "تثبيت التطبيق", confirmButtonText: "حسناً", confirmButtonColor: "#2563EB",
      html: '<div style="text-align:right;line-height:2;font-size:14px">افتح قائمة المتصفح (⋮) ثم اختر ' +
            '<b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.</div>'
    });
  },

  iosHelp: function (forPush) {
    return Swal.fire({
      title: "تثبيت ميراج على آيفون",
      confirmButtonText: "فهمت", confirmButtonColor: "#2563EB",
      html: '<div style="text-align:right;line-height:2.1;font-size:14px">' +
        (forPush ? '<div class="alert alert-info" style="margin-bottom:10px">على آيفون تصل الإشعارات فقط بعد تثبيت التطبيق على الشاشة الرئيسية وفتحه منها.</div>' : '') +
        '1. افتح النظام في متصفح <b>Safari</b>.<br>' +
        '2. اضغط زر المشاركة <b>⬆︎</b> أسفل الشاشة.<br>' +
        '3. اختر <b>«إضافة إلى الشاشة الرئيسية»</b> ثم <b>«إضافة»</b>.<br>' +
        '4. افتح <b>ميراج</b> من أيقونته على الشاشة الرئيسية وسجّل الدخول.' +
        (forPush ? '<br>5. من صفحة الإشعارات اضغط <b>«تفعيل على هذا الجهاز»</b>.' : '') +
        '</div>'
    });
  }
};

Mirage.push = {
  supported: function () {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window &&
           (location.protocol === "https:" || location.hostname === "localhost");
  },

  _b64uToBytes: function (s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
  _bytesToB64u: function (buf) {
    var b = new Uint8Array(buf), bin = "";
    for (var i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },

  _reg: function () {
    return navigator.serviceWorker.register("sw.js").then(function () { return navigator.serviceWorker.ready; });
  },

  /** حالة هذا الجهاز: {supported, permission, subscribed, needInstall} */
  state: function () {
    var self = this;
    if (!this.supported()) {
      return Promise.resolve({
        supported: false, permission: "unsupported", subscribed: false,
        needInstall: Mirage.pwa.isIOS() && !Mirage.pwa.standalone()
      });
    }
    return this._reg().then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) {
        return { supported: true, permission: Notification.permission, subscribed: !!sub, sub: sub,
                 needInstall: false };
      })
      .catch(function () { return { supported: true, permission: Notification.permission, subscribed: false }; });
  },

  _save: function (sub) {
    var j = sub.toJSON();
    return Mirage.api("push_subscribe", {
      endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
      ua: (navigator.userAgent || "").slice(0, 300)
    });
  },

  /** يطلب الإذن ويسجّل هذا الجهاز للمستخدم الحالي */
  enable: function () {
    var self = this;
    if (!this.supported()) {
      if (Mirage.pwa.isIOS() && !Mirage.pwa.standalone()) { Mirage.pwa.iosHelp(true); }
      return Promise.resolve({ status: "error", message: "هذا المتصفح لا يدعم إشعارات الهاتف." });
    }
    return Notification.requestPermission().then(function (perm) {
      if (perm !== "granted") {
        return { status: "error", message: "لم يُسمح بالإشعارات على هذا الجهاز.",
                 detail: "فعّلها من إعدادات المتصفح أو الهاتف لهذا الموقع ثم أعد المحاولة." };
      }
      return Mirage.api("push_key", {}).then(function (k) {
        if (k.status !== "success") return k;
        if (!k.key) {
          return { status: "error", message: "إشعارات الهاتف لم تُجهَّز بعد.",
                   detail: "يجهّزها مدير النظام من: إدارة النظام ← إعدادات القوائم ← إشعارات الهاتف." };
        }
        return self._reg().then(function (reg) {
          return reg.pushManager.getSubscription().then(function (old) {
            // مفتاح مختلف عن اشتراك سابق: يُلغى القديم أولاً
            if (old && old.options && old.options.applicationServerKey &&
                self._bytesToB64u(old.options.applicationServerKey) !== k.key) {
              return old.unsubscribe().then(function () { return null; });
            }
            return old;
          }).then(function (old) {
            return old || reg.pushManager.subscribe({
              userVisibleOnly: true, applicationServerKey: self._b64uToBytes(k.key)
            });
          });
        }).then(function (sub) {
          return self._save(sub).then(function (r) {
            if (r.status === "success") { try { localStorage.setItem("mgPushAt", String(Date.now())); } catch (e) {} }
            return r;
          });
        });
      });
    }).catch(function (e) {
      return { status: "error", message: "تعذّر تفعيل الإشعارات على هذا الجهاز.", raw: String(e && e.message || e) };
    });
  },

  /** يوقف الإشعارات على هذا الجهاز */
  disable: function () {
    var self = this;
    return this.state().then(function (s) {
      if (!s.sub) return { status: "success" };
      var ep = s.sub.endpoint;
      return s.sub.unsubscribe().then(function () {
        return Mirage.api("push_unsubscribe", { endpoint: ep });
      });
    });
  },

  /** عند فتح أي صفحة: يعيد ربط الجهاز بالمستخدم الحالي (مرة كل 12 ساعة، أو فوراً عند الطلب) */
  refresh: function (force) {
    var self = this;
    if (!this.supported() || Notification.permission !== "granted") return Promise.resolve();
    var last = 0;
    try { last = +localStorage.getItem("mgPushAt") || 0; } catch (e) {}
    if (!force && Date.now() - last < 12 * 3600 * 1000) return Promise.resolve();
    return this.enable().catch(function () {});
  },

  /** عند تسجيل الخروج: لا تصل إشعارات هذا المستخدم إلى الجهاز بعد خروجه */
  detach: function () {
    if (!this.supported()) return Promise.resolve();
    var done = new Promise(function (r) { setTimeout(r, 2500); });
    var work = this.state().then(function (s) {
      try { localStorage.removeItem("mgPushAt"); } catch (e) {}
      if (!s.sub) return;
      return Mirage.api("push_unsubscribe", { endpoint: s.sub.endpoint });
    }).catch(function () {});
    return Promise.race([work, done]);
  },

  /**
   * بطاقة «إشعارات الهاتف» لهذا الجهاز داخل عنصر.
   * compact: شريط تنبيه صغير يظهر فقط إن لم تكن مفعّلة (للصفحة الرئيسية).
   */
  card: function (containerId, compact) {
    var self = this;
    var box = document.getElementById(containerId);
    if (!box) return;

    var paint = function () {
      self.state().then(function (s) {
        var ios = Mirage.pwa.isIOS(), app = Mirage.pwa.standalone();
        if (compact) {
          var dismissed = false;
          try { dismissed = localStorage.getItem("mgPushHide") === "1"; } catch (e) {}
          if (dismissed || (s.subscribed && s.permission === "granted") || s.permission === "denied") {
            box.innerHTML = ""; return;
          }
          if (!s.supported && !(ios && !app)) { box.innerHTML = ""; return; }
          box.innerHTML =
            '<div class="card push-banner">' +
              '<div class="pb-ico">📲</div>' +
              '<div class="pb-text"><b>' + (ios && !app ? 'ثبّت ميراج على هاتفك' : 'فعّل إشعارات الهاتف') + '</b>' +
              '<span>' + (ios && !app
                ? 'أضفه إلى الشاشة الرئيسية ليفتح كتطبيق وتصلك الإشعارات.'
                : 'تصلك المهام والبلاغات المحالة إليك فوراً، حتى والتطبيق مغلق.') + '</span></div>' +
              '<div class="btn-row">' +
                '<button class="btn btn-primary btn-sm" id="' + containerId + '_go">' + (ios && !app ? 'كيف أثبّته؟' : 'تفعيل') + '</button>' +
                '<button class="btn btn-ghost btn-sm" id="' + containerId + '_no">لاحقاً</button>' +
              '</div>' +
            '</div>';
          document.getElementById(containerId + "_no").onclick = function () {
            try { localStorage.setItem("mgPushHide", "1"); } catch (e) {}
            box.innerHTML = "";
          };
          document.getElementById(containerId + "_go").onclick = function () {
            if (ios && !app) return Mirage.pwa.iosHelp(true);
            var b = this; Mirage.busy(b, true);
            self.enable().then(function (r) {
              Mirage.busy(b, false);
              if (r.status !== "success") return Mirage.fail(r);
              Mirage.toast("فُعّلت إشعارات الهاتف على هذا الجهاز"); paint();
            });
          };
          return;
        }

        var status, tone, btns = "";
        if (!s.supported && ios && !app) {
          status = "على آيفون: ثبّت التطبيق على الشاشة الرئيسية أولاً، ثم افتحه منها وفعّل الإشعارات."; tone = "warn";
          btns = '<button class="btn btn-primary btn-sm" data-act="ios">طريقة التثبيت</button>';
        } else if (!s.supported) {
          status = "هذا المتصفح لا يدعم إشعارات الهاتف. استخدم Chrome أو Edge أو Safari حديثاً."; tone = "warn";
        } else if (s.permission === "denied") {
          status = "الإشعارات محظورة لهذا الموقع في إعدادات المتصفح أو الهاتف. اسمح بها من هناك ثم أعد تحميل الصفحة."; tone = "bad";
        } else if (s.subscribed && s.permission === "granted") {
          status = "مفعّلة على هذا الجهاز ✅ تصلك كل إشعاراتك حتى والتطبيق مغلق."; tone = "ok";
          btns = '<button class="btn btn-ghost btn-sm" data-act="test">إرسال إشعار تجريبي</button>' +
                 '<button class="btn btn-ghost btn-sm" data-act="screen">لا يظهر وسط الشاشة؟</button>' +
                 '<button class="btn btn-danger btn-sm" data-act="off">إيقاف على هذا الجهاز</button>';
        } else {
          status = "غير مفعّلة على هذا الجهاز. فعّلها لتصلك المهام والبلاغات فوراً."; tone = "info";
          btns = '<button class="btn btn-primary btn-sm" data-act="on">تفعيل على هذا الجهاز</button>';
        }
        box.innerHTML =
          '<div class="alert alert-' + (tone === "ok" ? "success" : tone === "bad" ? "danger" : tone === "warn" ? "warn" : "info") +
          '" style="margin:0 0 12px">' + status + '</div>' +
          (btns ? '<div class="btn-row">' + btns + '</div>' : '') +
          (!app && !ios && Mirage.pwa.deferred
            ? '<div class="hint" style="margin-top:10px">يمكنك أيضاً <a href="#" id="' + containerId + '_inst">تثبيت ميراج كتطبيق</a> على هذا الجهاز.</div>' : '');

        var inst = document.getElementById(containerId + "_inst");
        if (inst) inst.onclick = function (e) { e.preventDefault(); Mirage.pwa.install(); };

        box.querySelectorAll("[data-act]").forEach(function (b) {
          b.onclick = function () {
            var act = b.getAttribute("data-act");
            if (act === "ios") return Mirage.pwa.iosHelp(true);
            if (act === "screen") return self.screenHelp();
            Mirage.busy(b, true);
            var p = act === "on" ? self.enable() : act === "off" ? self.disable() : Mirage.api("push_test", {});
            p.then(function (r) {
              Mirage.busy(b, false);
              if (r && r.status !== "success") return Mirage.fail(r);
              if (act === "on") Mirage.toast("فُعّلت إشعارات الهاتف على هذا الجهاز");
              if (act === "off") Mirage.toast("أُوقفت على هذا الجهاز");
              if (act === "test") Mirage.toast(r.devices ? "أُرسل إلى " + r.devices + " جهاز — يصل خلال ثوانٍ" : "لا جهاز مفعّل لحسابك");
              paint();
            });
          };
        });
      });
    };
    paint();
    return { reload: paint };
  },

  /**
   * شرح كيف يُظهر الهاتف الإشعار وسط الشاشة وعلى الشاشة المقفلة.
   * النظام يرسل الإشعار بأعلى أولوية ويجعله لا يختفي حتى يُلمس،
   * أما مكان ظهوره فيحكمه الهاتف نفسه، وهذه إعداداته.
   */
  screenHelp: function () {
    var ios = Mirage.pwa.isIOS();
    var h =
      '<div style="text-align:right;direction:rtl;font-size:14px;line-height:2">' +
        '<div class="alert alert-info" style="margin:0 0 14px;text-align:right">' +
          'النظام يرسل كل إشعار بأعلى أولوية، ويجعله يبقى معروضاً مع اهتزاز حتى تلمسه. ' +
          'ومكان ظهوره — أعلى الشاشة أم وسطها — يحدّده هاتفك، وهذه إعداداته.' +
        '</div>' +
        (ios
          ? '<b>على آيفون</b><br>' +
            '١ — الإعدادات ← الإشعارات ← ميراج.<br>' +
            '٢ — «السماح بالإشعارات» مفعّل، و«شاشة القفل» و«لافتات» مؤشَّران.<br>' +
            '٣ — نمط اللافتة: اختر <b>دائم</b> — فيبقى الإشعار على الشاشة حتى تلمسه.<br>' +
            '٤ — «الإشعارات الفورية» أو «التسليم الفوري» مفعّل، و«ملخّص مجدول» متوقف لميراج.<br>' +
            '٥ — وضع «عدم الإزعاج» يخفي كل شيء؛ أضِف ميراج إلى المسموح إن استعملته.'
          : '<b>على أندرويد</b><br>' +
            '١ — الإعدادات ← التطبيقات ← <b>Chrome</b> (أو ميراج إن ثبّته) ← الإشعارات.<br>' +
            '٢ — افتح قناة الموقع (تحمل عنوان موقع ميراج) واجعل الأهمية <b>عالية / عاجل</b> ' +
            '— فيظهر الإشعار عائماً فوق الشاشة مع صوت.<br>' +
            '٣ — فعّل «الإظهار على شاشة القفل» و«إظهار المحتوى» ليُقرأ والهاتف مقفل.<br>' +
            '٤ — الإعدادات ← البطارية ← Chrome ← <b>غير مقيَّد</b>، وإلا تأخّرت الإشعارات.<br>' +
            '٥ — وضع «عدم الإزعاج» يكتم كل شيء؛ استثنِ Chrome إن استعملته.') +
        '<div class="hint" style="margin-top:16px;text-align:right">' +
          'وداخل النظام: كل إشعار جديد يظهر في نافذة وسط الشاشة لا تُغلق إلا بلمستك، ' +
          'ولا يظهر الإشعار نفسه مرتين.' +
        '</div>' +
      '</div>';
    return Swal.fire({
      title: "إظهار الإشعار وسط الشاشة",
      html: h, width: 600,
      confirmButtonText: "حسناً", confirmButtonColor: "#2563EB"
    });
  }
};

Mirage.pwa.init();
Mirage.net.init();


/* ══════════════════════════════════════════════════════════
   الملفات: اختيار المستلمين، والفتح والتنزيل برابط مؤقت
   ══════════════════════════════════════════════════════════ */

/**
 * منتقي مستخدمين بالبحث: يعيد { get(), clear() }.
 * المستخدمون من user_directory (النشطون فقط)، ويُستثنى المستخدم الحالي.
 */
Mirage.userPicker = function (containerId, opts) {
  opts = opts || {};
  var box = document.getElementById(containerId);
  var me = Mirage.session().realName;
  var users = [], chosen = [];

  box.innerHTML =
    '<div class="chip-list" id="' + containerId + '_chips" style="margin-bottom:10px"></div>' +
    '<input type="search" id="' + containerId + '_q" placeholder="ابحث بالاسم أو الوظيفة أو القسم أو المشروع…" autocomplete="off">' +
    '<div class="pick-scroll up-list" id="' + containerId + '_list" style="margin-top:10px"><div class="hint">جارٍ تحميل المستخدمين…</div></div>';

  var chips = document.getElementById(containerId + "_chips");
  var list = document.getElementById(containerId + "_list");
  var q = document.getElementById(containerId + "_q");

  function paintChips() {
    chips.innerHTML = chosen.length
      ? chosen.map(function (n, i) {
          return '<span class="chip">' + esc(n) + ' <button type="button" data-i="' + i + '" aria-label="إزالة">✕</button></span>';
        }).join('')
      : '<span class="hint" style="margin:0">لم تختر أحداً بعد — الملف لا يُرسل بلا مستلم.</span>';
    chips.querySelectorAll("button[data-i]").forEach(function (b) {
      b.onclick = function () { chosen.splice(+b.getAttribute("data-i"), 1); paintChips(); paintList(); };
    });
    if (opts.onChange) opts.onChange(chosen.slice());
  }

  function paintList() {
    var t = q.value.trim();
    var rows = users.filter(function (u) {
      if (opts.filter && !opts.filter(u)) return false;
      if (!t) return true;
      return (u.name + " " + u.job + " " + u.center + " " + u.project).indexOf(t) > -1;
    }).slice(0, 80);
    list.innerHTML = rows.length
      ? rows.map(function (u) {
          var on = chosen.indexOf(u.name) > -1;
          return '<label class="check-item' + (on ? ' checked' : '') + '">' +
            '<input type="checkbox" value="' + esc(u.name) + '"' + (on ? ' checked' : '') + '>' +
            '<span><b>' + esc(u.name) + '</b><span class="hint" style="display:block;margin:0">' +
            esc([u.job, u.center, u.project].filter(Boolean).join(' · ')) + '</span></span></label>';
        }).join('')
      : '<div class="hint">' + (opts.emptyText || 'لا نتائج.') + '</div>';
    list.querySelectorAll("input[type=checkbox]").forEach(function (c) {
      c.onchange = function () {
        var i = chosen.indexOf(c.value);
        if (c.checked && i < 0) chosen.push(c.value);
        if (!c.checked && i > -1) chosen.splice(i, 1);
        c.closest(".check-item").classList.toggle("checked", c.checked);
        paintChips();
      };
    });
  }

  q.oninput = paintList;
  Mirage.api("user_directory", {}).then(function (res) {
    if (res.status !== "success") {
      list.innerHTML = '<div class="alert alert-danger" style="margin:0">' + esc(res.message) +
        (res.detail ? '<br><span style="font-weight:500">' + esc(res.detail) + '</span>' : '') + '</div>';
      return;
    }
    users = (res.users || []).filter(function (u) { return u.name !== me; });
    paintList();
  });
  paintChips();

  return {
    get: function () { return chosen.slice(); },
    clear: function () { chosen = []; q.value = ""; paintChips(); paintList(); },
    /** حصر المعروضين بشرط — كاختيار القسم قبل اختيار أشخاصه */
    setFilter: function (fn, emptyText) {
      opts.filter = fn;
      if (emptyText) opts.emptyText = emptyText;
      chosen = []; q.value = "";
      paintChips(); paintList();
    }
  };
};

/** يفتح الملف أو ينزّله برابط مؤقت (ساعة) — لا يُنشأ الرابط إلا لمن يحقّ له */
Mirage.openFile = function (path, name, download, btn) {
  if (!path) return Mirage.note("لا ملف مرفقاً بهذه المراسلة");
  // تُفتح النافذة فوراً (قبل انتظار الخادم) حتى لا يمنعها متصفح الهاتف
  var win = download ? null : window.open("", "_blank");
  if (btn) Mirage.busy(btn, true);
  return Mirage.api("file_url", { path: path, download: download ? (name || "file") : "" }).then(function (r) {
    if (btn) Mirage.busy(btn, false);
    if (r.status !== "success" || !r.url) {
      if (win) win.close();
      return Mirage.fail(r.status === "success"
        ? { message: "لا تملك صلاحية فتح هذا الملف." }
        : { message: "لا تملك صلاحية فتح هذا الملف، أو لم يعد موجوداً.", raw: r.raw || r.message });
    }
    if (win) { win.opener = null; win.location.href = r.url; return; }
    var a = document.createElement("a");
    a.href = r.url; a.rel = "noopener"; a.download = name || "";
    document.body.appendChild(a); a.click(); a.remove();
  });
};

/** أزرار «عرض» و«تنزيل» لسطر ملف — البيانات في خصائص data-* لا في نص الكود */
Mirage.fileButtons = function (f) {
  if (!f.path) return '<span class="hint" style="margin:0">بلا مرفق</span>';
  var attrs = ' data-path="' + esc(f.path) + '" data-name="' + esc(f.file_name || "") + '"';
  return '<div class="btn-row" style="gap:6px;flex-wrap:nowrap">' +
    '<button type="button" class="btn btn-ghost btn-sm mg-file" data-dl="0"' + attrs + '><span class="btn-text">عرض</span><span class="spinner"></span></button>' +
    '<button type="button" class="btn btn-primary btn-sm mg-file" data-dl="1"' + attrs + '><span class="btn-text">تنزيل</span><span class="spinner"></span></button>' +
    '</div>';
};
document.addEventListener("click", function (e) {
  var b = e.target.closest && e.target.closest(".mg-file");
  if (!b) return;
  Mirage.openFile(b.getAttribute("data-path"), b.getAttribute("data-name"), b.getAttribute("data-dl") === "1", b);
});
