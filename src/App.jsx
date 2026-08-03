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

export default function App() {
  const [session, setSession] = useState(null)
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

  if (!configured) return <NotConfigured />
  if (!ready) return <Loading />

  return (
    <ToastProvider>
      {session ? <Dashboard session={session} /> : <Login />}
    </ToastProvider>
  )
}
