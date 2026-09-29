/* ══════════════════════════════════════════════════════════
   ميراج ERP — ملف الإعدادات
   ------------------------------------------------------------
   هذا هو الملف الوحيد الذي تعدّله أنت.
   لا يُستبدل عند أي تحديث للنظام، فإعداداتك محفوظة فيه دائماً.

   من أين تأخذ القيم؟
   لوحة Supabase ← الصفحة الرئيسية للمشروع ← زر Copy بجانب الاسم
   (أو Project Settings ← API Keys)

     • Project URL      → MIRAGE_URL
     • Publishable key  → MIRAGE_KEY   (يبدأ بـ sb_publishable_)

   ⚠️ لا تستخدم Secret key ولا service_role. كلاهما يتجاوز
      كل سياسات الحماية، ووضعه هنا يكشف بياناتك لأي زائر.
   ══════════════════════════════════════════════════════════ */

const MIRAGE_URL = "https://vsxbbhlqxoczjbszugpr.supabase.co";

const MIRAGE_KEY = "sb_publishable_hdEcwaAKm7VbQj4ESsYn_g_X19g6uap";


/* ─────────── إعدادات لا تحتاج تغييراً عادةً ─────────── */

/** النطاق الوهمي للبريد — الموظفون يدخلون بأسمائهم لا ببريدهم */
const MIRAGE_EMAIL_DOMAIN = "mirage.local";

/** اسم مستودع الملفات في Supabase Storage */
const MIRAGE_BUCKET = "documents";
