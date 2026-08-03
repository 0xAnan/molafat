import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as api from '../lib/api'
import { Modal, ConfirmDialog, Loading, useToast, errText } from './ui'
import { navigate, CompanyModal } from './Dashboard'
import { formatDate } from '../lib/points'

export default function ProjectsView({ companyId, onCompanyChanged }) {
  const toast = useToast()
  const [company, setCompany] = useState(null)
  const [projects, setProjects] = useState(null)
  const [phaseCounts, setPhaseCounts] = useState({})
  const [editing, setEditing] = useState(null) // project object or 'new'
  const [editCompany, setEditCompany] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const [{ data: c }, rows] = await Promise.all([
        supabase.from('companies').select('*').eq('id', companyId).single(),
        api.listProjects(companyId),
      ])
      setCompany(c)
      setProjects(rows)
      if (rows.length) {
        const { data } = await supabase
          .from('phases')
          .select('project_id')
          .in('project_id', rows.map((r) => r.id))
        const map = {}
        for (const r of data || []) map[r.project_id] = (map[r.project_id] || 0) + 1
        setPhaseCounts(map)
      }
    } catch (err) {
      toast(errText(err), 'error')
    }
  }, [companyId, toast])

  useEffect(() => { load() }, [load])

  if (projects === null || !company) return <Loading />

  return (
    <>
      <div className="crumbs">
        <button onClick={() => navigate('/')}>الرئيسية</button>
        <span className="sep">/</span>
        <span>{company.name}</span>
      </div>

      <div className="page-head">
        <div>
          <h2>{company.name}</h2>
          <div className="meta">
            {projects.length} مشروع · أُضيفت في {formatDate(company.created_at)}
            {company.notes ? ` · ${company.notes}` : ''}
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setEditing('new')}>+ مشروع جديد</button>
          <button className="btn ghost" onClick={() => setEditCompany(true)}>تعديل الشركة</button>
          <button
            className="btn danger"
            onClick={() =>
              setConfirm({
                title: 'حذف الشركة',
                message: `سيُحذف نهائياً «${company.name}» مع كل مشاريعها ومراحلها وملفاتها. لا يمكن التراجع.`,
                run: async () => {
                  await api.deleteCompany(company.id)
                  toast('تم حذف الشركة')
                  await onCompanyChanged?.()
                  navigate('/')
                },
              })
            }
          >
            حذف
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="empty">
          <h3>لا توجد مشاريع في هذه الشركة</h3>
          <p>أضف أول مشروع لتبدأ بتسجيل المراحل والمستندات.</p>
          <button className="btn brass" onClick={() => setEditing('new')}>إضافة مشروع</button>
        </div>
      ) : (
        <div className="grid projects">
          {projects.map((p, i) => (
              <div
                key={p.id}
                className="card project-card"
                style={{ animationDelay: `${i * 45}ms` }}
                onClick={() => navigate(`/p/${p.id}`)}
              >
                <h3>{p.name}</h3>
                {(p.code || p.location) && (
                  <div className="tiny muted">
                    {[p.code, p.location].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="row">
                  <span className="tag">{phaseCounts[p.id] || 0} مرحلة</span>
                  <span className="tiny muted">فتح ←</span>
                </div>
              </div>
          ))}
        </div>
      )}

      {editing && (
        <ProjectModal
          companyId={companyId}
          project={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await load(); await onCompanyChanged?.() }}
        />
      )}

      {editCompany && (
        <CompanyModal
          company={company}
          onClose={() => setEditCompany(false)}
          onSaved={async () => { await load(); await onCompanyChanged?.() }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.run}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  )
}

export function ProjectModal({ companyId, project, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    name: project?.name || '',
    code: project?.code || '',
    location: project?.location || '',
    notes: project?.notes || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const patch = {
        name: form.name,
        code: form.code || null,
        location: form.location || null,
        notes: form.notes || null,
      }
      if (project) await api.updateProject(project.id, patch)
      else await api.createProject(companyId, patch)
      toast(project ? 'تم حفظ التعديلات' : 'تمت إضافة المشروع')
      await onSaved?.()
      onClose()
    } catch (err) {
      toast(errText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={project ? 'تعديل المشروع' : 'مشروع جديد'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="pname">اسم المشروع</label>
          <input id="pname" className="input" value={form.name} onChange={set('name')} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="pcode">رقم / كود المشروع (اختياري)</label>
          <input id="pcode" className="input" value={form.code} onChange={set('code')} />
        </div>
        <div className="field">
          <label htmlFor="ploc">الموقع (اختياري)</label>
          <input id="ploc" className="input" value={form.location} onChange={set('location')} />
        </div>
        <div className="field">
          <label htmlFor="pnotes">ملاحظات (اختياري)</label>
          <textarea id="pnotes" className="input" value={form.notes} onChange={set('notes')} />
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" disabled={busy || !form.name.trim()}>{busy && <span className="spinner" />} حفظ</button>
          <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  )
}
