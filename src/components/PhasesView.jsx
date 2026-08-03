import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as api from '../lib/api'
import { Modal, ConfirmDialog, Loading, useToast, errText } from './ui'
import { navigate } from './Dashboard'
import { ProjectModal } from './ProjectsView'
import { POINTS } from '../lib/points'

export default function PhasesView({ projectId }) {
  const toast = useToast()
  const [project, setProject] = useState(null)
  const [phases, setPhases] = useState(null)
  const [progress, setProgress] = useState({})
  const [newPhase, setNewPhase] = useState(false)
  const [editPhase, setEditPhase] = useState(null)
  const [editProject, setEditProject] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const [proj, rows] = await Promise.all([api.getProject(projectId), api.listPhases(projectId)])
      setProject(proj)
      setPhases(rows)

      if (!rows.length) {
        setProgress({})
        return
      }
      const ids = rows.map((r) => r.id)
      const [{ data: entries }, { data: atts }] = await Promise.all([
        supabase.from('point_entries').select('phase_id, point_key, amount').in('phase_id', ids),
        supabase.from('attachments').select('phase_id, point_key').in('phase_id', ids),
      ])

      const filled = {}
      const add = (phaseId, key) => {
        filled[phaseId] = filled[phaseId] || new Set()
        filled[phaseId].add(key)
      }
      for (const a of atts || []) add(a.phase_id, a.point_key)
      for (const e of entries || []) {
        if (e.amount !== null) add(e.phase_id, e.point_key)
      }
      const prog = {}
      for (const id of ids) prog[id] = ((filled[id]?.size || 0) / POINTS.length) * 100
      setProgress(prog)
    } catch (err) {
      toast(errText(err), 'error')
    }
  }, [projectId, toast])

  useEffect(() => { load() }, [load])

  if (!project || phases === null) return <Loading />

  return (
    <>
      <div className="crumbs">
        <button onClick={() => navigate('/')}>الرئيسية</button>
        <span className="sep">/</span>
        <button onClick={() => navigate(`/c/${project.company_id}`)}>{project.companies?.name}</button>
        <span className="sep">/</span>
        <span>{project.name}</span>
      </div>

      <div className="page-head">
        <div>
          <h2>{project.name}</h2>
          <div className="meta">
            {[project.code, project.location].filter(Boolean).join(' · ') || 'بدون بيانات إضافية'}
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setNewPhase(true)}>+ مرحلة جديدة</button>
          <button className="btn ghost" onClick={() => setEditProject(true)}>تعديل المشروع</button>
          <button
            className="btn danger"
            onClick={() =>
              setConfirm({
                title: 'حذف المشروع',
                message: `سيُحذف «${project.name}» مع كل مراحله وملفاته نهائياً.`,
                run: async () => {
                  await api.deleteProject(project.id)
                  toast('تم حذف المشروع')
                  navigate(`/c/${project.company_id}`)
                },
              })
            }
          >
            حذف
          </button>
        </div>
      </div>

      {phases.length === 0 ? (
        <div className="empty">
          <h3>لا توجد مراحل بعد</h3>
          <p>كل مرحلة تحتوي على النقاط التسع (خطاب الجهة، الرخص، القرار الوزاري، … الصافي).</p>
          <button className="btn brass" onClick={() => setNewPhase(true)}>إضافة أول مرحلة</button>
        </div>
      ) : (
        <div className="phase-strip">
          {phases.map((ph, i) => {
            const pct = Math.round(progress[ph.id] || 0)
            return (
              <div
                key={ph.id}
                className="phase-row"
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => navigate(`/ph/${ph.id}`)}
              >
                <div className="num">{i + 1}</div>
                <div className="body">
                  <h4>{ph.name}</h4>
                  <div className="sub">{Math.round((pct / 100) * POINTS.length)} من {POINTS.length} نقاط مكتملة</div>
                </div>
                <div className="progress-bar" title={`${pct}%`}><i style={{ width: `${pct}%` }} /></div>
                <button
                  className="icon-btn"
                  title="تعديل الاسم"
                  aria-label="تعديل اسم المرحلة"
                  onClick={(e) => { e.stopPropagation(); setEditPhase(ph) }}
                >
                  ✎
                </button>
                <button
                  className="icon-btn danger"
                  title="حذف المرحلة"
                  aria-label="حذف المرحلة"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirm({
                      title: 'حذف المرحلة',
                      message: `سيُحذف «${ph.name}» مع كل ملفاتها وبياناتها.`,
                      run: async () => {
                        await api.deletePhase(ph.id)
                        toast('تم حذف المرحلة')
                        await load()
                      },
                    })
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {(newPhase || editPhase) && (
        <PhaseModal
          projectId={projectId}
          phase={editPhase}
          nextPosition={phases.length}
          onClose={() => { setNewPhase(false); setEditPhase(null) }}
          onSaved={load}
        />
      )}

      {editProject && (
        <ProjectModal
          companyId={project.company_id}
          project={project}
          onClose={() => setEditProject(false)}
          onSaved={load}
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

function PhaseModal({ projectId, phase, nextPosition, onClose, onSaved }) {
  const toast = useToast()
  const [name, setName] = useState(phase?.name || `المرحلة ${nextPosition + 1}`)
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (phase) await api.updatePhase(phase.id, { name })
      else await api.createPhase(projectId, name, nextPosition)
      toast(phase ? 'تم حفظ الاسم' : 'تمت إضافة المرحلة')
      await onSaved?.()
      onClose()
    } catch (err) {
      toast(errText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={phase ? 'تعديل المرحلة' : 'مرحلة جديدة'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="phname">اسم المرحلة</label>
          <input id="phname" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <span className="tiny muted">مثال: «المرحلة الأولى» أو «مباني الإدارة — الدور الأرضي».</span>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" disabled={busy || !name.trim()}>{busy && <span className="spinner" />} حفظ</button>
          <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  )
}
