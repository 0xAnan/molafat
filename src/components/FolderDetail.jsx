import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'
import { Modal, ConfirmDialog, Loading, useToast, errText } from './ui'
import { navigate } from './Dashboard'
import { FolderModal } from './FoldersView'
import FileArea from './FileArea'

export default function FolderDetail({ folderId, userId }) {
  const toast = useToast()
  const [folder, setFolder] = useState(null)
  const [sections, setSections] = useState(null)
  const [files, setFiles] = useState({})
  const [newSection, setNewSection] = useState(false)
  const [editSection, setEditSection] = useState(null)
  const [editFolder, setEditFolder] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const [f, rows] = await Promise.all([api.getFolder(folderId), api.listSections(folderId)])
      const atts = await api.listFolderAttachments(rows.map((r) => r.id))
      const bySection = {}
      for (const a of atts) (bySection[a.section_id] = bySection[a.section_id] || []).push(a)
      setFiles(bySection)
      setSections(rows)
      setFolder(f)
    } catch (err) {
      toast(errText(err), 'error')
    }
  }, [folderId, toast])

  useEffect(() => { load() }, [load])

  if (!folder || sections === null) return <Loading />

  return (
    <>
      <div className="crumbs">
        <button onClick={() => navigate('/')}>الرئيسية</button>
        <span className="sep">/</span>
        <button onClick={() => navigate('/f')}>ملفات أخرى</button>
        <span className="sep">/</span>
        <span>{folder.name}</span>
      </div>

      <div className="page-head">
        <div>
          <h2>{folder.name}</h2>
          <div className="meta">
            {sections.length} قسم{folder.notes ? ` · ${folder.notes}` : ''}
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setNewSection(true)}>+ قسم جديد</button>
          <button className="btn ghost" onClick={() => setEditFolder(true)}>تعديل المشروع</button>
          <button
            className="btn danger"
            onClick={() =>
              setConfirm({
                title: 'حذف المشروع',
                message: `سيُحذف «${folder.name}» مع كل أقسامه وملفاته نهائياً.`,
                run: async () => {
                  await api.deleteFolder(folder.id)
                  toast('تم حذف المشروع')
                  navigate('/f')
                },
              })
            }
          >
            حذف
          </button>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="empty">
          <h3>لا توجد أقسام بعد</h3>
          <p>أضف قسماً وسمِّه بما تشاء، ثم ارفع فيه ما تريد من ملفات.</p>
          <button className="btn brass" onClick={() => setNewSection(true)}>إضافة أول قسم</button>
        </div>
      ) : (
        <div className="points-grid">
          {sections.map((sec, i) => (
            <section key={sec.id} className="point" style={{ animationDelay: `${i * 35}ms` }}>
              <div className="head">
                <span className="idx">{i + 1}</span>
                <h4>{sec.name}</h4>
                {(files[sec.id]?.length || 0) > 0 && (
                  <span className="tag">{files[sec.id].length} ملف</span>
                )}
                <button
                  className="icon-btn"
                  title="تعديل الاسم"
                  aria-label="تعديل اسم القسم"
                  onClick={() => setEditSection(sec)}
                >
                  ✎
                </button>
                <button
                  className="icon-btn danger"
                  title="حذف القسم"
                  aria-label="حذف القسم"
                  onClick={() =>
                    setConfirm({
                      title: 'حذف القسم',
                      message: `سيُحذف «${sec.name}» مع كل ملفاته.`,
                      run: async () => {
                        await api.deleteSection(sec.id)
                        toast('تم حذف القسم')
                        await load()
                      },
                    })
                  }
                >
                  ✕
                </button>
              </div>

              <div className="body">
                <FileArea
                  attachments={files[sec.id] || []}
                  upload={(file) =>
                    api.uploadSectionAttachment({ folderId, sectionId: sec.id, file, userId })
                  }
                  onChanged={load}
                  onAskDelete={setConfirm}
                />
              </div>
            </section>
          ))}
        </div>
      )}

      {(newSection || editSection) && (
        <SectionModal
          folderId={folderId}
          section={editSection}
          nextPosition={sections.length}
          onClose={() => { setNewSection(false); setEditSection(null) }}
          onSaved={load}
        />
      )}

      {editFolder && (
        <FolderModal folder={folder} onClose={() => setEditFolder(false)} onSaved={load} />
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

function SectionModal({ folderId, section, nextPosition, onClose, onSaved }) {
  const toast = useToast()
  const [name, setName] = useState(section?.name || '')
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (section) await api.updateSection(section.id, { name })
      else await api.createSection(folderId, name, nextPosition)
      toast(section ? 'تم حفظ الاسم' : 'تمت إضافة القسم')
      await onSaved?.()
      onClose()
    } catch (err) {
      toast(errText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={section ? 'تعديل القسم' : 'قسم جديد'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="secname">اسم القسم</label>
          <input
            id="secname"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: عقود، مراسلات، صور الموقع…"
            required
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" disabled={busy || !name.trim()}>{busy && <span className="spinner" />} حفظ</button>
          <button type="button" className="btn ghost" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  )
}
