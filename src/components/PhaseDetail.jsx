import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as api from '../lib/api'
import { ConfirmDialog, Loading, useToast, errText } from './ui'
import { navigate } from './Dashboard'
import { POINTS, formatMoney, formatDate } from '../lib/points'
import FileArea from './FileArea'

export default function PhaseDetail({ phaseId, userId }) {
  const toast = useToast()
  const [phase, setPhase] = useState(null)
  const [entries, setEntries] = useState({})
  const [files, setFiles] = useState({})
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const { data: ph, error } = await supabase
        .from('phases')
        .select('*, projects(id, name, company_id, companies(name))')
        .eq('id', phaseId)
        .single()
      if (error) throw error

      const [entryRows, attRows] = await Promise.all([api.listEntries(phaseId), api.listAttachments(phaseId)])
      const byPoint = {}
      for (const a of attRows) (byPoint[a.point_key] = byPoint[a.point_key] || []).push(a)
      // تُضبط الحالات معاً حتى لا تُركّب البطاقات قبل وصول الملاحظات والمبالغ
      setEntries(Object.fromEntries(entryRows.map((e) => [e.point_key, e])))
      setFiles(byPoint)
      setPhase(ph)
    } catch (err) {
      toast(errText(err), 'error')
    }
  }, [phaseId, toast])

  useEffect(() => { load() }, [load])

  const patchEntry = useCallback(
    async (pointKey, patch) => {
      setEntries((prev) => ({ ...prev, [pointKey]: { ...(prev[pointKey] || {}), point_key: pointKey, ...patch } }))
      try {
        const row = await api.saveEntry(phaseId, pointKey, { ...patch, updated_by: userId })
        setEntries((prev) => ({ ...prev, [pointKey]: row }))
      } catch (err) {
        toast(errText(err), 'error')
        load()
      }
    },
    [phaseId, userId, toast, load]
  )

  // الصافي = قيمة الأعمال − النثريات (يُحفظ تلقائياً لتظهر الإجماليات في المشروع)
  const works = Number(entries.works_value?.amount) || 0
  const incidentals = Number(entries.incidentals?.amount) || 0
  const computedNet = works - incidentals
  useEffect(() => {
    if (!phase) return
    const stored = entries.net?.amount
    const hasSource = entries.works_value?.amount != null || entries.incidentals?.amount != null
    if (!hasSource) return
    if (Number(stored) === computedNet) return
    patchEntry('net', { amount: computedNet })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedNet, phase])

  if (!phase) return <Loading />
  const project = phase.projects

  const doneCount = POINTS.filter(
    (p) => (files[p.key]?.length || 0) > 0 || entries[p.key]?.amount != null
  ).length

  return (
    <>
      <div className="crumbs">
        <button onClick={() => navigate('/')}>الرئيسية</button>
        <span className="sep">/</span>
        <button onClick={() => navigate(`/c/${project.company_id}`)}>{project.companies?.name}</button>
        <span className="sep">/</span>
        <button onClick={() => navigate(`/p/${project.id}`)}>{project.name}</button>
        <span className="sep">/</span>
        <span>{phase.name}</span>
      </div>

      <div className="page-head">
        <div>
          <h2>{phase.name}</h2>
          <div className="meta">{doneCount} من {POINTS.length} نقاط مكتملة · أُنشئت في {formatDate(phase.created_at)}</div>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => navigate(`/p/${project.id}`)}>← رجوع للمراحل</button>
          <button className="btn ghost" onClick={() => window.print()}>طباعة</button>
        </div>
      </div>

      <div className="points-grid">
        {POINTS.map((point, i) => (
          <PointCard
            key={point.key}
            index={i}
            point={point}
            entry={entries[point.key]}
            attachments={files[point.key] || []}
            computedNet={computedNet}
            phaseId={phaseId}
            projectId={project.id}
            userId={userId}
            onPatch={patchEntry}
            onFilesChanged={load}
            onAskDelete={setConfirm}
          />
        ))}
      </div>

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

/* ------------------------------ بطاقة النقطة ------------------------------ */
function PointCard({
  index, point, entry, attachments, computedNet,
  phaseId, projectId, userId, onPatch, onFilesChanged, onAskDelete,
}) {
  const [amount, setAmount] = useState(entry?.amount ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(false)

  useEffect(() => { setAmount(entry?.amount ?? '') }, [entry?.amount])
  useEffect(() => { setNotes(entry?.notes ?? '') }, [entry?.notes])

  // الملاحظة تظهر دائماً إذا كانت محفوظة، أو عند فتحها يدوياً
  const showNotes = notesOpen || !!entry?.notes

  const isNet = point.key === 'net'

  return (
    <section
      className={`point ${point.kind === 'money' ? 'money' : ''} ${isNet ? 'net' : ''}`}
      style={{ animationDelay: `${index * 35}ms` }}
    >
      <div className="head">
        <span className="idx">{point.order}</span>
        <h4>{point.label}</h4>
        {attachments.length > 0 && <span className="tag">{attachments.length} ملف</span>}
      </div>

      <div className="body">
        {point.kind === 'money' && !isNet && (
          <div className="amount-input">
            <input
              className="input"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => {
                const v = amount === '' ? null : Number(amount)
                const old = entry?.amount == null ? null : Number(entry.amount)
                if (v !== old && !(v !== null && Number.isNaN(v))) onPatch(point.key, { amount: v })
              }}
              aria-label={point.label}
            />
            <span className="cur">ج.م</span>
          </div>
        )}

        {isNet && (
          <div>
            <div className="net-value">{formatMoney(computedNet)}</div>
            <div className="net-note">يُحسب تلقائياً: قيمة الأعمال − النثريات</div>
          </div>
        )}

        <FileArea
          attachments={attachments}
          upload={(file) => api.uploadAttachment({ projectId, phaseId, pointKey: point.key, file, userId })}
          onChanged={onFilesChanged}
          onAskDelete={onAskDelete}
        />

        {showNotes ? (
          <div className="notes-box">
            <label className="tiny muted" htmlFor={`n-${point.key}`}>ملاحظات</label>
            <textarea
              id={`n-${point.key}`}
              className="input"
              placeholder="اكتب ملاحظتك هنا…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (entry?.notes || '') && onPatch(point.key, { notes: notes || null })}
            />
          </div>
        ) : (
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setNotesOpen(true)}>
            + إضافة ملاحظة
          </button>
        )}
      </div>
    </section>
  )
}
