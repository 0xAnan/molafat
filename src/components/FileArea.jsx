import { useRef, useState } from 'react'
import * as api from '../lib/api'
import { useToast, errText } from './ui'
import { formatSize, fileKind } from '../lib/points'

const MAX = 50 * 1024 * 1024 // حد Supabase لكل ملف

/**
 * منطقة الملفات المشتركة: قائمة المرفقات + السحب والإفلات + الرفع والحذف.
 * upload(file) دالة ترفع ملفاً واحداً وتُرجع وعداً.
 */
export default function FileArea({ attachments, upload, onChanged, onAskDelete, hint }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(0)

  async function handleFiles(list) {
    const arr = Array.from(list || [])
    if (!arr.length) return
    for (const f of arr.filter((f) => f.size > MAX))
      toast(`«${f.name}» أكبر من 50 ميجابايت — قسّمه أو اضغطه أولاً`, 'error')
    const queue = arr.filter((f) => f.size <= MAX)
    if (!queue.length) return

    setUploading(queue.length)
    let ok = 0
    for (const file of queue) {
      try {
        await upload(file)
        ok++
      } catch (err) {
        toast(`تعذّر رفع «${file.name}»: ${errText(err)}`, 'error')
      }
    }
    setUploading(0)
    if (ok) toast(ok === 1 ? 'تم رفع الملف' : `تم رفع ${ok} ملفات`)
    await onChanged()
  }

  async function open(att, download) {
    try {
      const url = await api.signedUrl(att.storage_path, { download: download ? att.file_name : false })
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      toast(errText(err), 'error')
    }
  }

  return (
    <div
      className={`file-area ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
    >
      {attachments.length > 0 && (
        <div className="file-list">
          {attachments.map((att) => {
            const k = fileKind(att.file_name, att.mime_type || '')
            return (
              <div key={att.id} className="file-row">
                <div className="file-main">
                  <span className={`ext ${k.cls}`}>{k.tag}</span>
                  <span className="fname" title={att.file_name}>{att.file_name}</span>
                  <span className="fsize">{formatSize(att.size_bytes)}</span>
                </div>
                <div className="file-actions">
                  <button className="fa" onClick={() => open(att, false)}>
                    <span aria-hidden="true">⤢</span> فتح
                  </button>
                  <button className="fa" onClick={() => open(att, true)}>
                    <span aria-hidden="true">⇩</span> تنزيل
                  </button>
                  <button
                    className="fa del"
                    onClick={() =>
                      onAskDelete({
                        title: 'حذف الملف',
                        message: `سيُحذف «${att.file_name}» نهائياً.`,
                        run: async () => {
                          await api.deleteAttachment(att)
                          toast('تم حذف الملف')
                          await onChanged()
                        },
                      })
                    }
                  >
                    <span aria-hidden="true">✕</span> حذف
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {uploading > 0 && <div className="upload-progress" aria-label="جارٍ الرفع"><i /></div>}

      <div
        className="drop"
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <b>اسحب الملفات هنا</b> أو اضغط للاختيار
        {hint !== false && <> — Word، PDF، صور… (عدة ملفات معاً)</>}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
