-- ============================================================================
--  ملفات — مخطط قاعدة البيانات (Supabase / PostgreSQL)
--  شغّل هذا الملف كاملاً مرة واحدة من: Supabase Dashboard → SQL Editor → New query
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) الجداول
-- ----------------------------------------------------------------------------

-- ملف المستخدم (يُنشأ تلقائياً عند إنشاء الحساب)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text,
  full_name   text,
  role        text not null default 'member' check (role in ('member', 'admin')),
  created_at  timestamptz not null default now()
);

-- الشركات (إعمار، ...)
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  notes       text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- المشاريع التابعة لكل شركة
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  code        text,
  location    text,
  status      text not null default 'active' check (status in ('active', 'done', 'onhold')),
  notes       text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- المراحل داخل كل مشروع
create table if not exists public.phases (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- بيانات النقاط التسع داخل كل مرحلة (مبلغ + ملاحظات + حالة)
-- النقاط ثابتة في الواجهة، ويُنشأ السطر عند أول تعديل فقط.
create table if not exists public.point_entries (
  id          uuid primary key default gen_random_uuid(),
  phase_id    uuid not null references public.phases (id) on delete cascade,
  point_key   text not null,
  amount      numeric(14, 2),
  notes       text,
  status      text not null default 'pending' check (status in ('pending', 'progress', 'done')),
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (phase_id, point_key)
);

-- المرفقات: عدة ملفات لكل نقطة (word + pdf + صورة ...)
create table if not exists public.attachments (
  id            uuid primary key default gen_random_uuid(),
  phase_id      uuid not null references public.phases (id) on delete cascade,
  point_key     text not null,
  file_name     text not null,
  storage_path  text not null unique,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists projects_company_idx     on public.projects (company_id);
create index if not exists phases_project_idx       on public.phases (project_id);
create index if not exists point_entries_phase_idx  on public.point_entries (phase_id);
create index if not exists attachments_phase_idx    on public.attachments (phase_id, point_key);

-- ----------------------------------------------------------------------------
-- 2) إنشاء ملف المستخدم تلقائياً
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    split_part(new.email, '@', 1),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3) الحماية: Row Level Security
--    القاعدة: لا شيء متاح للزوار (anon). كل شيء متاح فقط للمستخدمين
--    المسجّلين (authenticated) الذين أنشأت لهم حسابات بنفسك.
-- ----------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.companies     enable row level security;
alter table public.projects      enable row level security;
alter table public.phases        enable row level security;
alter table public.point_entries enable row level security;
alter table public.attachments   enable row level security;

-- profiles: كل مستخدم مسجّل يرى الأسماء، ويعدّل ملفه هو فقط
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- بيانات العمل: قراءة/إضافة/تعديل/حذف لكل مستخدم مسجّل
do $$
declare t text;
begin
  foreach t in array array['companies', 'projects', 'phases', 'point_entries', 'attachments']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_rw', t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4) التخزين: مجلد خاص للمرفقات (غير عام إطلاقاً)
--    الملفات تُقرأ عبر روابط موقّعة قصيرة العمر فقط.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do update set public = false;

drop policy if exists attachments_read   on storage.objects;
drop policy if exists attachments_write  on storage.objects;
drop policy if exists attachments_update on storage.objects;
drop policy if exists attachments_delete on storage.objects;

create policy attachments_read on storage.objects
  for select to authenticated using (bucket_id = 'attachments');

create policy attachments_write on storage.objects
  for insert to authenticated with check (bucket_id = 'attachments');

create policy attachments_update on storage.objects
  for update to authenticated using (bucket_id = 'attachments');

create policy attachments_delete on storage.objects
  for delete to authenticated using (bucket_id = 'attachments');

-- ----------------------------------------------------------------------------
-- 5) لوحة الأرقام: مجموع كل مشروع (قيمة الأعمال / النثريات / الصافي)
-- ----------------------------------------------------------------------------
create or replace view public.project_totals
with (security_invoker = true) as
select
  p.id as project_id,
  coalesce(sum(pe.amount) filter (where pe.point_key = 'works_value'), 0)  as works_value,
  coalesce(sum(pe.amount) filter (where pe.point_key = 'incidentals'), 0)  as incidentals,
  coalesce(sum(pe.amount) filter (where pe.point_key = 'net'), 0)          as net
from public.projects p
left join public.phases ph on ph.project_id = p.id
left join public.point_entries pe on pe.phase_id = ph.id
group by p.id;
