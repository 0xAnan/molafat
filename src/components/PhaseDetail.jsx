import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as api from '../lib/api'
import { ConfirmDialog, Loading, useToast, errText } from './ui'
import { navigate } from './Dashboard'
import { POINTS, STATUS_LABEL, formatMoney, formatSize, formatDate, fileKind } from '../lib/points'

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
      setPhase(ph)

      const [entryRows, attRows] = await Promise.all([api.listEntries(phaseId), api.listAttachments(phaseId)])
      setEntries(Object.fromEntries(entryRows.map((e) => [e.point_key, e])))
      const byPoint = {}
      for (const a of attRows) (byPoint[a.point_key] = byPoint[a.point_key] || []).push(a)
      setFiles(byPoint)
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
    (p) => (files[p.key]?.length || 0) > 0 || entries[p.key]?.status === 'done' || entries[p.key]?.amount != null
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
  const toast = useToast()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [amount, setAmount] = useState(entry?.amount ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [showNotes, setShowNotes] = useState(!!entry?.notes)

  useEffect(() => { setAmount(entry?.amount ?? '') }, [entry?.amount])
  useEffect(() => { if (entry?.notes) setNotes(entry.notes) }, [entry?.notes])

  const status = entry?.status || 'pending'
  const effectiveStatus = attachments.length > 0 && status === 'pending' ? 'progress' : status

  async function handleFiles(list) {
    const arr = Array.from(list || [])
    if (!arr.length) return
    const MAX = 50 * 1024 * 1024 // حد Supabase الافتراضي لكل ملف
    const tooBig = arr.filter((f) => f.size > MAX)
    for (const f of tooBig) toast(`«${f.name}» أكبر من 50 ميجابايت — قسّمه أو اضغطه أولاً`, 'error')
    const queue = arr.filter((f) => f.size <= MAX)
    if (!queue.length) return
    setUploading(queue.length)
    let ok = 0
    for (const file of queue) {
      try {
        await api.uploadAttachment({ projectId, phaseId, pointKey: point.key, file, userId })
        ok++
      } catch (err) {
        toast(`تعذّر رفع «${file.name}»: ${errText(err)}`, 'error')
      }
    }
    setUploading(0)
    if (ok) toast(ok === 1 ? 'تم رفع الملف' : `تم رفع ${ok} ملفات`)
    await onFilesChanged()
  }

  async function open(att, download) {
    try {
      const url = await api.signedUrl(att.storage_path, { download: download ? att.file_name : false })
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      toast(errText(err), 'error')
    }
  }

  const isNet = point.key === 'net'

  return (
    <section
      className={`point ${point.kind === 'money' ? 'money' : ''} ${isNet ? 'net' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ animationDelay: `${index * 35}ms` }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
    >
      <div className="head">
        <span className="idx">{point.order}</span>
        <h4>{point.label}</h4>
        {!isNet && (
          <button
            className={`tag ${effectiveStatus}`}
            title="تغيير الحالة"
            onClick={() => {
              const next = { pending: 'progress', progress: 'done', done: 'pending' }[status]
              onPatch(point.key, { status: next })
            }}
          >
            {STATUS_LABEL[effectiveStatus]}
          </button>
        )}
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

        {attachments.length > 0 && (
          <div className="file-list">
            {attachments.map((att) => {
              const k = fileKind(att.file_name, att.mime_type || '')
              return (
                <div key={att.id} className="file-row">
                  <span className={`ext ${k.cls}`}>{k.tag}</span>
                  <span className="fname" title={att.file_name}>{att.file_name}</span>
                  <span className="fsize">{formatSize(att.size_bytes)}</span>
                  <button className="icon-btn" title="فتح" aria-label="فتح الملف" onClick={() => open(att, false)}>⤢</button>
                  <button className="icon-btn" title="تنزيل" aria-label="تنزيل الملف" onClick={() => open(att, true)}>⇩</button>
                  <button
                    className="icon-btn danger"
                    title="حذف"
                    aria-label="حذف الملف"
                    onClick={() =>
                      onAskDelete({
                        title: 'حذف الملف',
                        message: `سيُحذف «${att.file_name}» نهائياً.`,
                        run: async () => {
                          await api.deleteAttachment(att)
                          toast('تم حذف الملف')
                          await onFilesChanged()
                        },
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {uploading > 0 && (
          <div className="upload-progress" aria-label="جارٍ الرفع"><i /></div>
        )}

        <div
          className="drop"
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
          <b>اسحب الملفات هنا</b> أو اضغط للاختيار — Word، PDF، صور… (عدة ملفات معاً)
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
        />

        {showNotes ? (
          <textarea
            className="input"
            placeholder="ملاحظات على هذه النقطة…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (entry?.notes || '') && onPatch(point.key, { notes: notes || null })}
          />
        ) : (
          <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowNotes(true)}>
            + إضافة ملاحظة
          </button>
        )}
      </div>
    </section>
  )
}
