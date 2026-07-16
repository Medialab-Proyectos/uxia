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
-- Empresa/organización de la persona (obligatoria cuando el tipo es "Externo").
alter table people add column if not exists org text;

-- 3b) Imagen por subproyecto (jsonb en la empresa) -------------------------------
alter table companies add column if not exists project_images jsonb not null default '{}'::jsonb;

-- 3c) Horas cumplidas al terminar una tarea (horario laboral CO) ------------------
alter table tasks add column if not exists completed_at timestamptz;
alter table tasks add column if not exists worked_hours numeric;

-- 3d) Categorización: alcance del contrato por empresa + tipo de cada tarea --------
alter table companies add column if not exists scope jsonb not null default '[]'::jsonb;
alter table tasks add column if not exists category text;

-- 3e) Satisfacción tras entrega (opcional, por tarea finalizada) -------------------
alter table tasks add column if not exists rating numeric;         -- 1..5 estrellas
alter table tasks add column if not exists rating_comment text;
alter table tasks add column if not exists ai_usage numeric;       -- % de IA usada (0..100)

-- 3f) Endpoints para el portal de empleados (satisfacción general) -----------------
-- PostgREST expone estas vistas como /rest/v1/satisfaccion_general y /satisfaccion_por_empresa.
create or replace view satisfaccion_general as
  select
    count(*) filter (where rating is not null)                as tareas_calificadas,
    round(avg(rating) filter (where rating is not null), 2)   as satisfaccion_promedio,
    round(avg(ai_usage) filter (where ai_usage is not null), 1) as ia_promedio
  from tasks;
create or replace view satisfaccion_por_empresa as
  select
    t.company_id,
    c.name as empresa,
    count(*) filter (where t.rating is not null)              as tareas_calificadas,
    round(avg(t.rating) filter (where t.rating is not null), 2) as satisfaccion_promedio,
    round(avg(t.ai_usage) filter (where t.ai_usage is not null), 1) as ia_promedio
  from tasks t left join companies c on c.id = t.company_id
  group by t.company_id, c.name;

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
