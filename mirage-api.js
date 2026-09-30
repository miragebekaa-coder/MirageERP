/* ══════════════════════════════════════════════════════════
   ميراج ERP — طبقة الاتصال بـ Supabase
   ------------------------------------------------------------
   تحلّ محلّ Code.gs بالكامل، وتحتفظ بأسماء الإجراءات وأشكال
   الاستجابة نفسها، فلا تحتاج صفحات النظام إلى أي تعديل.

   تُستدعى في كل صفحة قبل app.js:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="mirage-api.js"></script>
     <script src="app.js"></script>
   ══════════════════════════════════════════════════════════ */

/* الإعدادات كلها في config.js — لا تعدّل شيئاً في هذا الملف.
   وهذا ما يجعل تحديث النظام لا يمسّ إعداداتك. */

const SUPABASE_URL      = (typeof MIRAGE_URL !== "undefined") ? MIRAGE_URL : "";
const SUPABASE_ANON_KEY = (typeof MIRAGE_KEY !== "undefined") ? MIRAGE_KEY : "";
const EMAIL_DOMAIN      = (typeof MIRAGE_EMAIL_DOMAIN !== "undefined") ? MIRAGE_EMAIL_DOMAIN : "mirage.local";
const DOC_BUCKET        = (typeof MIRAGE_BUCKET !== "undefined") ? MIRAGE_BUCKET : "documents";

/**
 * يتحقّق من الإعدادات قبل أي اتصال.
 * الغرض منع أخطاء غامضة مثل «Headers.set: Cannot convert argument»
 * التي تظهر حين يبقى النص التوضيحي العربي مكان المفتاح.
 */
const MIRAGE_CONFIG_ERROR = (function () {
  if (typeof MIRAGE_URL === "undefined" || typeof MIRAGE_KEY === "undefined") {
    return "ملف config.js غير محمّل. تأكّد أنه موجود في المجلد وأن الصفحة تستدعيه قبل mirage-api.js.";
  }
  if (!SUPABASE_URL || /^https:\/\/x+\.supabase\.co$/.test(SUPABASE_URL)) {
    return "لم تضع رابط المشروع في config.js — القيمة ما زالت النص التوضيحي.";
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(SUPABASE_URL)) {
    return "رابط المشروع في config.js غير صحيح. الشكل المطلوب: https://xxxxxxxx.supabase.co";
  }
  if (!SUPABASE_KEY_LOOKS_OK(SUPABASE_ANON_KEY)) {
    return "المفتاح في config.js غير صحيح أو ما زال النص التوضيحي. " +
           "انسخ Publishable key من لوحة Supabase والصقه كما هو.";
  }
  return "";
})();

/** المفتاح يجب أن يكون حروفاً إنجليزية وأرقاماً فقط، ولا يحتوي حرفاً عربياً */
function SUPABASE_KEY_LOOKS_OK(k) {
  if (!k || k.length < 20) return false;
  if (/[^\x20-\x7E]/.test(k)) return false;          // أي حرف غير إنجليزي
  if (/x{8,}/.test(k)) return false;                   // النص التوضيحي
  return /^(sb_publishable_|eyJ)/.test(k);
}

if (MIRAGE_CONFIG_ERROR) {
  document.addEventListener("DOMContentLoaded", function () {
    var bar = document.createElement("div");
    bar.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;background:#7F1D1D;color:#fff;" +
      "padding:14px 18px;font-family:Tajawal,sans-serif;font-size:14px;font-weight:700;" +
      "direction:rtl;text-align:right;line-height:1.7";
    bar.textContent = "⚠️ إعداد ناقص — " + MIRAGE_CONFIG_ERROR;
    document.body.appendChild(bar);
  });
}

/** وقت الخادم (UTC) بتوقيت جهاز المستخدم: YYYY-MM-DD HH:MM */
function localStamp(ts) {
  if (!ts) return "";
  var d = new Date(ts);
  if (isNaN(d)) return String(ts).slice(0, 16).replace("T", " ");
  var z = function (n) { return (n < 10 ? "0" : "") + n; };
  return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) + " " + z(d.getHours()) + ":" + z(d.getMinutes());
}

const SB = MIRAGE_CONFIG_ERROR ? null : window.supabase.createClient(
  SUPABASE_URL, SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

const MirageAPI = {

  /* ═══════════ أدوات ═══════════ */

  /** VIO-0012 ← 12 */
  code: function (prefix, id) {
    return prefix + "-" + ("0000" + id).slice(-4);
  },

  /** 12 ← VIO-0012 */
  rawId: function (code) {
    var n = parseInt(String(code || "").split("-").pop(), 10);
    return isNaN(n) ? -1 : n;
  },

  err: function (e, fallback) {
    if (!e) return { status: "error", message: fallback || "حدث خطأ" };
    var msg = e.message || String(e);
    var out = { status: "error", message: fallback || "تعذّر تنفيذ العملية", detail: msg, raw: msg };

    if (e.code === "P0001") {
      // رسالة عربية صادرة عن قاعدة البيانات نفسها (قاعدة عمل) — تُعرض كما هي
      out.message = msg;
      out.detail = "";
    } else if (e.code === "PGRST202" || e.code === "42883" || e.code === "42703" || e.code === "42P01" ||
               /Could not find the function|schema cache|does not exist/i.test(msg)) {
      out.message = "تحتاج قاعدة البيانات إلى الترقية.";
      out.detail = "نفّذ ملفات الترقية الناقصة (10 ثم 11 ثم 12 ثم 13) في SQL Editor ثم أعد تحميل الصفحة.";
    } else if (e.code === "23514") {
      out.message = "بيانات غير مقبولة: تحقّق من التواريخ والحقول الإلزامية.";
    } else if (e.code === "42501" || /row-level security|violates row-level/i.test(msg)) {
      out.message = "لا تملك صلاحية هذه العملية.";
      out.detail = "سياسات قاعدة البيانات منعت الطلب. راجع مستوى صلاحيتك أو نطاق مشروعك.";
    } else if (e.code === "23505" || /duplicate key/i.test(msg)) {
      out.message = "السجل موجود مسبقاً.";
      out.detail = msg;
    } else if (e.code === "23503") {
      // الروابط الجديدة (الترقية ٢٦) تمنع حذف قيمة تستعملها البيانات
      if (/update or delete|still referenced/i.test(msg)) {
        out.message = "لا يمكن حذف هذه القيمة: سجلات في النظام ما زالت تستعملها.";
        out.detail = "احذف ارتباطها أولاً، أو وحّدها على قيمة أخرى من «إدارة النظام ← توحيد البيانات».";
      } else {
        out.message = "قيمة مرتبطة غير موجودة (مشروع أو مركز غير مسجّل).";
        out.detail = "أضِفها إلى قائمتها أولاً من «إعدادات القوائم».";
      }
    } else if (/Failed to fetch|NetworkError/i.test(msg)) {
      out.message = "تعذّر الوصول إلى قاعدة البيانات. تحقّق من الاتصال ومن رابط المشروع.";
    } else if (/JWT|not authenticated|session/i.test(msg)) {
      out.message = "انتهت جلستك. أعد تسجيل الدخول.";
    }

    // يُسجَّل العطل ليراه مدير النظام — عدا ما هو متوقَّع (صلاحية أو جلسة أو شبكة)
    try {
      var skip = /صلاحية|جلستك|الاتصال|موجود مسبقاً|ما زالت تستعملها/.test(out.message);
      if (!skip && typeof Mirage !== "undefined" && Mirage.recordError) {
        Mirage.recordError(out.message + " — " + msg, e.code ? ("code " + e.code) : "");
      }
    } catch (x) {}

    return out;
  },

  /**
   * مسار تخزين بحروف لاتينية فقط.
   * مستودع Supabase يرفض أي حرف عربي أو مسافة في المسار ويعيد «Invalid key»،
   * فلا يُبنى المسار من اسم المشروع ولا من اسم الملف أبداً.
   * الاسم العربي الأصلي يُحفظ في قاعدة البيانات ويظهر للمستخدم كما هو.
   *   docs/2026-09/1789797327442_k3f9a2.png
   */
  safeKey: function (folder, fileName) {
    var ext = String(fileName || "").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    if (!ext || ext === String(fileName || "").toLowerCase()) ext = "bin";
    var rnd = Math.random().toString(36).slice(2, 8);
    return folder + "/" + new Date().toISOString().slice(0, 7) + "/" + Date.now() + "_" + rnd + "." + ext;
  },

  /** يحوّل Data URL أو base64 إلى Blob */
  toBlob: function (b64, mime) {
    var bin = atob(String(b64).indexOf(",") > -1 ? String(b64).split(",")[1] : b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || "application/octet-stream" });
  },

  /**
   * يرفع صورة التوقيع إلى مستودع الملفات ويُرجع مسارها.
   * الصورة لا تُحفظ في قاعدة البيانات، فلا يتضخّم الجدول.
   */
  uploadSignature: async function (dataUrl) {
    if (!dataUrl || String(dataUrl).indexOf("data:image") !== 0) return null;
    try {
      var path = this.safeKey("signatures", "sign.png");
      var up = await SB.storage.from(DOC_BUCKET).upload(path, this.toBlob(dataUrl, "image/png"), {
        contentType: "image/png", upsert: false
      });
      return up.error ? null : path;
    } catch (e) { return null; }
  },

  /** أسماء النماذج اليومية كما تُحفظ في مسارات العمل */
  FORMS: {
    "المخالفات": "بلاغ المخالفة",
    "المتابعات": "تكليف مهمة ومتابعة",
    "الجهوزية_العددية": "تقرير الجهوزية",
    "المراسلات": "إرسال ملف",
    "ترك_العمل": "ترك العمل",
    "موظف_جديد": "موظف جديد"
  },

  /** الموظف/ة الجديد/ة: الفحوصات المعتمدة */
  EXAMS: [
    { key: "doctor",  label: "تقرير الطبيب" },
    { key: "PPD",     label: "فحص السل PPD" },
    { key: "CBC",     label: "فحص الدم CBC" },
    { key: "HCV",     label: "فحص HCV" },
    { key: "HBsAg",   label: "فحص الصفيرة HBs Ag" },
    { key: "Urine",   label: "فحص البول Urine Analysis" },
    { key: "HIV",     label: "فحص HIV" },
    { key: "Blood",   label: "فئة الدم Blood group test" },
    { key: "AntiHBs", label: "فحص مناعة الكبد Anti HBs" },
    { key: "XRay",    label: "تقرير Chest X-Ray" }
  ],

  PAYMENT: ["دفع من قبل المشرف (إيصال مرفق)", "طلب إرسال المبلغ من قبل إدارة الشركة"],

  /** رسالة واضحة إن لم تُنفَّذ ترقية قاعدة البيانات بعد */
  pushUpgrade: function (e) {
    var m = (e && (e.message || e.details || e.hint)) || "";
    if (/push_|does not exist|could not find|schema cache/i.test(m) && /function|relation|schema cache/i.test(m)) {
      return { status: "error", message: "إشعارات الهاتف غير مفعّلة في قاعدة البيانات بعد.",
               detail: "نفّذ الملف \u206612_push.sql\u2069 في SQL Editor ثم أعد تحميل الصفحة.", raw: m };
    }
    return null;
  },

  needUpgrade: function (e) {
    var m = (e && (e.message || e.details || e.hint)) || "";
    if (/does not exist|could not find|schema cache|column .* not/i.test(m)) {
      return { status: "error", message: "تحتاج قاعدة البيانات إلى الترقية.",
               detail: "نفّذ ملفات الترقية الناقصة (10 ثم 11 ثم 12 ثم 13) في SQL Editor ثم أعد تحميل الصفحة.", raw: m };
    }
    return null;
  },

  num: function (v) { var n = Number(v); return isNaN(n) ? 0 : n; },
  str: function (v) { return v === undefined || v === null ? "" : String(v).trim(); },

  /* ─────────── بصمة الجهاز ───────────
     معرّف عشوائي يبقى في هذا المتصفح وحده. لا يحمل أي بيان شخصي،
     وفائدته الوحيدة أن يُظهر حين يسجّل جهاز واحد لأكثر من شخص. */
  devId: function () {
    try {
      var k = "mgDevice", v = localStorage.getItem(k);
      if (!v) {
        v = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toUpperCase();
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) { return null; }
  },

  /* ─────────── سقف الصفوف ───────────
     جلب جدول كامل إلى المتصفح يبطئه مع نمو البيانات. فيُطلب عدد
     السجلات الفعلي مع أول ألفي سطر، وإن زادت أُعلِم المستخدم صراحةً
     بأن ما يراه جزء — فلا تختفي بيانات في صمت. */

  CAP: 2000,

  /** يضيف السقف وطلب العدّ الفعلي إلى أي استعلام */
  cap: function (q, p) {
    var n = this.num(p && p.limit) || this.CAP;
    return q.limit(n);
  },

  /** يبني بيانات «كم عُرض من كم» من رد الاستعلام */
  meta: function (r, shown, p) {
    var n = this.num(p && p.limit) || this.CAP;
    var total = (r && typeof r.count === "number") ? r.count : shown;
    return { total: total, shown: shown, truncated: total > shown, limit: n };
  },

  /** تقرير موحَّد لعمليتَي الاستيراد (الموظفون والمستخدمون) */
  importReport: function (d) {
    d = d || {};
    return {
      status: "success",
      applied: d.applied === true,
      total: Number(d.total || 0),
      inserted: Number(d.inserted || 0),
      updated: Number(d.updated || 0),
      errors: Number(d.errors || 0),
      rows: (d.rows || []).map(function (x) {
        return { row: Number(x.row || 0), name: x.name || "", message: x.message || "" };
      }),
      added: (d.added || []).map(function (x) { return { list: x.list, value: x.value }; })
    };
  },

  /** 2026-12 ← 2027-01 */
  nextMonth: function (m) {
    var y = parseInt(m.slice(0, 4), 10), mo = parseInt(m.slice(5, 7), 10) + 1;
    if (mo > 12) { mo = 1; y++; }
    return y + "-" + ("0" + mo).slice(-2);
  },

  /** حدّا الشهر للاستعلام: [أول يوم، أول يوم في الشهر التالي) */
  monthRange: function (m) { return [m + "-01", this.nextMonth(m) + "-01"]; },

  /* ═══════════ الموزّع ═══════════ */

  call: function (action, data) {
    if (MIRAGE_CONFIG_ERROR) {
      return Promise.resolve({
        status: "error",
        message: "إعداد ناقص في config.js",
        detail: MIRAGE_CONFIG_ERROR
      });
    }
    var fn = this.actions[action];
    if (!fn) {
      return Promise.resolve({ status: "error", message: "إجراء غير معروف: " + action });
    }
    var self = this;

    // دون إنترنت: ما يمكن تأجيله يُحفَظ على الجهاز ويُرفع عند عودة الاتصال
    if (this.QUEUEABLE[action] && navigator.onLine === false && !(data && data.__fromQueue)) {
      return Promise.resolve(this.park(action, data));
    }

    return fn.call(this, data || {}).catch(function (e) {
      // انقطع الاتصال أثناء الإرسال: يُحفَظ بدل أن يضيع
      if (self.QUEUEABLE[action] && self.netErr(e) && !(data && data.__fromQueue)) {
        return self.park(action, data);
      }
      return self.err(e);
    });
  },

  /** الإجراءات التي يصحّ تأجيلها: بيانات خالصة، بلا ملفات ولا حسابات دخول */
  QUEUEABLE: {
    violation_new: 1, violation_decide: 1, violation_signature: 1,
    readiness_new: 1, resignation_new: 1, new_hire_new: 1,
    followup_new: 1, followup_update: 1, task_update: 1,
    employee_save: 1, employee_delete: 1,
    suggestion_new: 1, suggestion_answer: 1,
    document_forward: 1, document_hold: 1,
    notification_open: 1, notifications_read: 1
  },

  /** هل الخطأ انقطاع اتصال لا رفض من الخادم؟ */
  netErr: function (e) {
    var m = String((e && (e.message || e.name)) || e || "");
    return /Failed to fetch|NetworkError|Network request failed|load failed|TypeError/i.test(m);
  },

  /** يحفظ الطلب على الجهاز ويُبلغ الصفحة أنه حُفظ لا أنه فشل */
  park: function (action, data) {
    // Mirage مُعرَّف بـ const فلا يظهر على window — يُشار إليه باسمه مباشرة
    var M = (typeof Mirage !== "undefined") ? Mirage : null;
    var it = (M && M.queue) ? M.queue.add(action, data) : null;
    if (M && M.toast) {
      M.toast("لا إنترنت — حُفظ على جهازك ويُرفع تلقائياً", "info");
    }
    return {
      status: "success", queued: true, offline: true,
      message: "حُفظ على جهازك — يُرفع تلقائياً عند عودة الإنترنت",
      label: it ? it.label : action
    };
  },

  actions: {

    /* ─────────── فحص ─────────── */
    /**
     * يقيس ثلاث مرات متتالية.
     * الأول يحمل فتح الاتصال والتشفير وإيقاظ المشروع من الخمول،
     * فالحكم على السرعة يكون بأفضل قياس لا بالأول.
     */
    ping: async function () {
      var times = [], fail = null;

      for (var i = 0; i < 3; i++) {
        var t0 = Date.now();
        var r = await SB.from("roles").select("name").limit(1);
        if (r.error) { fail = r.error; break; }
        times.push(Date.now() - t0);
      }
      if (fail) return this.err(fail, "قاعدة البيانات لا تستجيب");

      var best = Math.min.apply(null, times);
      var verdict, hint;

      if (best < 250) {
        verdict = "ممتاز";
        hint = "لا شيء يحتاج تعديلاً.";
      } else if (best < 600) {
        verdict = "مقبول";
        hint = "طبيعي للاتصال من لبنان إلى أوروبا.";
      } else if (best < 1200) {
        verdict = "بطيء";
        hint = "راجع منطقة المشروع في Project Settings ← General. " +
               "إن كانت خارج أوروبا أو الشرق الأوسط فهذا سببها.";
      } else {
        verdict = "بطيء جداً";
        hint = "إما أن منطقة المشروع بعيدة جغرافياً، أو أن شبكتك " +
               "نفسها بطيئة. اختبر سرعة الإنترنت وجرّب شبكة أخرى للمقارنة.";
      }

      return {
        status: "success", version: 2, backend: "Supabase",
        time: localStamp(new Date().toISOString()),
        ms: best, first: times[0], samples: times,
        verdict: verdict, hint: hint,
        cold: times.length > 1 && times[0] > best * 2
      };
    },

    /* ─────────── الدخول ─────────── */
    login: async function (p) {
      var username = this.str(p.username).toLowerCase();
      var auth = await SB.auth.signInWithPassword({
        email: username + "@" + EMAIL_DOMAIN,
        password: p.password
      });
      if (auth.error) {
        var m = auth.error.message || "";

        if (/not confirmed|Email not confirmed/i.test(m)) {
          return {
            status: "error",
            message: "حساب الدخول غير مؤكَّد.",
            detail: "إطفاء خيار Confirm email لا يُطبَّق على الحسابات المُنشأة قبله. " +
                    "نفّذ في SQL Editor: update auth.users set email_confirmed_at = now() " +
                    "where email_confirmed_at is null;",
            raw: m
          };
        }
        if (/Invalid login credentials/i.test(m)) {
          return {
            status: "error",
            message: "اسم المستخدم أو كلمة المرور غير صحيحة.",
            detail: "اكتب اسم المستخدم وحده (admin) بلا @mirage.local. " +
                    "وتحقّق من وجود الحساب: Authentication ← Users.",
            raw: m
          };
        }
        if (/rate limit|too many/i.test(m)) {
          return {
            status: "error",
            message: "محاولات كثيرة متتالية.",
            detail: "انتظر دقيقة ثم أعد المحاولة.", raw: m
          };
        }
        if (/Failed to fetch|NetworkError/i.test(m)) {
          return {
            status: "error",
            message: "تعذّر الوصول إلى المشروع.",
            detail: "راجع SUPABASE_URL و SUPABASE_ANON_KEY في أول mirage-api.js.",
            raw: m
          };
        }
        return {
          status: "error",
          message: "تعذّر الدخول.",
          detail: "رسالة Supabase الأصلية في التفاصيل أدناه.",
          raw: m
        };
      }

      var r = await SB.from("app_users").select("*").eq("id", auth.data.user.id).maybeSingle();
      if (r.error)   return this.err(r.error, "تعذّر قراءة بيانات حسابك");
      if (!r.data) {
        await SB.auth.signOut();
        return { status: "error", message: "حسابك غير مُهيّأ في النظام. راجع مدير النظام." };
      }
      if (r.data.state !== "نشط") {
        await SB.auth.signOut();
        return { status: "error", message: "هذا الحساب موقوف. راجع مدير النظام." };
      }

      var u = r.data;
      var pages = u.allowed_pages || [];
      if (u.access_level >= 2 || u.role === "Admin" || u.role === "HR") {
        pages = ["form_violation", "followups", "form_readiness", "upload",
                 "resignations", "new_hire", "my_tasks", "employees", "dashboard",
                 "followups_dashboard", "dashboard_readiness"];
        // صفحة إدارة النظام لمدير النظام وحده — قاعدة البيانات ترفض تعديلات غيره أصلاً
        if (u.role === "Admin" || u.access_level >= 3) pages.push("admin");
      }
      return {
        status: "success",
        username: u.username, real_name: u.real_name, job_title: u.job_title || "",
        department: u.center || "", role: u.role || "",
        direct_manager: u.direct_manager || "", project: u.project || "",
        access_level: u.access_level || 0, allowed_pages: pages,
        can_notify: !!u.can_notify
      };
    },

    logout: async function () {
      await SB.auth.signOut();
      return { status: "success" };
    },

    /* ─────────── الإقلاع: كل ما تحتاجه الصفحة في نداء واحد ─────────── */
    bootstrap: async function (p) {
      var wantEmp = this.str(p.need_employees) === "1";

      var q = [
        SB.from("centers").select("name").order("name"),
        SB.from("roles").select("name").order("name"),
        SB.from("projects").select("*").order("name"),
        SB.from("job_titles").select("name").order("name"),
        SB.from("doc_subjects").select("name").order("name"),
        SB.from("violation_catalog").select("*").order("code"),
        SB.rpc("my_route", { p_form: "المخالفات" }),
        SB.rpc("my_projects"),
        SB.rpc("my_level"),
        SB.rpc("is_top"),
        SB.rpc("my_team"),
        SB.rpc("my_team_users"),
        SB.from("doc_entities").select("name").order("name")
      ];
      var EMP_AT = q.length;
      if (wantEmp) {
        q.push(SB.from("employees")
          .select("emp_id, name, job, project, center, hire_date, state, work_hours")
          .order("name"));
      }

      var r = await Promise.all(q);
      // my_team_users من الترقية 11: إن لم تُنفَّذ بعد تبقى القائمة فارغة ولا يتعطّل التحميل
      if (r[11].error) r[11] = { data: [] };
      if (r[12] && r[12].error) r[12] = { data: [] };   // جدول الجهات من الترقية 16
      for (var i = 0; i < r.length; i++) {
        if (r[i].error) return this.err(r[i].error, "تعذّر تحميل بيانات النظام");
      }

      var names = function (rows) { return (rows || []).map(function (x) { return x.name; }); };
      var centers  = names(r[0].data);
      var roles    = names(r[1].data);
      var projects = names(r[2].data);

      // الفريق بكل مستوياته (من يتبعني مباشرة أو عبر مسؤولين وسيطين)
      var team = (r[10].data || []).map(function (x) {
        return { name: x.real_name, project: x.project || "", role: x.role || "", center: x.center || "" };
      });
      var route = r[6].data || [];

      var out = {
        status: "success",
        centers: centers, roles: roles, projects: projects,
        jobs: names(r[3].data), subjects: names(r[4].data),
        entities: (names(r[12] && r[12].data).length ? names(r[12].data)
                   : centers.concat(projects)).filter(function (v, i, a) { return v && a.indexOf(v) === i; }),
        violation_types: (r[5].data || []).map(function (x) {
          return { code: x.code, type: x.vtype, tiers: [x.tier1, x.tier2, x.tier3, x.tier4, x.tier5, x.tier6] };
        }),
        // مسار بلاغ المخالفة لهذا المستخدم بأسماء الأشخاص
        route_violations: route,
        flow_violations: route.map(function (x) { return x.label + " (" + x.name + ")"; }),
        project_rows: (r[2].data || []).map(function (x) {
          return { name: x.name, workers: x.required_workers,
                   supervisors: x.required_supervisors, managers: x.required_managers };
        }),
        my_projects: r[7].data || [],
        my_level: r[8].data,
        all_projects: !!r[9].data,
        team: team,
        // المستخدمون الذين يترأسهم (لمن مستواه 1 فأكثر) — يظهرون في خانة الموظف في بلاغ المخالفة
        team_users: (r[11].data || []).map(function (x) {
          return { username: x.username, name: x.real_name, job: x.job_title || "",
                   project: x.project || "", center: x.center || "", hire_date: x.hire_date || "" };
        })
      };

      if (p.project) {
        var pr = (r[2].data || []).filter(function (x) { return x.name === p.project; })[0];
        out.required = pr
          ? { workers: pr.required_workers, supervisors: pr.required_supervisors, managers: pr.required_managers }
          : { workers: 0, supervisors: 0, managers: 0 };
      }
      if (wantEmp) {
        out.employees = ((r[EMP_AT] || {}).data || []).map(function (e) {
          return {
            id: e.emp_id, name: e.name, job: e.job || "", project: e.project || "",
            center: e.center || "", hire_date: e.hire_date || "", state: e.state || "نشط",
            hours: e.work_hours || ""
          };
        });
      }
      return out;
    },

    get_lists: function (p) { return this.actions.bootstrap.call(this, p); },

    /* ─────────── صفحة الإدارة في نداء واحد ─────────── */
    admin_data: async function (p) {
      var r = await Promise.all([
        SB.from("centers").select("*").order("name"),
        SB.from("roles").select("name").order("name"),
        SB.from("job_titles").select("name").order("name"),
        SB.from("doc_subjects").select("name").order("name"),
        SB.from("projects").select("*").order("name"),
        SB.from("app_users").select("*").order("real_name"),
        SB.from("workflows").select("station, step_order")
          .eq("form", this.str(p.form) || "المخالفات").order("step_order"),
        SB.from("violation_catalog").select("*").order("code"),
        SB.from("user_workflows").select("username, form, stations").order("username"),
        SB.from("doc_entities").select("name").order("name")
      ]);
      if (r[9] && r[9].error) r[9] = { data: [] };        // جدول الجهات من الترقية 16
      for (var i = 0; i < r.length; i++) {
        if (r[i].error) return this.err(r[i].error, "تعذّر تحميل بيانات الإدارة");
      }
      var names = function (rows) { return (rows || []).map(function (x) { return x.name; }); };
      return {
        status: "success",
        centers: names(r[0].data), roles: names(r[1].data),
        center_rows: (r[0].data || []).map(function (c) {
          return { name: c.name, head: c.head || "", kind: c.kind || "" };
        }),
        user_flows: r[8].data || [],
        jobs: names(r[2].data), subjects: names(r[3].data), entities: names(r[9].data),
        projects: (r[4].data || []).map(function (x) {
          return {
            name: x.name, workers: x.required_workers,
            supervisors: x.required_supervisors, managers: x.required_managers
          };
        }),
        users: (r[5].data || []).map(function (u) {
          return {
            username: u.username, real_name: u.real_name, job_title: u.job_title || "",
            center: u.center || "", role: u.role || "", manager: u.direct_manager || "",
            project: u.project || "", access_level: u.access_level || 0,
            pages: u.allowed_pages || [], state: u.state || "نشط",
            can_notify: !!u.can_notify
          };
        }),
        flow: (r[6].data || []).map(function (x) { return x.station; }),
        catalog: (r[7].data || []).map(function (x) {
          return {
            code: x.code, vtype: x.vtype,
            tier1: x.tier1 || "", tier2: x.tier2 || "", tier3: x.tier3 || "",
            tier4: x.tier4 || "", tier5: x.tier5 || "", tier6: x.tier6 || ""
          };
        })
      };
    },

    /* ─────────── رؤساء الأقسام ونوعها ─────────── */
    center_set: async function (p) {
      var kind = this.str(p.kind);
      var r = await SB.from("centers").update({
        head: this.str(p.head) || null,
        kind: (kind === "hr" || kind === "top") ? kind : null
      }).eq("name", this.str(p.name));
      return r.error ? this.err(r.error, "تعذّر حفظ بيانات القسم") : { status: "success" };
    },

    /* ─────────── المسارات: العام والخاص بكل مستخدم ─────────── */
    user_flow_save: async function (p) {
      var username = this.str(p.username).toLowerCase(), form = this.str(p.form);
      if (!username || !form) return { status: "error", message: "المستخدم والنموذج مطلوبان" };
      var list = (p.stations || []).filter(function (x) { return x; });
      if (!list.length) {
        var d = await SB.from("user_workflows").delete().eq("username", username).eq("form", form);
        return d.error ? this.err(d.error, "تعذّر حذف المسار الخاص") : { status: "success", count: 0 };
      }
      var r = await SB.from("user_workflows").upsert({
        username: username, form: form, stations: list, updated_at: new Date().toISOString()
      });
      return r.error ? this.err(r.error, "تعذّر حفظ المسار الخاص") : { status: "success", count: list.length };
    },

    route_preview: async function (p) {
      var r = await SB.rpc("route_preview", { p_form: this.str(p.form), p_username: this.str(p.username) });
      if (r.error) return this.err(r.error, "تعذّرت معاينة المسار");
      return { status: "success", route: r.data || [] };
    },

    my_route: async function (p) {
      var r = await SB.rpc("my_route", { p_form: this.str(p.form) });
      if (r.error) return this.err(r.error, "تعذّرت قراءة المسار");
      return { status: "success", route: r.data || [] };
    },

    /* محطات المسار الفعلية للمستخدم الحالي (تخصيصه إن وُجد وإلا المسار العام) */
    my_flow: async function (p) {
      var form = this.str(p.form) || "المخالفات";
      var r = await SB.rpc("my_flow", { p_form: form });
      // قاعدة لم تُرقَّ بعد: المسار العام للنموذج
      if (r.error) return await this.actions.flows_get.call(this, { form: form });
      return {
        status: "success",
        stations: (r.data || []).map(function (s, i) { return { station: s, order: i + 1 }; })
      };
    },

    /* ─────────── لائحة المخالفات ─────────── */
    catalog_save: async function (p) {
      var code = this.str(p.code);
      if (!code) return { status: "error", message: "رقم المخالفة مطلوب" };
      if (!this.str(p.vtype)) return { status: "error", message: "نوع المخالفة مطلوب" };

      if (!this.str(p.tier1)) return { status: "error", message: "الدرجة الأولى من الجزاء مطلوبة" };

      var row = {
        code: code, vtype: this.str(p.vtype),
        tier1: this.str(p.tier1), tier2: this.str(p.tier2), tier3: this.str(p.tier3),
        tier4: this.str(p.tier4), tier5: this.str(p.tier5), tier6: this.str(p.tier6)
      };
      var found = await SB.from("violation_catalog").select("code").eq("code", code).maybeSingle();
      if (found.data) {
        var up = await SB.from("violation_catalog").update(row).eq("code", code);
        return up.error ? this.err(up.error, "تعذّر التحديث") : { status: "success", mode: "update" };
      }
      var ins = await SB.from("violation_catalog").insert(row);
      return ins.error ? this.err(ins.error, "تعذّرت الإضافة") : { status: "success", mode: "insert" };
    },

    catalog_delete: async function (p) {
      var r = await SB.from("violation_catalog").delete().eq("code", this.str(p.code));
      return r.error ? this.err(r.error, "تعذّر الحذف") : { status: "success" };
    },

    /* ─────────── الإشعارات ─────────── */
    notifications_list: async function (p) {
      var q = SB.from("notifications").select("*").order("created_at", { ascending: false })
        .limit(this.num(p.limit) || 40);
      if (this.str(p.unread) === "1") q = q.eq("is_read", false);
      var r = await q;
      if (r.error) return this.err(r.error, "تعذّر تحميل الإشعارات");
      return {
        status: "success",
        unread: (r.data || []).filter(function (n) { return !n.is_read; }).length,
        items: (r.data || []).map(function (n) {
          return {
            id: n.id, kind: n.kind, title: n.title, body: n.body || "",
            ref_type: n.ref_type || "", ref_id: n.ref_id, read: !!n.is_read,
            sender: n.sender || "النظام",
            month: (n.created_at || "").slice(0, 7),
            year: (n.created_at || "").slice(0, 4),
            at: localStamp(n.created_at)
          };
        })
      };
    },

    notification_open: async function (p) {
      var id = this.num(p.id);
      if (!id) return { status: "error", message: "رقم الإشعار مفقود" };
      var r = await SB.from("notifications").update({ is_read: true }).eq("id", id);
      if (r.error) return this.err(r.error, "تعذّر فتح الإشعار");
      return { status: "success" };
    },

    notifications_read: async function (p) {
      var q = SB.from("notifications").update({ is_read: true });
      q = p.id ? q.eq("id", this.num(p.id)) : q.eq("is_read", false);
      var r = await q;
      return r.error ? this.err(r.error, "تعذّر التحديث") : { status: "success" };
    },

    /** إشعار عام لكل المستخدمين — للإدارة العليا وحدها */
    broadcast_send: async function (p) {
      var title = this.str(p.title);
      if (!title) return { status: "error", message: "عنوان الإشعار مطلوب" };

      var r = await SB.rpc("broadcast_notice", {
        p_title: title,
        p_body: this.str(p.body)
      });
      if (r.error) {
        var m = r.error.message || "";
        if (/غير مصرّح|not authorized/i.test(m)) {
          return {
            status: "error",
            message: "الإشعار العام للإدارة العليا فقط.",
            detail: "يلزم مستوى صلاحية ٢ أو صلاحية Admin أو HR.", raw: m
          };
        }
        if (/does not exist|could not find/i.test(m)) {
          return {
            status: "error",
            message: "دالة الإشعار العام غير موجودة.",
            detail: "نفّذ ملف supabase/09_broadcast.sql في SQL Editor.", raw: m
          };
        }
        return this.err(r.error, "تعذّر إرسال الإشعار");
      }
      return { status: "success", sent: r.data || 0 };
    },

    /* ─────────── الإشعارات الموجّهة ─────────── */
    /** ما يحقّ للمستخدم إرساله: الأشخاص والأقسام والمشاريع ضمن نطاقه */
    notice_scope: async function () {
      var r = await SB.rpc("notice_scope");
      if (r.error) return this.err(r.error, "تعذّر قراءة نطاق الإرسال");
      var d = r.data || {};
      return {
        status: "success", can_send: !!d.can_send, full: !!d.full,
        users: d.users || [], centers: (d.centers || []).sort(), projects: (d.projects || []).sort()
      };
    },

    notice_send: async function (p) {
      var title = this.str(p.title);
      if (!title) return { status: "error", message: "عنوان الإشعار مطلوب" };
      var r = await SB.rpc("send_notice", {
        p_title: title, p_body: this.str(p.body), p_project: this.str(p.project),
        p_target_type: this.str(p.target_type) || "all", p_targets: p.targets || []
      });
      if (r.error) return this.err(r.error, "تعذّر إرسال الإشعار");
      return { status: "success", id: r.data.id, sent: r.data.sent };
    },

    /** سجل الإشعارات المرسلة — المدير يرى الكل، والمسؤول ما أرسله */
    /* ─────────── إشعارات الهاتف (الترقية 12) ─────────── */
    push_key: async function () {
      var r = await SB.rpc("push_public_key");
      if (r.error) return this.pushUpgrade(r.error) || this.err(r.error, "تعذّر قراءة إعداد الإشعارات");
      return { status: "success", key: r.data || "" };
    },

    push_subscribe: async function (p) {
      var r = await SB.rpc("push_subscribe", {
        p_endpoint: this.str(p.endpoint), p_p256dh: this.str(p.p256dh),
        p_auth: this.str(p.auth), p_user_agent: this.str(p.ua)
      });
      if (r.error) return this.pushUpgrade(r.error) || this.err(r.error, "تعذّر تسجيل هذا الجهاز");
      return { status: "success" };
    },

    push_unsubscribe: async function (p) {
      var r = await SB.rpc("push_unsubscribe", { p_endpoint: this.str(p.endpoint) });
      if (r.error) return this.pushUpgrade(r.error) || this.err(r.error, "تعذّر إلغاء تسجيل الجهاز");
      return { status: "success" };
    },

    push_test: async function () {
      var r = await SB.rpc("push_test");
      if (r.error) return this.pushUpgrade(r.error) || this.err(r.error, "تعذّر إرسال الإشعار التجريبي");
      return { status: "success", devices: r.data || 0 };
    },

    push_status: async function () {
      var r = await SB.rpc("push_status");
      if (r.error) return this.pushUpgrade(r.error) || this.err(r.error, "تعذّر قراءة حالة الإشعارات");
      return Object.assign({ status: "success" }, r.data || {});
    },

    /** مدير النظام: يحفظ مفاتيح التوقيع (يولّدها متصفحه) ورابط الدالة */
    push_setup: async function (p) {
      var r = await SB.rpc("push_setup", {
        p_public: this.str(p.public), p_private: this.str(p.private),
        p_function_url: SUPABASE_URL + "/functions/v1/send-push",
        p_reset: this.str(p.reset) === "1"
      });
      if (r.error) return this.pushUpgrade(r.error) || this.err(r.error, "تعذّر حفظ إعداد الإشعارات");
      return Object.assign({ status: "success" }, r.data || {});
    },

    /** هل الدالة send-push منشورة وتستقبل الطلبات؟ */
    push_ping: async function () {
      var url = SUPABASE_URL + "/functions/v1/send-push";
      try {
        var res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
                                     body: JSON.stringify({ ping: true }) });
        if (res.status === 404) {
          return { status: "error", message: "الدالة send-push غير منشورة.",
                   detail: "أنشئها من Supabase ← Edge Functions باسم send-push تماماً، والصق ملف index.ts." };
        }
        if (res.status === 401 || res.status === 403) {
          return { status: "error", message: "الدالة منشورة لكن خيار Verify JWT ما زال مفعّلاً.",
                   detail: "من Supabase ← Edge Functions ← send-push ← Details: أطفئ Verify JWT ثم احفظ." };
        }
        var j = {}; try { j = await res.json(); } catch (e) {}
        if (res.ok && j.ok) return { status: "success", url: url };
        return { status: "error", message: "الدالة ردّت برمز " + res.status, raw: JSON.stringify(j) };
      } catch (e) {
        return { status: "error", message: "تعذّر الوصول إلى الدالة send-push.",
                 detail: "غالباً لم تُنشر بعد، أو ما زال خيار Verify JWT مفعّلاً فيها.", raw: String(e) };
      }
    },

    notices_log: async function (p) {
      var q = SB.from("notices").select("*").order("created_at", { ascending: false }).limit(300);
      if (this.str(p.month)) {
        var m = this.str(p.month);
        q = q.gte("created_at", m + "-01").lt("created_at", this.nextMonth(m) + "-01");
      }
      if (this.str(p.project)) q = q.eq("project", this.str(p.project));
      var r = await q;
      if (r.error) return this.err(r.error, "تعذّر تحميل سجل الإشعارات");
      var TT = { all: "كل المستخدمين", centers: "أقسام", users: "أشخاص", projects: "مشاريع" };
      return {
        status: "success",
        items: (r.data || []).map(function (n) {
          return {
            id: n.id, sender: n.sender, title: n.title, body: n.body || "", project: n.project || "",
            target: TT[n.target_type] || n.target_type, targets: n.targets || [],
            recipients: n.recipients, names: n.recipient_names || [],
            at: localStamp(n.created_at)
          };
        })
      };
    },

    /* ─────────── مهامي: ما سجّلته أنا، وما كُلّفت به ─────────── */
    my_tasks: async function () {
      var self = this;
      var me = Mirage.session().realName;
      // استعلامان منفصلان بدل .or() لأن الأسماء العربية قد تحوي فواصل
      var r = await Promise.all([
        SB.from("followups").select("*").eq("assignee", me),
        SB.from("followups").select("*").eq("created_name", me)
      ]);
      if (r[0].error) return this.err(r[0].error, "تعذّر تحميل مهامك");
      if (r[1].error) return this.err(r[1].error, "تعذّر تحميل مهامك");

      var seen = {}, rows = [];
      r[0].data.concat(r[1].data).forEach(function (f) {
        if (!seen[f.id]) { seen[f.id] = 1; rows.push(f); }
      });
      rows.sort(function (a, b) { return b.id - a.id; });

      return {
        status: "success",
        tasks: rows.map(function (f) {
          var mine = f.created_name === me;
          var toMe = f.assignee === me;
          return {
            id: self.code("FUP", f.id), raw: f.id,
            project: f.project || "", by: f.created_name || "", assignee: f.assignee || "",
            description: f.description || "", entity: f.entity || "",
            classification: f.classification || "", state: f.state || "",
            notes: f.notes || "", direction: f.direction || "",
            created_by_me: mine, assigned_to_me: toMe,
            // من يحقّ له تحديث الحالة من هذه الصفحة: المُكلَّف، أو من سجّلها ولم يكلّف بها أحداً
            can_act: toMe || (mine && !f.assignee),
            month: (f.created_at || "").slice(0, 7),
            date: localStamp(f.created_at),
            due: f.due_date || "",
            // يوم المهمة في الرزنامة: الاستحقاق إن حُدّد، وإلا يوم التسجيل
            day: f.due_date || (localStamp(f.created_at) || "").slice(0, 10),
            updated: localStamp(f.updated_at),
            entry_by: f.created_by || "", entry_at: localStamp(f.created_at)
          };
        })
      };
    },

    /** تحديث الحالة و/أو إضافة ملاحظة — الملاحظة تُضاف بتاريخها واسم كاتبها ولا تمحو ما قبلها */
    task_update: async function (p) {
      var id = this.rawId(p.id);
      if (id < 0) return { status: "error", message: "رقم المهمة غير صحيح" };
      var r = await SB.rpc("followup_add_note", {
        p_id: id, p_text: this.str(p.notes), p_state: this.str(p.state) || null
      });
      return r.error ? this.err(r.error, "تعذّر تحديث المهمة") : { status: "success" };
    },

    /* ─────────── فحص مستودع الملفات ─────────── */
    storage_check: async function () {
      var r = await SB.storage.from(DOC_BUCKET).list("", { limit: 1 });
      if (r.error) {
        var m = r.error.message || "";
        var out = { status: "error", message: "مستودع الملفات لا يعمل", raw: m };
        if (/not found|does not exist|Bucket not found/i.test(m)) {
          out.detail = 'لا يوجد مستودع باسم "' + DOC_BUCKET + '". أنشئه من: ' +
                       'Storage ← New bucket ← الاسم documents بحروف صغيرة ← Private.';
        } else if (/policy|denied|row-level|Unauthorized/i.test(m)) {
          out.detail = "المستودع موجود لكن سياساته ناقصة. أنشئ سياستي SELECT و INSERT " +
                       "من: Storage ← Policies ← documents ← New policy، بالشرط bucket_id = 'documents'.";
        } else {
          out.detail = "رسالة Supabase في التفاصيل أدناه.";
        }
        return out;
      }
      return { status: "success", message: "المستودع يعمل", bucket: DOC_BUCKET };
    },

    /* ─────────── القوائم ─────────── */
    settings_get: function () { return this.actions.admin_data.call(this, {}); },

    settings_add: async function (p) {
      var list = this.str(p.list), value = this.str(p.value);
      if (!value) return { status: "error", message: "القيمة فارغة" };

      if (list === "projects") {
        var r = await SB.from("projects").insert({
          name: value,
          required_workers: this.num(p.workers),
          required_supervisors: this.num(p.supervisors),
          required_managers: this.num(p.managers)
        });
        return r.error ? this.err(r.error, "تعذّرت إضافة المشروع") : { status: "success" };
      }

      var table = { centers: "centers", roles: "roles", jobs: "job_titles",
                    subjects: "doc_subjects", entities: "doc_entities" }[list];
      if (!table) return { status: "error", message: "قائمة غير معروفة: " + list };
      var res = await SB.from(table).insert({ name: value });
      return res.error ? this.err(res.error, "تعذّرت الإضافة") : { status: "success" };
    },

    settings_delete: async function (p) {
      var list = this.str(p.list);
      var table = { centers: "centers", roles: "roles", jobs: "job_titles",
                    subjects: "doc_subjects", projects: "projects", entities: "doc_entities" }[list];
      if (!table) return { status: "error", message: "قائمة غير معروفة" };
      var r = await SB.from(table).delete().eq("name", this.str(p.value));
      return r.error ? this.err(r.error, "تعذّر الحذف") : { status: "success" };
    },

    settings_set_required: async function (p) {
      var r = await SB.from("projects").update({
        required_workers: this.num(p.workers),
        required_supervisors: this.num(p.supervisors),
        required_managers: this.num(p.managers)
      }).eq("name", this.str(p.project));
      return r.error ? this.err(r.error, "تعذّر التحديث") : { status: "success" };
    },

    /* ─────────── الوظائف بمجموعتيها ─────────── */

    /** الوظائف التي يراها المستخدم: مجموعته وما دونها */
    my_jobs: async function () {
      var r = await SB.rpc("my_jobs");
      if (r.error) {
        // قاعدة لم تُرقَّ بعد: القائمة كاملة بلا تقسيم
        var f = await SB.from("job_titles").select("name").order("name");
        return { status: "success", jobs: (f.data || []).map(function (x) { return { name: x.name, level: 0 }; }) };
      }
      return {
        status: "success",
        jobs: (r.data || []).map(function (x) { return { name: x.name, level: Number(x.min_level || 0) }; })
      };
    },

    job_add: async function (p) {
      var r = await SB.rpc("job_add", { p_name: this.str(p.name), p_level: this.num(p.level) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّرت إضافة الوظيفة");
      return { status: "success" };
    },

    job_delete: async function (p) {
      var r = await SB.rpc("job_delete", { p_name: this.str(p.name) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حذف الوظيفة");
      return { status: "success" };
    },

    /* ─────────── مستويات الصلاحية ─────────── */

    access_levels: async function () {
      var r = await SB.rpc("access_levels_list");
      if (r.error) {
        return { status: "success", levels: [
          { level: 0, name: "مستخدم عادي", note: "", protected: true, users: 0 },
          { level: 1, name: "مدير (يرى فريقه)", note: "", protected: true, users: 0 },
          { level: 2, name: "إدارة عليا (ترى الكل)", note: "", protected: true, users: 0 }
        ] };
      }
      return {
        status: "success",
        levels: (r.data || []).map(function (x) {
          return {
            level: Number(x.level), name: x.name, note: x.note || "",
            protected: !!x.protected, users: Number(x.users || 0)
          };
        })
      };
    },

    access_level_save: async function (p) {
      var r = await SB.rpc("access_level_save", {
        p_level: this.num(p.level), p_name: this.str(p.name), p_note: this.str(p.note)
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حفظ المستوى");
      return { status: "success", admin_powers: !!(r.data && r.data.admin_powers) };
    },

    access_level_delete: async function (p) {
      var args = { p_level: this.num(p.level) };
      args.p_move_to = (p.move_to === "" || p.move_to === undefined || p.move_to === null)
        ? null : this.num(p.move_to);
      var r = await SB.rpc("access_level_delete", args);
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حذف المستوى");
      return { status: "success", moved: Number((r.data && r.data.moved) || 0) };
    },

    /* ─────────── الدوام والإجازات ─────────── */

    /** بيانات الموقع من رمزه — لصفحة المسح */
    attend_site: async function (p) {
      var r = await SB.rpc("attend_site", { p_code: this.str(p.code) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّرت قراءة الموقع");
      var d = r.data || {};
      return {
        status: "success",
        id: d.id, name: d.name || "", project: d.project || "",
        lat: d.lat, lng: d.lng, radius: Number(d.radius || 150),
        mode: d.mode || "static", person: d.person || "",
        cycle: Number(d.cycle || 30), one_per_code: d.one_per_code !== false,
        open: d.open === true,
        leave_types: d.leave_types || [],
        policy: d.policy || {}
      };
    },

    /** تسجيل حضور أو انصراف */
    attend_scan: async function (p) {
      var r = await SB.rpc("attend_scan", {
        p_code: this.str(p.code),
        p_kind: this.str(p.kind) || null,
        p_token: this.str(p.token) || null,
        p_lat: (p.lat === undefined || p.lat === null || p.lat === "") ? null : Number(p.lat),
        p_lng: (p.lng === undefined || p.lng === null || p.lng === "") ? null : Number(p.lng),
        p_acc: (p.acc === undefined || p.acc === null || p.acc === "") ? null : Number(p.acc),
        p_agent: navigator.userAgent,
        p_device: this.devId()
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تسجيل الدوام");
      var d = r.data || {};
      // الخادم رفض التسجيل (خارج النطاق مثلاً) — والمحاولة محفوظة عنده
      if (d.status === "rejected") {
        return {
          status: "error", blocked: true,
          message: d.reason || "لم يُقبل التسجيل من مكانك الحالي",
          flags: d.flags || [],
          distance: Number(d.distance || 0), radius: Number(d.radius || 0)
        };
      }
      return {
        status: "success", kind: d.kind, site: d.site, at: d.at,
        distance: Number(d.distance || 0), inside: d.inside,
        source: d.source, hours: Number(d.hours_today || 0), radius: Number(d.radius || 0),
        flags: d.flags || []
      };
    },

    /** الرمز المعروض الآن على شاشة الموقع */
    attend_code: async function (p) {
      var r = await SB.rpc("attend_code", { p_site_id: this.num(p.id) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر توليد الرمز");
      var d = r.data || {};
      return {
        status: "success", site: d.site, code: d.code, token: d.token,
        left: Number(d.left || 30), cycle: Number(d.cycle || 30)
      };
    },

    /** تسجيل إجازة */
    leave_new: async function (p) {
      var r = await SB.rpc("leave_new", {
        p_code: this.str(p.code) || null, p_kind: this.str(p.kind),
        p_from: this.str(p.from), p_to: this.str(p.to),
        p_reason: this.str(p.reason) || null,
        p_lat: (p.lat === undefined || p.lat === null || p.lat === "") ? null : Number(p.lat),
        p_lng: (p.lng === undefined || p.lng === null || p.lng === "") ? null : Number(p.lng),
        p_acc: (p.acc === undefined || p.acc === null || p.acc === "") ? null : Number(p.acc),
        p_device: this.devId(),
        p_token: this.str(p.token) || null
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تسجيل الإجازة");
      var d = r.data || {};
      if (d.status === "rejected") {
        return {
          status: "error", blocked: true,
          message: d.reason || "لم يُقبل التسجيل من مكانك الحالي",
          flags: d.flags || [], distance: Number(d.distance || 0)
        };
      }
      return {
        status: "success", id: d.id, days: Number(d.days || 0), kind: d.kind,
        flags: d.flags || []
      };
    },

    leave_decide: async function (p) {
      var r = await SB.rpc("leave_decide", {
        p_id: this.num(p.id), p_ok: p.ok === true || p.ok === "1",
        p_note: this.str(p.note) || null
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر اعتماد الإجازة");
      return { status: "success" };
    },

    /** سجلّ الدوام يوماً يوماً */
    attend_days: async function (p) {
      var r = await SB.rpc("attend_days", {
        p_from: this.str(p.from) || null, p_to: this.str(p.to) || null,
        p_person: this.str(p.person) || null,
        p_project: (this.str(p.project) && this.str(p.project) !== "all") ? this.str(p.project) : null
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تحميل سجلّ الدوام");
      return {
        status: "success",
        days: (r.data || []).map(function (x) {
          return {
            person: x.person, day: x.day, in: x.first_in || "", out: x.last_out || "",
            hours: Number(x.hours || 0), site: x.site || "",
            inside: x.inside, leave: x.leave_kind || "", state: x.state || ""
          };
        })
      };
    },

    leave_balance: async function (p) {
      var r = await SB.rpc("leave_balance", {
        p_person: this.str(p.person) || null,
        p_year: this.num(p.year) || null
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر قراءة الأرصدة");
      return {
        status: "success",
        rows: (r.data || []).map(function (x) {
          return {
            kind: x.kind, quota: Number(x.quota || 0), used: Number(x.used || 0),
            remaining: x.remaining === null ? null : Number(x.remaining), paid: !!x.paid
          };
        })
      };
    },

    leaves_list: async function (p) {
      var r = await SB.rpc("leaves_list", {
        p_from: this.str(p.from) || null, p_to: this.str(p.to) || null,
        p_person: this.str(p.person) || null, p_state: this.str(p.state) || null
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تحميل الإجازات");
      return {
        status: "success",
        items: (r.data || []).map(function (x) {
          return {
            id: x.id, person: x.person, project: x.project || "", kind: x.kind,
            from: x.from_date, to: x.to_date, days: Number(x.days || 0),
            reason: x.reason || "", state: x.state,
            by: x.decided_by || "", decided: x.decided_at || "",
            note: x.decision_note || "", at: x.at || ""
          };
        })
      };
    },

    /* ── إدارة الدوام (مدير النظام) ── */

    sites_list: async function () {
      var r = await SB.rpc("sites_list");
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تحميل المواقع");
      return {
        status: "success",
        sites: (r.data || []).map(function (x) {
          return {
            id: x.id, name: x.name, project: x.project || "", code: x.code,
            lat: x.lat, lng: x.lng, radius: Number(x.radius || 150),
            mode: x.mode, active: !!x.active, note: x.note || "", scans: Number(x.scans || 0),
            cycle: Number(x.rotate_sec || 30), one: x.one_per_code !== false
          };
        })
      };
    },

    site_save: async function (p) {
      var r = await SB.rpc("site_save", {
        p_id: this.num(p.id) || null, p_name: this.str(p.name),
        p_project: this.str(p.project) || null,
        p_lat: (p.lat === "" || p.lat === null || p.lat === undefined) ? null : Number(p.lat),
        p_lng: (p.lng === "" || p.lng === null || p.lng === undefined) ? null : Number(p.lng),
        p_radius: this.num(p.radius) || 150, p_mode: this.str(p.mode) || "static",
        p_active: p.active !== false,
        p_rotate: this.num(p.cycle) || 30,
        p_one: p.one !== false,
        p_note: this.str(p.note) || null
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حفظ الموقع");
      return { status: "success", id: (r.data && r.data.id) || 0 };
    },

    site_reset_code: async function (p) {
      var r = await SB.rpc("site_reset_code", { p_id: this.num(p.id) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تجديد الرمز");
      return { status: "success", code: (r.data && r.data.code) || "" };
    },

    site_delete: async function (p) {
      var r = await SB.rpc("site_delete", { p_id: this.num(p.id) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حذف الموقع");
      return { status: "success" };
    },

    leave_types: async function () {
      var r = await SB.from("leave_types").select("*").order("sort").order("name");
      if (r.error) return this.err(r.error, "تعذّر تحميل أنواع الإجازات");
      return {
        status: "success",
        types: (r.data || []).map(function (x) {
          return {
            name: x.name, quota: Number(x.quota_days || 0), paid: !!x.paid,
            self: !!x.self_serve, needs_note: !!x.needs_note, sort: Number(x.sort || 10)
          };
        })
      };
    },

    leave_type_save: async function (p) {
      var r = await SB.rpc("leave_type_save", {
        p_name: this.str(p.name), p_quota: this.num(p.quota),
        p_paid: p.paid !== false, p_self: p.self !== false,
        p_note_required: p.needs_note === true, p_sort: this.num(p.sort) || 10
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حفظ نوع الإجازة");
      return { status: "success" };
    },

    leave_type_delete: async function (p) {
      var r = await SB.rpc("leave_type_delete", { p_name: this.str(p.name) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حذف نوع الإجازة");
      return { status: "success" };
    },

    work_policy: async function () {
      var r = await SB.from("work_policy").select("*").eq("id", 1).maybeSingle();
      if (r.error || !r.data) return { status: "success", policy: {} };
      var d = r.data;
      return {
        status: "success",
        policy: {
          daily: Number(d.daily_hours || 8), week_days: Number(d.week_days || 6),
          weekend: d.weekend || [], grace: Number(d.grace_min || 15),
          gap: Number(d.min_gap_min || 5), max_shift: Number(d.max_shift_hours || 16),
          require_location: d.require_location !== false, note: d.note || "",
          outside: d.outside_action || "block",
          max_acc: Number(d.max_accuracy_m === undefined ? 250 : d.max_accuracy_m),
          max_speed: Number(d.max_speed_kmh === undefined ? 200 : d.max_speed_kmh),
          device_guard: d.device_guard !== false,
          leave_outside: d.leave_outside !== false,
          notify_flags: d.notify_flags !== false,
          watch: d.flag_watch || []
        }
      };
    },

    work_policy_save: async function (p) {
      var r = await SB.rpc("work_policy_save", {
        p_daily: Number(p.daily) || 8, p_week_days: this.num(p.week_days) || 6,
        p_weekend: Array.isArray(p.weekend) ? p.weekend : null,
        p_grace: this.num(p.grace), p_gap: this.num(p.gap),
        p_max_shift: Number(p.max_shift) || 16,
        p_require_loc: p.require_location !== false,
        p_outside: this.str(p.outside) || "block",
        p_max_acc: this.num(p.max_acc),
        p_max_speed: this.num(p.max_speed),
        p_device_guard: p.device_guard !== false,
        p_leave_outside: p.leave_outside !== false,
        p_notify_flags: p.notify_flags !== false,
        p_watch: Array.isArray(p.watch) ? p.watch : [],
        p_note: this.str(p.note) || null
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حفظ سياسة الدوام");
      return { status: "success" };
    },

    /** التسجيلات الموسومة بالاشتباه والمحاولات المرفوضة */
    attend_flags: async function (p) {
      p = p || {};
      var r = await SB.rpc("attend_flags", {
        p_from: this.str(p.from) || null,
        p_to: this.str(p.to) || null,
        p_person: this.str(p.person) || null
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّرت قراءة سجلّ الاشتباه");
      return { status: "success", rows: r.data || [] };
    },

    /* ─────────── سجلّ الأعطال ─────────── */

    /** يسجّل عطلاً بهدوء — لا يستدعي err أبداً حتى لا يستدعي نفسه */
    log_error: async function (p) {
      try {
        await SB.rpc("log_error", {
          p_message: this.str(p.message), p_page: this.str(p.page),
          p_kind: this.str(p.kind) || "js", p_detail: this.str(p.detail),
          p_agent: this.str(p.agent)
        });
      } catch (e) {}
      return { status: "success" };
    },

    /** آخر الأعطال — لمدير النظام */
    errors_list: async function (p) {
      var r = await SB.rpc("errors_list", { p_limit: this.num(p.limit) || 100 });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر قراءة سجلّ الأعطال");
      return {
        status: "success",
        items: (r.data || []).map(function (e) {
          return {
            id: e.id, at: e.at || "", who: e.who || "", page: e.page || "",
            kind: e.kind || "", message: e.message || "",
            detail: e.detail || "", agent: e.agent || ""
          };
        })
      };
    },

    errors_clear: async function (p) {
      var r = await SB.rpc("errors_clear", { p_days: this.num(p.days) || 0 });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تفريغ السجلّ");
      return { status: "success", deleted: Number((r.data && r.data.deleted) || 0) };
    },

    /** الترقيات المنفَّذة على قاعدة البيانات */
    schema_version: async function () {
      var r = await SB.from("schema_version").select("*").order("step", { ascending: false });
      if (r.error) return { status: "success", steps: [], last: 0 };
      var rows = r.data || [];
      return {
        status: "success",
        last: rows.length ? rows[0].step : 0,
        steps: rows.map(function (x) {
          return { step: x.step, title: x.title, at: localStamp(x.applied) };
        })
      };
    },

    /* ─────────── كلمات المرور ─────────── */

    /**
     * تغيير كلمة مرور مدير النظام نفسه.
     * تغيير كلمات المرور من صلاحيته وحده، وهذه لحسابه هو.
     * وتُتحقَّق الكلمة الحالية أولاً بتسجيل دخول جانبي لا يمسّ جلسته،
     * فلا يغيّرها من وجد الجهاز مفتوحاً.
     */
    password_change: async function (p) {
      var me = Mirage.session();
      if (!Mirage.isAdmin()) {
        return { status: "error", message: "تغيير كلمات المرور من صلاحية مدير النظام وحده" };
      }
      var old = this.str(p.current), nw = this.str(p.password);
      if (!old) return { status: "error", message: "اكتب كلمة المرور الحالية" };
      if (nw.length < 8) return { status: "error", message: "كلمة المرور الجديدة ثمانية أحرف فأكثر" };
      if (nw === old) return { status: "error", message: "الكلمة الجديدة مطابقة للحالية" };

      var tmp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      var chk = await tmp.auth.signInWithPassword({
        email: me.username + "@" + EMAIL_DOMAIN, password: old
      });
      if (chk.error) return { status: "error", message: "كلمة المرور الحالية غير صحيحة" };

      var up = await SB.auth.updateUser({ password: nw });
      if (up.error) return this.err(up.error, "تعذّر تغيير كلمة المرور");

      await SB.rpc("password_log", { p_username: me.username });
      return { status: "success" };
    },

    /**
     * تغيير كلمة مرور مستخدم آخر — لمدير النظام.
     * يتم في دالة Edge اسمها set-password، فمفتاح الخدمة يبقى في الخادم
     * ولا ينزل إلى المتصفح أبداً.
     */
    password_set: async function (p) {
      var u = this.str(p.username).toLowerCase(), nw = this.str(p.password);
      if (!u) return { status: "error", message: "اسم المستخدم مطلوب" };
      if (nw.length < 8) return { status: "error", message: "كلمة المرور ثمانية أحرف فأكثر" };

      var r = await SB.functions.invoke("set-password", { body: { username: u, password: nw } });

      if (r.error) {
        var msg = "تعذّر تغيير كلمة المرور";
        var detail = "";
        try {
          if (r.error.context && r.error.context.json) {
            var j = await r.error.context.json();
            msg = j.error || msg; detail = j.detail || "";
          }
        } catch (e) {}
        if (/Failed to send|NetworkError|Failed to fetch|not found|404/i.test(String(r.error.message || ""))) {
          return {
            status: "error",
            message: "الدالة set-password غير منشورة في مشروعك",
            detail: "لوحة Supabase ← Edge Functions ← Deploy a new function ← Via Editor، " +
                    "الاسم set-password، والصق ملف supabase/functions/set-password/index.ts."
          };
        }
        return { status: "error", message: msg, detail: detail, raw: String(r.error.message || "") };
      }

      var d = r.data || {};
      if (d.error) return { status: "error", message: d.error, detail: d.detail || "" };
      return { status: "success", username: d.username || u, real_name: d.real_name || "" };
    },

    /** سجلّ تغييرات كلمات المرور — لمدير النظام */
    password_events: async function (p) {
      var r = await SB.rpc("password_events_list", { p_limit: this.num(p.limit) || 100 });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر قراءة السجلّ");
      return {
        status: "success",
        items: (r.data || []).map(function (e) {
          return {
            id: e.id, username: e.username, name: e.real_name || "",
            by: e.by_name || "", self: !!e.by_self, at: e.at || ""
          };
        })
      };
    },

    /* ─────────── صورة المستخدم ─────────── */

    /** روابط مؤقتة لصور كل المستخدمين: الاسم ← رابط */
    avatar_urls: async function () {
      var r = await SB.rpc("avatars");
      if (r.error) return this.needUpgrade(r.error) || { status: "success", urls: {} };
      var rows = r.data || [];
      if (!rows.length) return { status: "success", urls: {} };

      var paths = rows.map(function (x) { return x.avatar; });
      var sig = await SB.storage.from("avatars").createSignedUrls(paths, 60 * 60 * 8);
      var byPath = {};
      if (!sig.error) {
        (sig.data || []).forEach(function (x) { if (x.signedUrl) byPath[x.path] = x.signedUrl; });
      }
      var urls = {};
      rows.forEach(function (x) { if (byPath[x.avatar]) urls[x.real_name] = byPath[x.avatar]; });
      return { status: "success", urls: urls };
    },

    /** رفع الصورة إلى المستودع ثم حفظ مسارها */
    avatar_upload: async function (p) {
      var me = Mirage.session();
      var who = this.str(p.username) || me.username;
      var path = who + "/" + Date.now() + "." + (this.str(p.ext) || "jpg");

      var up = await SB.storage.from("avatars").upload(path, p.blob, {
        contentType: "image/jpeg", upsert: true
      });
      if (up.error) return this.err(up.error, "تعذّر رفع الصورة");

      var r = await SB.rpc("avatar_save", { p_path: path, p_username: who });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حفظ الصورة");
      return { status: "success", path: path };
    },

    avatar_save: async function (p) {
      var r = await SB.rpc("avatar_save", {
        p_path: this.str(p.path), p_username: this.str(p.username) || null
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حفظ الصورة");
      return { status: "success" };
    },

    /* ─────────── النسخ الاحتياطي (مدير النظام وحده) ─────────── */

    /** نسخة كاملة، تُرفع إلى مستودع backups وتُسجَّل في السجلّ */
    backup_new: async function (p) {
      var d = await SB.rpc("backup_dump");
      if (d.error) return this.needUpgrade(d.error) || this.err(d.error, "تعذّر أخذ النسخة");

      var dump = d.data || {};
      var text = JSON.stringify(dump);
      var blob = new Blob([text], { type: "application/json" });
      var stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      var path = "mirage-" + stamp + ".json";

      var up = await SB.storage.from("backups").upload(path, blob, {
        contentType: "application/json", upsert: false
      });
      if (up.error) return this.err(up.error, "تعذّر حفظ النسخة في المستودع");

      var lg = await SB.rpc("backup_log", {
        p_path: path, p_bytes: blob.size,
        p_tables: Number(dump.tables || 0), p_rows: Number(dump.rows || 0),
        p_label: this.str(p.label) || null, p_note: this.str(p.note) || null
      });
      if (lg.error) return this.err(lg.error, "حُفظت النسخة لكن تعذّر تسجيلها");

      return {
        status: "success", path: path, bytes: blob.size,
        tables: Number(dump.tables || 0), rows: Number(dump.rows || 0)
      };
    },

    backups_list: async function () {
      var r = await SB.rpc("backups_list");
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر قراءة سجلّ النسخ");
      return {
        status: "success",
        items: (r.data || []).map(function (b) {
          return {
            id: b.id, label: b.label || "", by: b.made_by || "", at: b.made_at || "",
            path: b.path || "", bytes: Number(b.bytes || 0),
            tables: Number(b.tables || 0), rows: Number(b.rows_count || 0), note: b.note || ""
          };
        })
      };
    },

    /** رابط تنزيل مؤقت لنسخة */
    backup_url: async function (p) {
      var r = await SB.storage.from("backups").createSignedUrl(this.str(p.path), 600, {
        download: this.str(p.path)
      });
      if (r.error) return this.err(r.error, "تعذّر إنشاء رابط التنزيل");
      return { status: "success", url: r.data.signedUrl };
    },

    /** محتوى نسخة من المستودع */
    backup_read: async function (p) {
      var r = await SB.storage.from("backups").download(this.str(p.path));
      if (r.error) return this.err(r.error, "تعذّر قراءة ملف النسخة");
      var text = await r.data.text();
      try { return { status: "success", data: JSON.parse(text) }; }
      catch (e) { return { status: "error", message: "ملف النسخة تالف أو ليس من ميراج" }; }
    },

    /** الاستعادة: تحتاج كلمة «استعادة» حرفياً */
    backup_restore: async function (p) {
      var r = await SB.rpc("backup_restore", {
        p_data: p.data, p_confirm: this.str(p.confirm),
        p_only: Array.isArray(p.only) && p.only.length ? p.only : null
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّرت الاستعادة");
      var d = r.data || {};
      return {
        status: "success", tables: Number(d.tables || 0), rows: Number(d.rows || 0),
        skipped_users: Number(d.skipped_users || 0)
      };
    },

    /** حذف نسخة: الملف من المستودع والسطر من السجلّ */
    backup_delete: async function (p) {
      var path = this.str(p.path);
      if (path) await SB.storage.from("backups").remove([path]);
      var r = await SB.rpc("backup_forget", { p_id: this.num(p.id) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حذف النسخة");
      return { status: "success" };
    },

    /* ─────────── الاستيراد والتصدير (مدير النظام وحده) ─────────── */

    /** كل الموظفين بأعمدة عربية جاهزة لورقة إكسل */
    export_employees: async function () {
      var r = await SB.rpc("export_employees");
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تصدير الموظفين");
      return { status: "success", rows: r.data || [] };
    },

    /** كل المستخدمين بأعمدة عربية جاهزة لورقة إكسل */
    export_users: async function () {
      var r = await SB.rpc("export_users");
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تصدير المستخدمين");
      return { status: "success", rows: r.data || [] };
    },

    /** القوائم التي يُتحقَّق منها عند الاستيراد — تُكتب في ورقة «القيم المسموحة» */
    import_lists: async function () {
      var r = await SB.rpc("import_lists");
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر قراءة القوائم");
      return { status: "success", lists: r.data || {} };
    },

    /** استيراد الموظفين — معاينة (apply=false) ثم تنفيذ (apply=true) */
    import_employees: async function (p) {
      var r = await SB.rpc("import_employees", {
        p_rows: p.rows || [],
        p_apply: p.apply === true,
        p_add_missing: p.add_missing === true
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر استيراد الموظفين");
      if (p.apply === true) await SB.rpc("link_users_by_name");
      return this.importReport(r.data);
    },

    /**
     * استيراد المستخدمين: الخادم يحدّث الموجودين ويعيد الجدد،
     * ثم تُنشأ حسابات الدخول للجدد هنا لأن إنشاء الحساب لا يتم من قاعدة البيانات.
     */
    import_users: async function (p) {
      var r = await SB.rpc("import_users", {
        p_rows: p.rows || [],
        p_apply: p.apply === true,
        p_add_missing: p.add_missing === true
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر استيراد المستخدمين");

      var out = this.importReport(r.data);
      var fresh = (r.data && r.data.new_users) || [];

      // معاينة: نكتفي بالتنبيه إلى الحسابات التي تنقصها كلمة مرور
      if (p.apply !== true) {
        fresh.forEach(function (u) {
          if (!String(u.password || "").trim()) {
            out.errors++;
            out.rows.push({
              row: 0, name: u.real_name,
              message: "مستخدم جديد بلا كلمة مرور — اكتب كلمة مرور في عمود «كلمة المرور» لينشأ حسابه"
            });
            out.inserted--;
          }
        });
        return out;
      }

      // تنفيذ: حساب دخول لكل مستخدم جديد
      var made = 0;
      for (var i = 0; i < fresh.length; i++) {
        var u = fresh[i];
        if (!String(u.password || "").trim()) {
          out.errors++;
          out.rows.push({ row: 0, name: u.real_name, message: "لم يُنشأ حسابه: لا كلمة مرور في الملف" });
          continue;
        }
        var res = await this.actions.user_save.call(this, {
          username: u.username, real_name: u.real_name, job_title: u.job_title,
          center: u.center, role: u.role, manager: u.manager, project: u.project,
          access_level: u.access_level, state: u.state,
          can_notify: u.can_notify ? "1" : "", pages: u.pages, password: u.password
        });
        if (res.status !== "success") {
          out.errors++;
          out.rows.push({ row: 0, name: u.real_name, message: res.message || "تعذّر إنشاء الحساب" });
        } else {
          made++;
          if (String(u.emp_id || "").trim()) {
            await SB.from("app_users").update({ emp_id: String(u.emp_id).trim() }).eq("username", u.username);
          }
        }
      }
      out.inserted = made;

      // موظف ومستخدم في الملف نفسه: يُربطان بعد وصول الاثنين
      await SB.rpc("link_users_by_name");
      return out;
    },

    /* ─────────── توحيد المسميات (مدير النظام) ─────────── */

    /** كم سجلاً يستعمل هذه القيمة، وفي أي جدول */
    value_usage: async function (p) {
      var r = await SB.rpc("value_usage", { p_list: this.str(p.list), p_value: this.str(p.value) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر فحص الارتباطات");
      var rows = r.data || [];
      return {
        status: "success",
        total: rows.reduce(function (a, x) { return a + Number(x.rows || 0); }, 0),
        rows: rows.map(function (x) { return { tbl: x.tbl, col: x.col, rows: Number(x.rows || 0) }; })
      };
    },

    /** قيم تستعملها البيانات ولم تعد موجودة في القوائم */
    orphan_values: async function () {
      var r = await SB.rpc("orphan_values");
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر فحص القوائم");
      return {
        status: "success",
        rows: (r.data || []).map(function (x) {
          return { list: x.list, value: x.value, rows: Number(x.rows || 0) };
        })
      };
    },

    /** توحيد القيمة القديمة على الجديدة في كل الجداول — معاينة أو تنفيذ */
    rename_value: async function (p) {
      var r = await SB.rpc("rename_value", {
        p_list: this.str(p.list), p_old: this.str(p.old),
        p_new: this.str(p.new), p_apply: p.apply === true || p.apply === "1"
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر توحيد القيمة");
      var d = r.data || {};
      return {
        status: "success", applied: !!d.applied, total: Number(d.total || 0),
        details: (d.details || []).map(function (x) {
          return { tbl: x.tbl, col: x.col, rows: Number(x.rows || 0) };
        })
      };
    },

    /* ─────────── المستخدمون ─────────── */
    users_list: async function () {
      var r = await SB.from("app_users").select("*").order("real_name");
      if (r.error) return this.err(r.error, "تعذّر تحميل المستخدمين");
      return {
        status: "success",
        users: (r.data || []).map(function (u) {
          return {
            username: u.username, real_name: u.real_name, job_title: u.job_title || "",
            center: u.center || "", role: u.role || "", manager: u.direct_manager || "",
            project: u.project || "", access_level: u.access_level || 0,
            pages: u.allowed_pages || [], state: u.state || "نشط"
          };
        })
      };
    },

    user_save: async function (p) {
      var username = this.str(p.username).toLowerCase();
      if (!username) return { status: "error", message: "اسم المستخدم مطلوب" };

      var pages = this.str(p.pages).split(",").map(function (x) { return x.trim(); })
        .filter(function (x) { return x; });

      var row = {
        username: username,
        real_name: this.str(p.real_name),
        job_title: this.str(p.job_title),
        center: this.str(p.center),
        role: this.str(p.role),
        direct_manager: this.str(p.manager),
        project: this.str(p.project),
        access_level: this.num(p.access_level),
        allowed_pages: pages,
        state: this.str(p.state) || "نشط",
        can_notify: this.str(p.can_notify) === "1"
      };

      var existing = await SB.from("app_users").select("id").eq("username", username).maybeSingle();
      if (existing.error) return this.err(existing.error, "تعذّر التحقّق من المستخدم");

      if (existing.data) {
        var up = await SB.from("app_users").update(row).eq("id", existing.data.id);
        if (up.error) return this.err(up.error, "تعذّر تحديث المستخدم");
        var note = this.str(p.password)
          ? "تغيير كلمة المرور لمستخدم قائم يتم من لوحة Supabase: Authentication ← Users."
          : "";
        return { status: "success", mode: "update", note: note };
      }

      if (!this.str(p.password)) {
        return { status: "error", message: "كلمة المرور مطلوبة للمستخدم الجديد" };
      }

      // عميل ثانٍ بلا حفظ جلسة، حتى لا يُخرج المدير من حسابه
      var tmp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      var signed = await tmp.auth.signUp({
        email: username + "@" + EMAIL_DOMAIN,
        password: this.str(p.password)
      });
      if (signed.error) {
        return this.err(signed.error, "تعذّر إنشاء الحساب — قد يكون اسم المستخدم مستخدماً");
      }
      if (!signed.data || !signed.data.user) {
        return { status: "error", message: "لم يُنشأ الحساب. تأكّد من تعطيل تأكيد البريد في إعدادات Supabase." };
      }

      row.id = signed.data.user.id;
      var ins = await SB.from("app_users").insert(row);
      if (ins.error) {
        return this.err(ins.error, "أُنشئ الحساب لكن تعذّر حفظ بياناته الإدارية");
      }
      return { status: "success", mode: "insert" };
    },

    user_delete: async function (p) {
      var r = await SB.from("app_users").delete().eq("username", this.str(p.username).toLowerCase());
      if (r.error) return this.err(r.error, "تعذّر الحذف");
      return {
        status: "success",
        note: "حُذف السجل الإداري. لحذف حساب الدخول نهائياً: Authentication ← Users في لوحة Supabase."
      };
    },

    /* ─────────── الموظفون ─────────── */
    employees_list: async function (p) {
      var q = SB.from("employees").select("*", { count: "exact" }).order("name");
      if (p.project && this.str(p.project) !== "all") q = q.eq("project", this.str(p.project));
      var r = await this.cap(q, p);
      if (r.error) return this.err(r.error, "تعذّر تحميل الموظفين");
      var cap = this.meta(r, (r.data || []).length, p);

      // مستخدمو النظام المرتبطون بمشروع يظهرون في السجل نفسه (الترقية 19)
      var su = await SB.rpc("project_users");
      var all = su.error ? [] : (su.data || []);
      var byName = {};
      all.forEach(function (u) { byName[u.real_name] = u; });

      var names = {};
      (r.data || []).forEach(function (e) { names[e.name] = 1; });

      // من له سجلّ موظف يظهر موظفاً كاملاً؛ ومن لا سجلّ له يظهر بحسابه وحده
      var users = all
        .filter(function (u) { return !names[u.real_name]; })
        .map(function (u) {
          return {
            id: "U:" + u.username, name: u.real_name, job: u.job_title || "",
            project: u.project || "", center: u.center || "",
            hire_date: "", nationality: "", national_id: "", phone: "",
            supervisor: "", state: u.state || "نشط", notes: "",
            training_start: "", hours: "", new_hire: "",
            is_user: true, username: u.username, emp_id: u.emp_id || "",
            entry_by: "", entry_at: ""
          };
        });

      return {
        status: "success",
        total: cap.total, shown: cap.shown, truncated: cap.truncated,
        users: users,
        user_names: Object.keys(byName),
        employees: (r.data || []).map(function (e) {
          return {
            id: e.emp_id, name: e.name, job: e.job || "", project: e.project || "",
            center: e.center || "", hire_date: e.hire_date || "",
            nationality: e.nationality || "", national_id: e.national_id || "",
            phone: e.phone || "", supervisor: e.supervisor || "",
            state: e.state || "نشط", notes: e.notes || "",
            training_start: e.training_start || "", hours: e.work_hours || "",
            new_hire: e.new_hire_id ? "NEW-" + String(e.new_hire_id).padStart(4, "0") : "",
            // موظف له حساب في النظام: يُعرَّف بوسم خاص في السجل
            username: byName[e.name] ? byName[e.name].username : "",
            entry_by: e.created_by || "", entry_at: localStamp(e.created_at)
          };
        })
      };
    },

    /** الرقم الوظيفي التالي بحسب نمط آخر رقم مسجَّل */
    next_emp_id: async function () {
      var r = await SB.rpc("next_emp_id");
      if (r.error) return { status: "success", id: "" };
      return { status: "success", id: r.data || "" };
    },

    /** ربط حساب مستخدم بسجلّ موظف */
    link_user_employee: async function (p) {
      var r = await SB.rpc("link_user_employee", {
        p_username: this.str(p.username), p_emp_id: this.str(p.emp_id)
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر ربط المستخدم بسجلّ الموظف");
      return { status: "success" };
    },

    employee_save: async function (p) {
      var id = this.str(p.id);
      if (!id) return { status: "error", message: "الرقم الوظيفي مطلوب" };
      if (!this.str(p.name)) return { status: "error", message: "اسم الموظف مطلوب" };
      var hours = this.str(p.hours);
      if (hours && !/^\d+(\.\d+)?$/.test(hours)) return { status: "error", message: "ساعات العمل أرقام فقط" };
      if (hours && (+hours <= 0 || +hours > 24)) return { status: "error", message: "ساعات العمل رقم بين 1 و 24" };

      var row = {
        emp_id: id, name: this.str(p.name), job: this.str(p.job),
        project: this.str(p.project), center: this.str(p.center),
        hire_date: this.str(p.hire_date) || null,
        nationality: this.str(p.nationality), national_id: this.str(p.national_id),
        phone: this.str(p.phone), supervisor: this.str(p.supervisor),
        state: this.str(p.state) || "نشط", notes: this.str(p.notes),
        training_start: this.str(p.training_start) || null,
        work_hours: hours ? +hours : null
      };

      var found = await SB.from("employees").select("emp_id").eq("emp_id", id).maybeSingle();
      if (found.data) {
        var up = await SB.from("employees").update(row).eq("emp_id", id);
        return up.error ? this.err(up.error, "تعذّر التحديث") : { status: "success", mode: "update" };
      }
      var ins = await SB.from("employees").insert(row);
      return ins.error ? this.err(ins.error, "تعذّرت الإضافة") : { status: "success", mode: "insert" };
    },

    employee_delete: async function (p) {
      var r = await SB.from("employees").delete().eq("emp_id", this.str(p.id));
      return r.error ? this.err(r.error, "تعذّر الحذف") : { status: "success" };
    },

    /* ─────────── سجل مخالفات موظف + الجزاء المتدرّج ─────────── */
    employee_violations: async function (p) {
      var id = this.str(p.employee_id);
      var name = this.str(p.employee_name);
      var self = this;

      var q = SB.from("violations")
        .select("id, violation_date, code, vtype, repeat_level, penalty, state, final_decision")
        .order("violation_date", { ascending: false });
      q = id ? q.eq("emp_id", id) : q.eq("offender", name);

      var r = await q;
      if (r.error) return this.err(r.error, "تعذّر قراءة سجل المخالفات");

      var history = (r.data || []).map(function (v) {
        return {
          id: self.code("VIO", v.id), date: v.violation_date || "",
          code: v.code || "", type: v.vtype || "",
          repeat: v.repeat_level || 0, penalty: v.penalty || "",
          state: v.state || "", decision: v.final_decision || ""
        };
      });

      var suggestion = null;
      if (p.code) {
        var code = this.str(p.code);
        var same = history.filter(function (h) { return h.code === code; }).length;
        var cat = await SB.from("violation_catalog").select("*").eq("code", code).maybeSingle();
        var tiers = cat.data
          ? [cat.data.tier1, cat.data.tier2, cat.data.tier3, cat.data.tier4, cat.data.tier5, cat.data.tier6]
          : [];
        var level = Math.min(same + 1, 6);
        var text = tiers[level - 1] || "";
        if (!text) {
          for (var i = tiers.length - 1; i >= 0; i--) { if (tiers[i]) { text = tiers[i]; break; } }
        }
        suggestion = {
          code: code, type: cat.data ? cat.data.vtype : "",
          previous: same, level: level, penalty: text || "", tiers: tiers
        };
      }
      return { status: "success", total: history.length, history: history, suggestion: suggestion };
    },

    /* ─────────── المخالفات ─────────── */
    violation_new: async function (p) {
      var me = Mirage.session();

      // المسار والمُبلغ والحالة تحدّدها قاعدة البيانات عند الحفظ (violations_prepare)،
      // فلا يستطيع أحد توجيه بلاغه إلى محطة يختارها من المتصفح.
      var r = await SB.from("violations").insert({
        violation_date: this.str(p.violation_date) || new Date().toISOString().slice(0, 10),
        reporter: me.realName,
        reporter_manager: me.directManager,
        center: this.str(p.center), project: this.str(p.project),
        emp_id: this.str(p.employee_id), offender: this.str(p.offender),
        offender_job: this.str(p.offender_job),
        hire_date: this.str(p.hire_date) || null,
        code: this.str(p.code), vtype: this.str(p.type),
        repeat_level: this.num(p.repeat_level) || 1,
        penalty: this.str(p.penalty), details: this.str(p.details),
        employee_opinion: this.str(p.employee_opinion),
        sign_state: this.str(p.sign_state),
        sign_path: await this.uploadSignature(p.signature),
        signed_at: this.str(p.sign_state) ? new Date().toISOString() : null
      }).select("id, current_station, state").single();

      if (r.error) return this.err(r.error, "تعذّر تسجيل البلاغ");
      return { status: "success", id: this.code("VIO", r.data.id),
               station: r.data.current_station || "", state: r.data.state };
    },

    violations_list: async function (p) {
      var self = this;
      var q = SB.from("violations").select("*", { count: "exact" }).order("id", { ascending: false });
      if (p.month) {
        var mr = this.monthRange(this.str(p.month));
        q = q.gte("violation_date", mr[0]).lt("violation_date", mr[1]);
      }
      var r = await this.cap(q, p);
      if (r.error) return this.err(r.error, "تعذّر تحميل البلاغات");
      var cap = this.meta(r, (r.data || []).length, p);

      var top = await SB.rpc("is_top");
      return {
        status: "success",
        total: cap.total, shown: cap.shown, truncated: cap.truncated,
        my_role: Mirage.session().role,
        my_name: Mirage.session().realName,
        can_see_all: !!top.data,
        is_admin: Mirage.isAdmin(),
        violations: (r.data || []).map(function (v) {
          return {
            id: self.code("VIO", v.id),
            logged: localStamp(v.created_at),
            date: v.violation_date || "",
            reporter: v.reporter || "", center: v.center || "", project: v.project || "",
            employee_id: v.emp_id || "", offender: v.offender || "",
            offender_job: v.offender_job || "", hire_date: v.hire_date || "",
            code: v.code || "", type: v.vtype || "",
            repeat: v.repeat_level || 0, penalty: v.penalty || "",
            details: v.details || "", opinion: v.employee_opinion || "",
            sign_state: v.sign_state || "", sign_path: v.sign_path || "",
            sign_at: localStamp(v.signed_at),
            state: v.state || "", station: v.current_station || "",
            route: v.route || [], step: v.current_step || 0,
            log: JSON.stringify(v.approvals || []),
            decision: v.final_decision || "",
            closed: localStamp(v.closed_at),
            entry_by: v.created_by || "", entry_at: localStamp(v.created_at)
          };
        })
      };
    },

    /** رابط موقّت لصورة التوقيع */
    violation_signature: async function (p) {
      var path = this.str(p.path);
      if (!path) return { status: "success", url: "" };
      var r = await SB.storage.from(DOC_BUCKET).createSignedUrl(path, 3600);
      if (r.error) return this.err(r.error, "تعذّر جلب صورة التوقيع");
      return { status: "success", url: (r.data && r.data.signedUrl) || "" };
    },

    /**
     * رأي المحطة الحالية أو قرارها — تتحقّق قاعدة البيانات من أن البلاغ على محطتك،
     * وتحيله للمحطة التالية أو تغلقه، وتُشعر صاحب المحطة التالية.
     */
    violation_decide: async function (p) {
      var id = this.rawId(p.id);
      if (id < 0) return { status: "error", message: "رقم البلاغ غير صحيح" };

      var r = await SB.rpc("violation_decide", {
        p_id: id, p_opinion: this.str(p.opinion), p_decision: this.str(p.decision),
        p_close: this.str(p.close) === "1"
      });
      if (r.error) return this.err(r.error, "تعذّر حفظ القرار");
      return r.data && r.data.closed
        ? { status: "success", closed: true }
        : { status: "success", next: (r.data && r.data.next) || "" };
    },

    /* ─────────── المتابعات ─────────── */
    followup_new: async function (p) {
      var me = Mirage.session();
      var r = await SB.from("followups").insert({
        project: this.str(p.project_name),
        created_name: me.realName,
        creator_manager: me.directManager,
        description: this.str(p.description),
        entity: this.str(p.entity),
        assignee: this.str(p.assignee),
        classification: this.str(p.classification),
        state: this.str(p.status) || "عالقة",
        notes: this.str(p.notes),
        due_date: this.str(p.due_date) || null
      }).select("id").single();
      if (r.error) return this.err(r.error, "تعذّر تسجيل المهمة");
      return { status: "success", id: this.code("FUP", r.data.id) };
    },

    /* ─────────── الاقتراحات التحسينية ─────────── */

    suggestion_new: async function (p) {
      var title = this.str(p.title), body = this.str(p.body);
      if (!title) return { status: "error", message: "عنوان الاقتراح مطلوب" };
      if (!body)  return { status: "error", message: "شرح الاقتراح مطلوب" };
      var r = await SB.from("suggestions")
        .insert({ title: title, body: body, sender: Mirage.session().realName })
        .select("id").single();
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر إرسال الاقتراح");
      return { status: "success", id: this.code("SUG", r.data.id) };
    },

    suggestions_list: async function () {
      var self = this;
      var r = await SB.from("suggestions").select("*").order("id", { ascending: false });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تحميل الاقتراحات");
      return {
        status: "success",
        is_admin: Mirage.isAdmin(),
        suggestions: (r.data || []).map(function (x) {
          return {
            id: self.code("SUG", x.id), raw_id: x.id,
            title: x.title || "", body: x.body || "",
            sender: x.sender || "", sender_job: x.sender_job || "",
            center: x.center || "", project: x.project || "",
            state: x.state || "جديد", note: x.admin_note || "",
            sent: localStamp(x.created_at),
            mine: (x.sender || "") === Mirage.session().realName
          };
        })
      };
    },

    suggestion_answer: async function (p) {
      var r = await SB.rpc("suggestion_answer", {
        p_id: this.num(p.id), p_state: this.str(p.state), p_note: this.str(p.note)
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حفظ الردّ");
      return { status: "success" };
    },

    /* ─────────── المنجزات ─────────── */

    achievements: async function (p) {
      var r = await SB.rpc("achievements", { p_from: this.str(p.from), p_to: this.str(p.to) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تحميل المنجزات");
      return {
        status: "success",
        rows: (r.data || []).map(function (x) {
          return {
            person: x.person, job: x.job_title || "", center: x.center || "", project: x.project || "",
            violations: x.violations, readiness: x.readiness,
            tasks_created: x.tasks_created, tasks_done: x.tasks_done,
            files: x.files, new_hires: x.new_hires, resignations: x.resignations,
            suggestions: x.suggestions, total: x.total
          };
        })
      };
    },

    achievements_detail: async function (p) {
      var r = await SB.rpc("achievements_detail", {
        p_person: this.str(p.person), p_kind: this.str(p.kind),
        p_from: this.str(p.from), p_to: this.str(p.to)
      });
      if (r.error) return this.err(r.error, "تعذّر تحميل التفاصيل");
      return {
        status: "success",
        rows: (r.data || []).map(function (x) {
          return { ref: x.ref, at: localStamp(x.at), title: x.title || "", info: x.info || "" };
        })
      };
    },

    /** دليل المُدخِلين: معرّف الحساب ← الاسم — لمدير النظام وحده */
    entry_names: async function () {
      var r = await SB.rpc("entry_names");
      if (r.error) return { status: "success", names: {} };   // قاعدة لم تُرقَّ بعد
      var map = {};
      (r.data || []).forEach(function (x) { map[x.id] = x.real_name; });
      return { status: "success", names: map };
    },

    followups_list: async function (p) {
      var self = this;
      var q = SB.from("followups").select("*", { count: "exact" }).order("id", { ascending: false });
      if (p.project && this.str(p.project) !== "all") q = q.eq("project", this.str(p.project));
      if (p.state   && this.str(p.state)   !== "all") q = q.eq("state", this.str(p.state));

      var r = await this.cap(q, p);
      if (r.error) return this.err(r.error, "تعذّر تحميل المهام");
      var cap = this.meta(r, (r.data || []).length, p);

      var extra = await Promise.all([SB.rpc("is_top"), SB.rpc("my_projects"), SB.rpc("my_level")]);
      return {
        status: "success",
        total: cap.total, shown: cap.shown, truncated: cap.truncated,
        can_see_all: !!extra[0].data,
        my_projects: extra[1].data || [],
        my_level: extra[2].data,
        followups: (r.data || []).map(function (f) {
          return {
            id: self.code("FUP", f.id),
            date: localStamp(f.created_at),
            project: f.project || "", by: f.created_name || "",
            description: f.description || "", entity: f.entity || "",
            assignee: f.assignee || "", classification: f.classification || "",
            state: f.state || "", notes: f.notes || "", direction: f.direction || "",
            updated: localStamp(f.updated_at),
            entry_by: f.created_by || "", entry_at: localStamp(f.created_at)
          };
        })
      };
    },

    followup_update: async function (p) {
      var id = this.rawId(p.id);
      if (id < 0) return { status: "error", message: "رقم المهمة غير صحيح" };

      var patch = {};
      var map = { status: "state", classification: "classification", direction: "direction",
                  notes: "notes", assignee: "assignee", entity: "entity" };
      var self = this;
      Object.keys(map).forEach(function (k) {
        if (p[k] !== undefined && self.str(p[k]) !== "") patch[map[k]] = self.str(p[k]);
      });
      if (!Object.keys(patch).length) return { status: "success" };

      var r = await SB.from("followups").update(patch).eq("id", id);
      return r.error ? this.err(r.error, "تعذّر حفظ التحديث") : { status: "success" };
    },

    /* ─────────── الجهوزية ─────────── */
    readiness_new: async function (p) {
      var me = Mirage.session();
      var project = this.str(p.project);

      var pr = await SB.from("projects").select("*").eq("name", project).maybeSingle();
      if (pr.error) return this.err(pr.error, "تعذّر قراءة أعداد المشروع");
      var req = pr.data || { required_workers: 0, required_supervisors: 0, required_managers: 0 };

      var pw = this.num(p.present_workers), ps = this.num(p.present_supervisors), pm = this.num(p.present_managers);
      var sw = Math.max(0, req.required_workers - pw);
      var sv = Math.max(0, req.required_supervisors - ps);
      var sm = Math.max(0, req.required_managers - pm);

      var r = await SB.from("readiness").insert({
        report_date: this.str(p.date) || new Date().toISOString().slice(0, 10),
        project: project, supervisor: me.realName, supervisor_manager: me.directManager,
        required_workers: req.required_workers, present_workers: pw, short_workers: sw,
        required_supervisors: req.required_supervisors, present_supervisors: ps, short_supervisors: sv,
        required_managers: req.required_managers, present_managers: pm, short_managers: sm,
        total_required: req.required_workers + req.required_supervisors + req.required_managers,
        total_present: pw + ps + pm,
        total_short: sw + sv + sm,
        leave_count: this.num(p.leave), absent_count: this.num(p.absent), sick_count: this.num(p.sick),
        notes: this.str(p.notes)
      }).select("id, joined_count, left_count").single();

      if (r.error) {
        if (r.error.code === "23505") {
          return { status: "error", message: "يوجد تقرير مسجّل لهذا المشروع في هذا التاريخ" };
        }
        return this.err(r.error, "تعذّر إرسال التقرير");
      }
      return {
        status: "success", id: this.code("RDY", r.data.id),
        required: req.required_workers + req.required_supervisors + req.required_managers,
        shortage: sw + sv + sm,
        joined: r.data.joined_count || 0, left: r.data.left_count || 0
      };
    },

    /** من بدأ العمل ومن تركه في مشروع ويوم — يُعرض في تقرير الجهوزية قبل الإرسال */
    movement_counts: async function (p) {
      var project = this.str(p.project), date = this.str(p.date);
      var r = await Promise.all([
        SB.from("resignations").select("id", { count: "exact", head: true })
          .eq("project", project).eq("leave_date", date),
        SB.from("new_hires").select("id", { count: "exact", head: true })
          .eq("project", project).eq("work_start", date)
      ]);
      if (r[0].error) return this.err(r[0].error, "تعذّر قراءة حركة العمالة");
      if (r[1].error) return this.err(r[1].error, "تعذّر قراءة حركة العمالة");
      return { status: "success", left: r[0].count || 0, joined: r[1].count || 0 };
    },

    /* ─────────── ترك العمل ─────────── */
    resignation_new: async function (p) {
      var project = this.str(p.project), name = this.str(p.worker_name);
      if (!project) return { status: "error", message: "اسم المشروع مطلوب" };
      if (name.length < 3) return { status: "error", message: "اسم وشهرة العامل/ة مطلوب" };
      if (!this.str(p.leave_date)) return { status: "error", message: "تاريخ ترك العمل مطلوب" };
      if (!this.str(p.reason)) return { status: "error", message: "سبب ترك العمل مطلوب" };
      if (!this.str(p.emp_id)) return { status: "error", message: "اختر العامل/ة من قائمة موظفي المشروع" };
      var yn = ["notice_done", "uniform_returned", "card_returned"];
      for (var i = 0; i < yn.length; i++) {
        if (p[yn[i]] !== "1" && p[yn[i]] !== "0") return { status: "error", message: "أجب عن كل أسئلة نعم/لا" };
      }

      var r = await SB.from("resignations").insert({
        project: project, emp_id: this.str(p.emp_id), worker_name: name,
        leave_date: this.str(p.leave_date), reason: this.str(p.reason),
        notice_done: p.notice_done === "1", uniform_returned: p.uniform_returned === "1",
        card_returned: p.card_returned === "1", notes: this.str(p.notes)
      }).select("id, route, on_probation, worker_name").single();
      if (r.error) return this.err(r.error, "تعذّر حفظ نموذج ترك العمل");
      return { status: "success", id: this.code("LVE", r.data.id), route: r.data.route || [],
               probation: !!r.data.on_probation, name: r.data.worker_name };
    },

    /* ─────────── الموظف الجديد ─────────── */
    new_hire_new: async function (p) {
      var project = this.str(p.project), name = this.str(p.full_name);
      if (!project) return { status: "error", message: "اسم المشروع مطلوب" };
      if (name.length < 3) return { status: "error", message: "الاسم والشهرة مطلوبان" };
      if (!this.str(p.work_start)) return { status: "error", message: "تاريخ بدء العمل الفعلي مطلوب" };
      if (this.str(p.training_start) && this.str(p.training_start) > this.str(p.work_start)) {
        return { status: "error", message: "تاريخ بدء التدريب يجب ألا يكون بعد تاريخ بدء العمل" };
      }
      var hours = this.str(p.work_hours);
      if (!hours) return { status: "error", message: "ساعات العمل مطلوبة" };
      if (!/^\d+(\.\d+)?$/.test(hours)) return { status: "error", message: "ساعات العمل أرقام فقط" };
      if (+hours <= 0 || +hours > 24) return { status: "error", message: "ساعات العمل رقم بين 1 و 24" };
      if (this.PAYMENT.indexOf(this.str(p.payment_method)) < 0) {
        return { status: "error", message: "حدّد طريقة تسديد قيمة الفحوصات" };
      }

      var receiptPath = null;
      if (p.receipt_data && this.str(p.receipt_name)) {
        receiptPath = this.safeKey("receipts", p.receipt_name);
        var up = await SB.storage.from(DOC_BUCKET).upload(receiptPath,
          this.toBlob(p.receipt_data, this.str(p.receipt_mime)),
          { contentType: this.str(p.receipt_mime) || "application/octet-stream", upsert: false });
        if (up.error) return this.err(up.error, "تعذّر رفع صورة الإيصال");
      }

      var r = await SB.from("new_hires").insert({
        project: project, full_name: name,
        training_start: this.str(p.training_start) || null, work_start: this.str(p.work_start),
        job_title: this.str(p.job_title), contact: this.str(p.contact), work_hours: +hours,
        exam_date: this.str(p.exam_date) || null, exam_place: this.str(p.exam_place),
        exams: p.exams || [], payment_method: this.str(p.payment_method),
        receipt_path: receiptPath, receipt_name: receiptPath ? this.str(p.receipt_name) : null,
        notes: this.str(p.notes)
      }).select("id, route, emp_id").single();
      if (r.error) return this.err(r.error, "تعذّر حفظ نموذج الموظف الجديد");
      return { status: "success", id: this.code("NEW", r.data.id), route: r.data.route || [],
               emp_id: r.data.emp_id || "" };
    },

    /** حركة العمالة: من بدأ ومن ترك، بحسب الشهر والمشروع */
    movement_list: async function (p) {
      var self = this;
      var m = this.str(p.month), project = this.str(p.project);
      var qa = SB.from("resignations").select("*", { count: "exact" }).order("leave_date", { ascending: false });
      var qb = SB.from("new_hires").select("*", { count: "exact" }).order("work_start", { ascending: false });
      if (m) {
        var mr = this.monthRange(m);
        qa = qa.gte("leave_date", mr[0]).lt("leave_date", mr[1]);
        qb = qb.gte("work_start", mr[0]).lt("work_start", mr[1]);
      }
      if (project && project !== "all") { qa = qa.eq("project", project); qb = qb.eq("project", project); }
      var r = await Promise.all([qa, qb]);
      if (r[0].error) return this.needUpgrade(r[0].error) || this.err(r[0].error, "تعذّر تحميل حركة العمالة");
      if (r[1].error) return this.needUpgrade(r[1].error) || this.err(r[1].error, "تعذّر تحميل حركة العمالة");

      var yn = function (b) { return b ? "نعم" : "لا"; };
      return {
        status: "success",
        left: (r[0].data || []).map(function (x) {
          return {
            id: self.code("LVE", x.id), project: x.project, name: x.worker_name, date: x.leave_date,
            reason: x.reason, notice: yn(x.notice_done), uniform: yn(x.uniform_returned),
            card: yn(x.card_returned), by: x.created_name || "", notes: x.notes || "",
            emp_id: x.emp_id || "", hire_date: x.hire_date || "", probation: !!x.on_probation,
            entry_by: x.created_by || "", entry_at: localStamp(x.created_at)
          };
        }),
        joined: (r[1].data || []).map(function (x) {
          return {
            id: self.code("NEW", x.id), project: x.project, name: x.full_name,
            date: x.work_start, training: x.training_start || "", job: x.job_title || "",
            contact: x.contact || "", hours: x.work_hours || "",
            exam_date: x.exam_date || "", exam_place: x.exam_place || "",
            exams: x.exams || [], payment: x.payment_method || "",
            receipt_path: x.receipt_path || "", receipt_name: x.receipt_name || "",
            by: x.created_name || "", notes: x.notes || "", emp_id: x.emp_id || "",
            entry_by: x.created_by || "", entry_at: localStamp(x.created_at)
          };
        })
      };
    },

    /** رابط موقّت لملف في المستودع (إيصال، توقيع…) */
    file_url: async function (p) {
      var path = this.str(p.path);
      if (!path) return { status: "success", url: "" };
      // download: اسم الملف الأصلي → يُنزَّل بدل أن يُفتح في المتصفح
      var dl = this.str(p.download);
      var r = await SB.storage.from(DOC_BUCKET).createSignedUrl(path, 3600, dl ? { download: dl } : undefined);
      if (r.error) return this.err(r.error, "تعذّر جلب الملف");
      return { status: "success", url: (r.data && r.data.signedUrl) || "" };
    },

    readiness_list: async function (p) {
      var self = this;
      var q = SB.from("readiness").select("*", { count: "exact" }).order("report_date", { ascending: false });
      if (p.month) q = q.eq("month", this.str(p.month));
      if (p.project && this.str(p.project) !== "all") q = q.eq("project", this.str(p.project));

      var r = await this.cap(q, p);
      if (r.error) return this.err(r.error, "تعذّر تحميل التقارير");
      var cap = this.meta(r, (r.data || []).length, p);

      var list = (r.data || []).map(function (x) {
        return {
          id: self.code("RDY", x.id), date: x.report_date, month: x.month,
          project: x.project, supervisor: x.supervisor || "",
          req_w: x.required_workers, pre_w: x.present_workers, sh_w: x.short_workers,
          req_s: x.required_supervisors, pre_s: x.present_supervisors, sh_s: x.short_supervisors,
          req_m: x.required_managers, pre_m: x.present_managers, sh_m: x.short_managers,
          required: x.total_required, total: x.total_present, shortage: x.total_short,
          leave: x.leave_count, absent: x.absent_count, sick: x.sick_count,
          joined: x.joined_count || 0, left: x.left_count || 0,
          notes: x.notes || "",
          entry_by: x.created_by || "", entry_at: localStamp(x.created_at)
        };
      });

      var byDate = {};
      list.forEach(function (x) {
        byDate[x.date] = byDate[x.date] || { total: 0, shortage: 0, required: 0 };
        byDate[x.date].total    += x.total;
        byDate[x.date].shortage += x.shortage;
        byDate[x.date].required += x.required;
      });

      var extra = await Promise.all([SB.rpc("my_projects"), SB.rpc("my_level")]);
      return {
        status: "success",
        total: cap.total, shown: cap.shown, truncated: cap.truncated, reports: list, by_date: byDate,
        my_projects: extra[0].data || [], my_level: extra[1].data
      };
    },

    /* ─────────── الملفات ─────────── */
    file_new: async function (p) {
      var me = Mirage.session();
      var name = this.str(p.file_name);
      var path = "";
      var self = this;
      var readers = (Array.isArray(p.readers) ? p.readers : [])
        .map(function (x) { return self.str(x); })
        .filter(function (x, i, a) { return x && x !== me.realName && a.indexOf(x) === i; });
      if (!readers.length) {
        return { status: "error", message: "حدّد مستخدماً واحداً على الأقل يستطيع فتح الملف وتنزيله" };
      }

      if (p.file_data && name) {
        var blob = this.toBlob(p.file_data, this.str(p.mime_type) || "application/octet-stream");

        // المسار بحروف لاتينية فقط — كان يُبنى من اسم المشروع العربي فيرفضه المستودع
        // برسالة «Invalid key». الاسم الأصلي يبقى محفوظاً في file_name ويظهر للمستخدم.
        path = this.safeKey("docs", name);

        var up = await SB.storage.from(DOC_BUCKET).upload(path, blob, {
          contentType: blob.type, upsert: false
        });
        if (up.error) return this.err(up.error, "تعذّر رفع الملف إلى المستودع");
      }

      var r = await SB.from("documents").insert({
        project: this.str(p.project), subject: this.str(p.subject),
        sender: me.realName, sender_manager: me.directManager,
        recipient: this.str(p.recipient),
        sent_date: this.str(p.date) || new Date().toISOString().slice(0, 10),
        method: this.str(p.method), file_name: name, file_path: path,
        notes: this.str(p.notes),
        readers: readers
      }).select("id, readers, manager, stage").single();

      if (r.error) {
        // لا يبقى ملف يتيم في المستودع إن رُفض تسجيل المراسلة
        if (path) { try { await SB.storage.from(DOC_BUCKET).remove([path]); } catch (e) {} }
        return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تسجيل المراسلة");
      }
      return {
        status: "success", id: this.code("DOC", r.data.id),
        readers: r.data.readers || readers,
        manager: r.data.manager || "",
        stage: r.data.stage || "مُمرَّر"
      };
    },

    files_list: async function (p) {
      var self = this;
      var me = Mirage.session().realName;
      var q = SB.from("documents").select("*").order("id", { ascending: false }).limit(this.num(p && p.limit) || 200);
      if (p && p.month) {
        var mr = this.monthRange(this.str(p.month));
        q = q.gte("sent_date", mr[0]).lt("sent_date", mr[1]);
      }
      var r = await q;
      if (r.error) return this.err(r.error, "تعذّر تحميل الملفات");
      return {
        status: "success",
        files: (r.data || []).map(function (x) {
          var readers = x.readers || [];
          return {
            id: self.code("DOC", x.id), project: x.project || "", subject: x.subject || "",
            sender: x.sender || "", recipient: x.recipient || "", readers: readers,
            date: x.sent_date || "", method: x.method || "", notes: x.notes || "",
            file_name: x.file_name || "", path: x.file_path || "",
            logged: localStamp(x.created_at),
            mine: x.sender === me,
            to_me: readers.indexOf(me) > -1 && (x.stage || "مُمرَّر") === "مُمرَّر",
            restricted: readers.length > 0,
            manager: x.manager || "", note: x.manager_note || "",
            stage: x.stage || "مُمرَّر",
            waiting: (x.stage || "مُمرَّر") === "بانتظار المسؤول المباشر",
            held: (x.stage || "") === "لم يُمرَّر",
            to_forward: (x.manager || "") === me && (x.stage || "مُمرَّر") === "بانتظار المسؤول المباشر",
            forwarded: localStamp(x.forwarded_at),
            entry_by: x.created_by || "", entry_at: localStamp(x.created_at)
          };
        })
      };
    },

    /** اسم المسؤول المباشر للمستخدم الحالي */
    my_manager: async function () {
      var r = await SB.rpc("my_manager");
      if (r.error) return { status: "success", manager: "" };
      return { status: "success", manager: r.data || "" };
    },

    /** تعليق المسؤول المباشر على الملف وتمريره إلى الجهات المحددة */
    document_forward: async function (p) {
      var r = await SB.rpc("document_forward", {
        p_id: this.num(p.id), p_note: this.str(p.note), p_send: p.send !== false
      });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تمرير الملف");
      return { status: "success" };
    },

    /** إعادة الملف إلى مُرسِله دون تمرير، مع سبب */
    document_hold: async function (p) {
      var r = await SB.rpc("document_hold", { p_id: this.num(p.id), p_note: this.str(p.note) });
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر حفظ القرار");
      return { status: "success" };
    },

    /** دليل المستخدمين النشطين لاختيار مستلم الملف (الاسم والوظيفة والقسم فقط) */
    user_directory: async function () {
      var r = await SB.rpc("user_directory");
      if (r.error) return this.needUpgrade(r.error) || this.err(r.error, "تعذّر تحميل قائمة المستخدمين");
      return { status: "success", users: (r.data || []).map(function (u) {
        return { name: u.real_name, job: u.job_title || "", center: u.center || "", project: u.project || "" };
      }) };
    },

    /* ─────────── مسارات العمل ─────────── */
    flows_get: async function (p) {
      var r = await SB.from("workflows").select("station, step_order")
        .eq("form", this.str(p.form) || "المخالفات").order("step_order");
      if (r.error) return this.err(r.error, "تعذّر قراءة المسار");
      return {
        status: "success",
        stations: (r.data || []).map(function (x) {
          return { station: x.station, order: x.step_order };
        })
      };
    },

    flow_save: async function (p) {
      var form = this.str(p.form);
      if (!form) return { status: "error", message: "اسم النموذج مطلوب" };

      var del = await SB.from("workflows").delete().eq("form", form);
      if (del.error) return this.err(del.error, "تعذّر حذف المسار القديم");

      // قائمة مباشرة (الأسماء قد تحوي فواصل)، أو نص مفصول بفواصل للتوافق مع النسخ السابقة
      var list = (Array.isArray(p.stations) ? p.stations : this.str(p.stations).split(","))
        .map(function (x) { return String(x).trim(); })
        .filter(function (x) { return x; });
      if (!list.length) return { status: "success", count: 0 };

      var ins = await SB.from("workflows").insert(list.map(function (st, i) {
        return { form: form, step_order: i + 1, station: st };
      }));
      return ins.error ? this.err(ins.error, "تعذّر حفظ المسار")
                       : { status: "success", count: list.length };
    }
  }
};
