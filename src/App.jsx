import { useEffect, useState } from 'react'
import { supabase, configured } from './lib/supabase'
import { ToastProvider, Loading } from './components/ui'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

function NotConfigured() {
  return (
    <div style={{ maxWidth: 620, margin: '80px auto', padding: '0 22px' }}>
      <h1 className="serif" style={{ fontSize: 40, marginBottom: 6 }}>ملفات</h1>
      <div className="alert info">
        <b>الإعداد غير مكتمل.</b> افتح الملف <code>public/config.js</code> وضع فيه رابط مشروع
        Supabase ومفتاح anon، ثم ارفع التعديل إلى GitHub. الخطوات كاملة في ملف
        <code> README.md</code>.
      </div>
    </div>
  )
}

function NotApproved({ email }) {
  return (
    <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 22px' }}>
      <h1 className="serif" style={{ fontSize: 40, marginBottom: 6 }}>ملفات</h1>
      <div className="alert info">
        <b>الحساب غير معتمد.</b> تم تسجيل الدخول باسم <code dir="ltr">{email}</code>،
        لكن لم يُمنح هذا الحساب صلاحية الوصول إلى البيانات بعد. تواصل مع مسؤول النظام
        لاعتماد الحساب.
      </div>
      <button className="btn ghost" onClick={() => supabase.auth.signOut()}>تسجيل الخروج</button>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [approved, setApproved] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // التحقق من اعتماد الحساب (الحماية الحقيقية في قاعدة البيانات، وهذه رسالة توضيحية)
  useEffect(() => {
    if (!session) { setApproved(null); return }
    let cancelled = false
    supabase
      .from('profiles')
      .select('approved')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setApproved(data?.approved === true) })
    return () => { cancelled = true }
  }, [session])

  if (!configured) return <NotConfigured />
  if (!ready) return <Loading />
  if (!session) return <ToastProvider><Login /></ToastProvider>
  if (approved === null) return <Loading />
  if (!approved) return <NotApproved email={session.user.email} />

  return (
    <ToastProvider>
      <Dashboard session={session} />
    </ToastProvider>
  )
}
