import { useState } from 'react'
import { supabase, toEmail, LOGIN_DOMAIN } from '../lib/supabase'
import { errText } from './ui'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(identifier),
      password,
    })
    if (error) setError(errText(error))
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <aside className="login-side">
        <div className="seal" />
        <div style={{ position: 'relative' }}>
          <span style={{ letterSpacing: '0.24em', fontSize: 12, color: 'var(--brass-soft)' }}>نظام داخلي</span>
          <h1>ملفات</h1>
          <div className="rule" />
          <p>
            منصّة إدارة أعمال الجهات الحكومية — الشركات، المشاريع، المراحل،
            والمستندات المعتمدة في مكان واحد.
          </p>
        </div>
        <div className="foot">الدخول مقصور على المستخدمين المصرّح لهم فقط.</div>
      </aside>

      <main className="login-main">
        <form className="login-card" onSubmit={submit}>
          <h2>تسجيل الدخول</h2>
          <p className="sub">أدخل بيانات الحساب الذي تم إنشاؤه لك.</p>

          {error && <div className="alert">{error}</div>}

          <div className="field">
            <label htmlFor="user">اسم المستخدم</label>
            <input
              id="user"
              className="input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              dir="ltr"
              style={{ textAlign: 'start' }}
              required
              autoFocus
            />
            <span className="tiny muted">
              اكتب اسم المستخدم فقط (سيُستكمل تلقائياً بـ @{LOGIN_DOMAIN}) أو بريداً كاملاً.
            </span>
          </div>

          <div className="field">
            <label htmlFor="pass">كلمة المرور</label>
            <input
              id="pass"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
              style={{ textAlign: 'start' }}
              required
            />
          </div>

          <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
            {busy ? <span className="spinner" /> : null}
            دخول
          </button>
        </form>
      </main>
    </div>
  )
}
