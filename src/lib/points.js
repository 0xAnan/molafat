// النقاط الثابتة داخل كل مرحلة.
// kind: 'doc'   → نقطة مستندات (رفع ملفات)
//       'money' → نقطة مالية (مبلغ + ملفات اختيارية)
export const POINTS = [
  { key: 'authority_letter', order: 1, label: 'خطاب الجهة', kind: 'doc' },
  { key: 'building_permits', order: 2, label: 'رخص المباني', kind: 'doc' },
  { key: 'ministerial_decree', order: 3, label: 'قرار وزاري', kind: 'doc' },
  { key: 'consultant_report', order: 4, label: 'تقرير الاستشاري', kind: 'doc' },
  { key: 'estimate', order: 5, label: 'المقايسة', kind: 'doc' },
  { key: 'claim', order: 6, label: 'المطالبة', kind: 'doc' },
  { key: 'approved_report', order: 7, label: 'التقرير المعتمد', kind: 'doc' },
  { key: 'works_value', order: 8, label: 'قيمة الأعمال', kind: 'money' },
  { key: 'incidentals', order: 9, label: 'النثريات', kind: 'money' },
  { key: 'net', order: 10, label: 'الصافي', kind: 'money', computed: true },
]

export const POINT_BY_KEY = Object.fromEntries(POINTS.map((p) => [p.key, p]))

export const STATUS_LABEL = {
  pending: 'لم يبدأ',
  progress: 'قيد العمل',
  done: 'مكتمل',
}

const arabicNumber = new Intl.NumberFormat('ar-EG', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return arabicNumber.format(n) + ' ج.م'
}

export function formatDate(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(iso))
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  const units = ['بايت', 'ك.ب', 'م.ب', 'ج.ب']
  let n = Number(bytes)
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

// أيقونة نصية حسب نوع الملف
export function fileKind(name = '', mime = '') {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext))
    return { tag: 'صورة', cls: 'img' }
  if (ext === 'pdf' || mime === 'application/pdf') return { tag: 'PDF', cls: 'pdf' }
  if (['doc', 'docx', 'rtf'].includes(ext)) return { tag: 'Word', cls: 'doc' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { tag: 'Excel', cls: 'xls' }
  if (['zip', 'rar', '7z'].includes(ext)) return { tag: 'أرشيف', cls: 'zip' }
  return { tag: ext ? ext.toUpperCase() : 'ملف', cls: 'other' }
}
