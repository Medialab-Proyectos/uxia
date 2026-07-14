-- ============================================================================
-- SETUP COMPLETO — corre ESTE archivo una vez en Supabase → SQL Editor → Run.
-- Es idempotente (se puede correr varias veces sin dañar nada).
-- Crea las tablas nuevas, la columna de método de conexión y TODAS las políticas
-- RLS (tablas + Storage) para que la app hable directo con Supabase.
-- (Asume que la base ya existe: companies, projects, tasks, people,
--  source_documents, app_state. Si no, corre antes supabase/schema.sql.)
-- ============================================================================

-- 1) Insumos pendientes (imágenes/MD/TXT que analiza el run diario) --------------
create table if not exists insumos_pendientes (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  client text,
  file_name text not null,
  storage_path text not null,
  content_type text,
  kind text not null default 'imagen',       -- 'imagen' | 'texto'
  raw_text text,
  status text not null default 'pendiente',   -- 'pendiente' | 'procesado'
  created_at timestamptz not null default now()
);
create index if not exists insumos_pendientes_company_status_idx
  on insumos_pendientes (company_id, status);

-- 2) Oportunidades del Radar (las llena Claude Code; la app solo lee/sigue) -------
create table if not exists oportunidades (
  id text primary key,
  score int not null default 0,
  estado text not null default 'nueva',   -- nueva | me_interesa | descartada
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists oportunidades_estado_idx on oportunidades (estado, score desc);

-- 2b) Vacantes de empleo del Radar (las llena Claude Code; la app solo lee/sigue) --
create table if not exists vacantes (
  id text primary key,
  score int not null default 0,
  estado text not null default 'nueva',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vacantes_estado_idx on vacantes (estado, score desc);

-- 3) Método de conexión por persona ---------------------------------------------
alter table people add column if not exists contact_method text default 'auto';

-- 3b) Imagen por subproyecto (jsonb en la empresa) -------------------------------
alter table companies add column if not exists project_images jsonb not null default '{}'::jsonb;

-- 4) Políticas RLS: usuario autenticado gestiona todo (herramienta interna) -------
do $$
declare t text;
begin
  foreach t in array array['companies','projects','tasks','people','source_documents','app_state','insumos_pendientes','oportunidades','vacantes']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "auth_all_%1$s" on %1$I;', t);
    execute format('create policy "auth_all_%1$s" on %1$I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- 5) Storage (bucket operations-documents): lectura pública, escritura autenticada
drop policy if exists "ops_public_read" on storage.objects;
create policy "ops_public_read" on storage.objects
  for select using (bucket_id = 'operations-documents');
drop policy if exists "ops_auth_insert" on storage.objects;
create policy "ops_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'operations-documents');
drop policy if exists "ops_auth_update" on storage.objects;
create policy "ops_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'operations-documents');
drop policy if exists "ops_auth_delete" on storage.objects;
create policy "ops_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'operations-documents');
