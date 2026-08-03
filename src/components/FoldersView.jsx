import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'
import { Modal, Loading, useToast, errText } from './ui'
import { navigate } from './Dashboard'
import { formatDate } from '../lib/points'

export default function FoldersView() {
  const toast = useToast()
  const [folders, setFolders] = useState(null)
  const [counts, setCounts] = useState({})
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      const rows = await api.listFolders()
      setFolders(rows)
      const map = {}
      await Promise.all(
        rows.map(async (f) => {
          const sections = await api.listSections(f.id)
          map[f.id] = sections.length
        })
      )
      setCounts(map)
    } catch (err) {
      toast(errText(err), 'error')
      setFolders([])
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  if (folders === null) return <Loading />

  return (
    <>
      <div className="crumbs">
        <button onClick={() => navigate('/')}>الرئيسية</button>
        <span className="sep">/</span>
        <span>ملفات أخرى</span>
      </div>

      <div className="page-head">
        <div>
          <h2>ملفات أخرى</h2>
          <div className="meta">مشاريع مستقلة غير مرتبطة بأي شركة — أقسام بأسماء تختارها أنت.</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setAdding(true)}>+ مشروع جديد</button>
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="empty">
          <h3>لا توجد مشاريع هنا بعد</h3>
          <p>استخدم هذا القسم لأي ملفات لا تتبع شركة معيّنة.</p>
          <button className="btn brass" onClick={() => setAdding(true)}>إضافة مشروع</button>
        </div>
      ) : (
        <div className="grid projects">
          {folders.map((f, i) => (
            <div
              key={f.id}
              className="card project-card"
              style={{ animationDelay: `${i * 45}ms` }}
              onClick={() => navigate(`/f/${f.id}`)}
            >
              <h3>{f.name}</h3>
              {f.notes && <div className="tiny muted">{f.notes}</div>}
              <div className="row">
                <span className="tag">{counts[f.id] || 0} قسم</span>
                <span className="tiny muted">{formatDate(f.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <FolderModal
          onClose={() => setAdding(false)}
          onSaved={async (row) => { await load(); navigate(`/f/${row.id}`) }}
        />
      )}
    </>
  )
}

export function FolderModal({ folder, onClose, onSaved }) {
  const toast = useToast()
  const [name, setName] = useState(folder?.name || '')
  const [notes, setNotes] = useState(folder?.notes || '')
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const row = folder
        ? await api.updateFolder(folder.id, { name, notes: notes || null })
        : await api.createFolder(name, notes || null)
      toast(folder ? 'تم حفظ التعديلات' : 'تمت إضافة المشروع')
      await onSaved?.(row)
      onClose()
    } catch (err) {
      toast(errText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={folder ? 'تعديل المشروع' : 'مشروع جديد'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="fname">اسم المشروع</label>
          <input id="fname" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="fnotes">ملاحظات (اختياري)</label>
          <textarea id="fnotes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" disabled={busy || !name.trim()}>{busy && <span className="spinner" />} حفظ</button>
          <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  )
}
