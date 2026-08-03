// ⚙️  إعدادات الاتصال بقاعدة البيانات (Supabase)
// عدّل القيمتين التاليتين من: Supabase Dashboard → Project Settings → API
// ملاحظة: مفتاح anon مفتاح عام بطبيعته، والحماية الحقيقية تأتي من Row Level Security
// المفعّل في ملف supabase/schema.sql — لا يستطيع أي شخص قراءة أو كتابة أي بيانات
// بدون تسجيل دخول بحساب أنشأته أنت.
window.__APP_CONFIG__ = {
  SUPABASE_URL: 'https://YOUR-PROJECT-ref.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-PUBLIC-KEY',
  // النطاق المستخدم لتحويل اسم المستخدم إلى بريد إلكتروني عند تسجيل الدخول.
  // مثال: يكتب المستخدم "tarek" فيتم تسجيل الدخول بـ tarek@molafat.local
  LOGIN_DOMAIN: 'molafat.local',
}
