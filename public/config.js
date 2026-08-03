// ⚙️  إعدادات الاتصال بقاعدة البيانات (Supabase)
// عدّل القيمتين التاليتين من: Supabase Dashboard → Project Settings → API
// ملاحظة: مفتاح anon مفتاح عام بطبيعته، والحماية الحقيقية تأتي من Row Level Security
// المفعّل في ملف supabase/schema.sql — لا يستطيع أي شخص قراءة أو كتابة أي بيانات
// بدون تسجيل دخول بحساب أنشأته أنت.
window.__APP_CONFIG__ = {
  SUPABASE_URL: 'https://cyazncquqjpcmsavpbrp.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_vC__ym-yS_MdvlJxDHPC2g_ckMIELrg',
  // النطاق المستخدم لتحويل اسم المستخدم إلى بريد إلكتروني عند تسجيل الدخول.
  // مثال: يكتب المستخدم "admin" فيتم تسجيل الدخول بـ admin@work.com
  LOGIN_DOMAIN: 'work.com',
}
