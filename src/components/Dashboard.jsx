import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as api from '../lib/api'
import { Modal, ConfirmDialog, Loading, useToast, errText } from './ui'
import ProjectsView from './ProjectsView'
import PhasesView from './PhasesView'
import PhaseDetail from './PhaseDetail'

/* --------------------------- توجيه بسيط عبر الهاش -------------------------- */
function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [kind, id] = raw.split('/')
  if (kind === 'c' && id) return { view: 'company', id }
  if (kind === 'p' && id) return { view: 'project', id }
  if (kind === 'ph' && id) return { view: 'phase', id }
  return { view: 'home' }
}

export function navigate(path) {
  window.location.hash = path
}

export default function Dashboard({ session }) {
  const toast = useToast()
  const [route, setRoute] = useState(parseHash)
  const [companies, setCompanies] = useState(null)
  const [counts, setCounts] = useState({})
  const [showNewCompany, setShowNewCompany] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); setMenuOpen(false) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // منع تمرير الصفحة خلف القائمة الجانبية على الجوال
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const loadCompanies = useCallback(async () => {
    try {
      const rows = await api.listCompanies()
      setCompanies(rows)
      const { data } = await supabase.from('projects').select('company_id')
      const map = {}
      for (const r of data || []) map[r.company_id] = (map[r.company_id] || 0) + 1
      setCounts(map)
    } catch (err) {
      toast(errText(err), 'error')
      setCompanies([])
    }
  }, [toast])

  useEffect(() => { loadCompanies() }, [loadCompanies])

  const userName = useMemo(() => {
    const email = session.user.email || ''
    return email.split('@')[0]
  }, [session])

  const activeCompanyId =
    route.view === 'company' ? route.id : null

  return (
    <div className={`shell ${menuOpen ? 'menu-open' : ''}`}>
      <div className="topbar">
        <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة">☰</button>
        <span className="topbar-title">ملفات</span>
        <button className="menu-btn" onClick={() => navigate('/')} aria-label="الرئيسية">⌂</button>
      </div>

      <div className="scrim" onClick={() => setMenuOpen(false)} />

      <aside className="sidebar">
        <div className="brand">
          <div>
            <h1>ملفات</h1>
            <span>إدارة أعمال الجهات</span>
          </div>
          <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة">✕</button>
        </div>

        <div className="section-title">
          <span>الشركات</span>
          <button onClick={() => setShowNewCompany(true)} title="إضافة شركة" aria-label="إضافة شركة">+</button>
        </div>

        <nav className="company-list">
          {companies === null && <div style={{ padding: 14 }}><span className="spinner" /></div>}
          {companies?.length === 0 && (
            <p className="tiny" style={{ padding: '6px 12px', color: 'rgba(216,189,133,0.7)' }}>
              لا توجد شركات بعد. اضغط + لإضافة أول شركة.
            </p>
          )}
          {companies?.map((c) => (
            <button
              key={c.id}
              className={`company-item ${activeCompanyId === c.id ? 'active' : ''}`}
              onClick={() => navigate(`/c/${c.id}`)}
            >
              <span className="dot" />
              <span className="name">{c.name}</span>
              <span className="count">{counts[c.id] || 0}</span>
            </button>
          ))}
        </nav>

        <div className="user-box">
          <div className="avatar">{userName.slice(0, 1).toUpperCase()}</div>
          <div className="who">
            <b>{userName}</b>
            <span>مستخدم مصرّح</span>
          </div>
          <button
            className="icon-btn"
            style={{ color: 'rgba(216,189,133,0.8)' }}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            onClick={() => supabase.auth.signOut()}
          >
            ⏻
          </button>
        </div>
      </aside>

      <main className="main">
        {route.view === 'home' && (
          <HomeView companies={companies} counts={counts} onAdd={() => setShowNewCompany(true)} />
        )}
        {route.view === 'company' && (
          <ProjectsView
            key={route.id}
            companyId={route.id}
            onCompanyChanged={loadCompanies}
          />
        )}
        {route.view === 'project' && <PhasesView key={route.id} projectId={route.id} />}
        {route.view === 'phase' && (
          <PhaseDetail key={route.id} phaseId={route.id} userId={session.user.id} />
        )}
      </main>

      {showNewCompany && (
        <CompanyModal
          onClose={() => setShowNewCompany(false)}
          onSaved={async (row) => {
            await loadCompanies()
            navigate(`/c/${row.id}`)
          }}
        />
      )}
    </div>
  )
}

/* --------------------------------- الرئيسية -------------------------------- */
function HomeView({ companies, counts, onAdd }) {
  if (companies === null) return <Loading />
  return (
    <>
      <div className="page-head">
        <div>
          <h2>لوحة المتابعة</h2>
          <div className="meta">اختر شركة للبدء، أو أضف شركة جديدة.</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={onAdd}>+ شركة جديدة</button>
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="empty">
          <h3>لا توجد شركات بعد</h3>
          <p>ابدأ بإضافة شركة مثل «إعمار»، ثم أضف مشاريعها ومراحلها.</p>
          <button className="btn brass" onClick={onAdd}>إضافة أول شركة</button>
        </div>
      ) : (
        <div className="grid projects">
          {companies.map((c, i) => (
            <div
              key={c.id}
              className="card project-card"
              style={{ animationDelay: `${i * 45}ms` }}
              onClick={() => navigate(`/c/${c.id}`)}
            >
              <h3>{c.name}</h3>
              {c.notes && <div className="tiny muted">{c.notes}</div>}
              <div className="row">
                <span className="tag">{counts[c.id] || 0} مشروع</span>
                <span className="tiny muted">فتح ←</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ----------------------------- نافذة شركة جديدة ---------------------------- */
export function CompanyModal({ company, onClose, onSaved }) {
  const toast = useToast()
  const [name, setName] = useState(company?.name || '')
  const [notes, setNotes] = useState(company?.notes || '')
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const row = company
        ? await api.updateCompany(company.id, { name, notes: notes || null })
        : await api.createCompany(name, notes || null)
      toast(company ? 'تم حفظ التعديلات' : 'تمت إضافة الشركة')
      await onSaved?.(row)
      onClose()
    } catch (err) {
      toast(errText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={company ? 'تعديل الشركة' : 'شركة جديدة'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="cname">اسم الشركة</label>
          <input id="cname" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="cnotes">ملاحظات (اختياري)</label>
          <textarea id="cnotes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" disabled={busy || !name.trim()}>{busy && <span className="spinner" />} حفظ</button>
          <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  )
}

export { ConfirmDialog }
