import { supabase } from './supabase'

const BUCKET = 'attachments'

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

/* ---------------------------------- شركات --------------------------------- */
export const listCompanies = () =>
  supabase.from('companies').select('*').order('created_at', { ascending: true }).then(unwrap)

export const createCompany = (name, notes = null) =>
  supabase.from('companies').insert({ name, notes }).select().single().then(unwrap)

export const updateCompany = (id, patch) =>
  supabase.from('companies').update(patch).eq('id', id).select().single().then(unwrap)

export const deleteCompany = (id) =>
  supabase.from('companies').delete().eq('id', id).then(unwrap)

/* --------------------------------- مشاريع --------------------------------- */
export const listProjects = (companyId) =>
  supabase
    .from('projects')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .then(unwrap)

export const createProject = (companyId, patch) =>
  supabase.from('projects').insert({ company_id: companyId, ...patch }).select().single().then(unwrap)

export const updateProject = (id, patch) =>
  supabase.from('projects').update(patch).eq('id', id).select().single().then(unwrap)

export const deleteProject = (id) => supabase.from('projects').delete().eq('id', id).then(unwrap)

export const getProject = (id) =>
  supabase.from('projects').select('*, companies(name)').eq('id', id).single().then(unwrap)

/* --------------------------------- مراحل ---------------------------------- */
export const listPhases = (projectId) =>
  supabase
    .from('phases')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .then(unwrap)

export const createPhase = (projectId, name, position) =>
  supabase.from('phases').insert({ project_id: projectId, name, position }).select().single().then(unwrap)

export const updatePhase = (id, patch) =>
  supabase.from('phases').update(patch).eq('id', id).select().single().then(unwrap)

export const deletePhase = (id) => supabase.from('phases').delete().eq('id', id).then(unwrap)

/* ------------------------------ نقاط المرحلة ------------------------------ */
export const listEntries = (phaseId) =>
  supabase.from('point_entries').select('*').eq('phase_id', phaseId).then(unwrap)

export const saveEntry = (phaseId, pointKey, patch) =>
  supabase
    .from('point_entries')
    .upsert(
      { phase_id: phaseId, point_key: pointKey, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'phase_id,point_key' }
    )
    .select()
    .single()
    .then(unwrap)

/* ------------------------ ملفات أخرى: مشاريع مستقلة ----------------------- */
export const listFolders = () =>
  supabase.from('folders').select('*').order('created_at', { ascending: true }).then(unwrap)

export const getFolder = (id) => supabase.from('folders').select('*').eq('id', id).single().then(unwrap)

export const createFolder = (name, notes = null) =>
  supabase.from('folders').insert({ name, notes }).select().single().then(unwrap)

export const updateFolder = (id, patch) =>
  supabase.from('folders').update(patch).eq('id', id).select().single().then(unwrap)

export const deleteFolder = (id) => supabase.from('folders').delete().eq('id', id).then(unwrap)

export const listSections = (folderId) =>
  supabase
    .from('folder_sections')
    .select('*')
    .eq('folder_id', folderId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .then(unwrap)

export const createSection = (folderId, name, position) =>
  supabase.from('folder_sections').insert({ folder_id: folderId, name, position }).select().single().then(unwrap)

export const updateSection = (id, patch) =>
  supabase.from('folder_sections').update(patch).eq('id', id).select().single().then(unwrap)

export const deleteSection = (id) => supabase.from('folder_sections').delete().eq('id', id).then(unwrap)

export const listFolderAttachments = (sectionIds) =>
  sectionIds.length
    ? supabase
        .from('attachments')
        .select('*')
        .in('section_id', sectionIds)
        .order('created_at', { ascending: true })
        .then(unwrap)
    : Promise.resolve([])

export async function uploadSectionAttachment({ folderId, sectionId, file, userId }) {
  const path = safePath(`misc/${folderId}`, sectionId, 'files', file.name)
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (upErr) throw upErr

  try {
    return await supabase
      .from('attachments')
      .insert({
        section_id: sectionId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId || null,
      })
      .select()
      .single()
      .then(unwrap)
  } catch (err) {
    await supabase.storage.from(BUCKET).remove([path])
    throw err
  }
}

/* --------------------------------- مرفقات --------------------------------- */
export const listAttachments = (phaseId) =>
  supabase
    .from('attachments')
    .select('*')
    .eq('phase_id', phaseId)
    .order('created_at', { ascending: true })
    .then(unwrap)

// أسماء الملفات العربية غير مسموح بها في مسار التخزين، لذلك يُخزَّن الاسم
// الأصلي في قاعدة البيانات ويُستخدم مسار آمن عشوائي في التخزين.
function safePath(projectId, phaseId, pointKey, fileName) {
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop().toLowerCase() : ''
  const rand = crypto.randomUUID()
  return `${projectId}/${phaseId}/${pointKey}/${rand}${ext.replace(/[^a-z0-9.]/g, '')}`
}

export async function uploadAttachment({ projectId, phaseId, pointKey, file, userId }) {
  const path = safePath(projectId, phaseId, pointKey, file.name)
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (upErr) throw upErr

  try {
    return await supabase
      .from('attachments')
      .insert({
        phase_id: phaseId,
        point_key: pointKey,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId || null,
      })
      .select()
      .single()
      .then(unwrap)
  } catch (err) {
    // لا نترك ملفاً يتيماً في التخزين إذا فشل تسجيله
    await supabase.storage.from(BUCKET).remove([path])
    throw err
  }
}

export async function deleteAttachment(att) {
  await supabase.storage.from(BUCKET).remove([att.storage_path])
  return supabase.from('attachments').delete().eq('id', att.id).then(unwrap)
}

// رابط موقّت (ساعة واحدة) — المجلد خاص ولا يمكن فتحه بدون هذا الرابط
export async function signedUrl(path, { download = false } = {}) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600, download ? { download } : undefined)
  if (error) throw error
  return data.signedUrl
}
