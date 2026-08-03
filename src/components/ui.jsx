import { useEffect, useState, createContext, useContext, useCallback } from 'react'

/* ------------------------------ نافذة منبثقة ------------------------------ */
export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">✕</button>
        </header>
        <div className="content">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  )
}

/* -------------------------- نافذة تأكيد الحذف ---------------------------- */
export function ConfirmDialog({ title, message, confirmLabel = 'حذف', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn"
            style={{ background: '#8c2f2f', borderColor: '#8c2f2f' }}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? <span className="spinner" /> : null} {confirmLabel}
          </button>
          <button className="btn ghost" onClick={onClose} disabled={busy}>إلغاء</button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  )
}

/* -------------------------------- التنبيهات ------------------------------- */
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const push = useCallback((text, type = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setItems((prev) => [...prev, { id, text, type }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : ''}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* --------------------------------- تحميل --------------------------------- */
export const Loading = () => (
  <div className="center-load"><span className="spinner" /></div>
)

// رسالة خطأ مقروءة بالعربية
export function errText(err) {
  const m = err?.message || String(err)
  if (/Invalid login credentials/i.test(m)) return 'اسم المستخدم أو كلمة المرور غير صحيحة'
  if (/Email not confirmed/i.test(m)) return 'الحساب غير مُفعّل — فعّله من لوحة Supabase'
  if (/Failed to fetch|NetworkError/i.test(m)) return 'تعذّر الاتصال بالخادم — تحقق من الإنترنت أو من إعدادات config.js'
  if (/row-level security|permission denied/i.test(m)) return 'لا تملك صلاحية لهذا الإجراء'
  if (/duplicate key|already exists/i.test(m)) return 'هذا العنصر موجود مسبقاً'
  if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return 'حجم الملف أكبر من الحد المسموح'
  return m
}
