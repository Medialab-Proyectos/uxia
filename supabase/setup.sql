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

-- 2c) Señales de producto para el modelo MDSSP (/mdssp.html) -----------------------
-- Mediciones de salud del producto que NO vienen de tareas: se extraen de documentos/
-- feedback/contexto (el run diario las analiza) o se capturan a mano. Cada una es una
-- FUERZA del catálogo (bugs, calidad, usabilidad, satisfaccion_equipo, presupuesto,
-- tecnologia, dependencias, mercado, salud...) que mueve la partícula del subproyecto.
create table if not exists product_signals (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  client text,                               -- subproyecto (null = toda la empresa)
  force text not null,                       -- clave del catálogo de fuerzas
  intensity numeric not null default 0.4,    -- 0..1 qué tan fuerte según la evidencia
  weight numeric,                            -- 0..1 override del peso (opcional)
  title text not null,
  evidence text,
  source text,                               -- documento/insumo de origen
  status text not null default 'activa',     -- activa | archivada
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_signals_company_idx on product_signals (company_id, status);

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

-- 3d-bis) Codigo de referencia fijo por tarea (ej. AR01). El sistema lo asigna una vez
-- y NO cambia aunque se borren/reordenen tareas. Sirve para citar una tarea en cualquier lado.
alter table tasks add column if not exists task_ref text;

-- 3d-ter) Portal de empleados: comentarios del empleado + marca de "actualizada".
-- comments = [{ author, role, text, at }]; employee_touched_at = última acción del empleado
-- (el admin ve la tarea como "Actualizada" hasta que la revise).
alter table tasks add column if not exists comments jsonb not null default '[]'::jsonb;
alter table tasks add column if not exists employee_touched_at timestamptz;

-- 3d-quater) Rastreo "Nueva / Actualizada" POR PERSONA.
-- assignee_seen_at = última vez que el EMPLEADO vio la tarea (tag "Nueva" si es null;
--   "Actualizada" si admin_touched_at es posterior). Al abrirla, el empleado la marca vista.
-- admin_touched_at = última vez que el ADMIN (CEO) cambió la tarea → dispara "Actualizada"
--   y la campanita del empleado. El empleado NO puede tocarla (la protege el trigger).
alter table tasks add column if not exists assignee_seen_at timestamptz;
alter table tasks add column if not exists admin_touched_at timestamptz;

-- 3d-quinquies) Instrumentación DesignOps: puntos de diseño (estimación por complejidad
-- 1=simple / 2=media / 4=compleja), defectos detectados en QA y marca de Change Request
-- (cambio pedido por el cliente DESPUÉS de aprobar el diseño). Alimentan velocidad,
-- utilización, calidad y eficiencia del tablero DesignOps. Las estima/valida el admin o el
-- MD diario; el empleado NO las puede tocar (las protege el trigger).
alter table tasks add column if not exists design_points numeric;   -- 1 | 2 | 4
alter table tasks add column if not exists qa_defects numeric;      -- defectos UX/UI hallados
alter table tasks add column if not exists change_request boolean not null default false;
alter table tasks add column if not exists tools jsonb not null default '[]'::jsonb; -- herramientas usadas
-- ai_usage (ya existe en 3e) = % de IA usada en la tarea (0..100). Con `tools` da la
-- visibilidad de "uso y consumo de IA + herramientas" por tarea que pide negocio.

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

-- 4) Políticas RLS POR ROL --------------------------------------------------------
-- El ADMIN (CEO) gestiona TODO. El EMPLEADO (Supabase Auth con user_metadata.role =
-- 'employee', que crea api/employee.js) solo ve/actualiza SUS tareas, ve su propio
-- registro de personas y los nombres de empresas/proyectos. NO ve Radar (oportunidades/
-- vacantes), insumos, ni datos de otros.

-- Lista de ADMINS (CEO). Deny-by-default: quien NO esté aquí y no sea empleado no ve nada.
-- >>> Ajusta el correo del CEO si cambia. <<<
create table if not exists app_admins (email text primary key);
insert into app_admins (email) values ('hello@medialab.design') on conflict do nothing;
alter table app_admins enable row level security; -- solo accesible vía las funciones definer

-- ¿Admin? (email en app_admins). SECURITY DEFINER: lee app_admins saltando su RLS.
create or replace function app_is_admin() returns boolean
  language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from app_admins a where lower(a.email) = lower(auth.jwt() ->> 'email'))
$fn$;

-- ¿Empleado? (Supabase Auth con user_metadata.role = 'employee', que pone api/employee.js).
create or replace function app_is_employee() returns boolean
  language sql stable as $fn$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'employee'
$fn$;

-- Habilita RLS y limpia políticas previas en todas las tablas.
do $$
declare t text;
begin
  foreach t in array array['companies','projects','tasks','people','source_documents','app_state','insumos_pendientes','oportunidades','vacantes','product_signals']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "auth_all_%1$s" on %1$I;', t);
    execute format('drop policy if exists "admin_all_%1$s" on %1$I;', t);
  end loop;
end $$;

-- ADMIN (email en app_admins): control total en TODAS las tablas.
do $$
declare t text;
begin
  foreach t in array array['companies','projects','tasks','people','source_documents','app_state','insumos_pendientes','oportunidades','vacantes','product_signals']
  loop
    execute format('create policy "admin_all_%1$s" on %1$I for all to authenticated using (app_is_admin()) with check (app_is_admin());', t);
  end loop;
end $$;

-- EMPLEADO: lectura de nombres de empresas y proyectos (para mostrar contexto).
drop policy if exists "emp_read_companies" on companies;
create policy "emp_read_companies" on companies for select to authenticated using (app_is_employee());
drop policy if exists "emp_read_projects" on projects;
create policy "emp_read_projects" on projects for select to authenticated using (app_is_employee());

-- EMPLEADO: solo SU propio registro en people.
drop policy if exists "emp_self_people" on people;
create policy "emp_self_people" on people for select to authenticated
  using (app_is_employee() and lower(email) = lower(auth.jwt() ->> 'email'));

-- EMPLEADO: solo SUS tareas (assignee_id = su persona). Puede leer y actualizar.
drop policy if exists "emp_read_tasks" on tasks;
create policy "emp_read_tasks" on tasks for select to authenticated
  using (app_is_employee() and assignee_id in (
    select id from people where lower(email) = lower(auth.jwt() ->> 'email')));
drop policy if exists "emp_update_tasks" on tasks;
create policy "emp_update_tasks" on tasks for update to authenticated
  using (app_is_employee() and assignee_id in (
    select id from people where lower(email) = lower(auth.jwt() ->> 'email')))
  with check (app_is_employee() and assignee_id in (
    select id from people where lower(email) = lower(auth.jwt() ->> 'email')));

-- Blindaje de COLUMNAS: aunque el empleado tenga UPDATE, solo puede cambiar status
-- (a doing/review/actualizada), comments y employee_touched_at. Lo demás se revierte.
create or replace function app_guard_employee_task_update() returns trigger
  language plpgsql as $fn$
begin
  if app_is_employee() then
    new.company_id := old.company_id; new.client := old.client; new.title := old.title;
    new.priority := old.priority; new.role := old.role; new.owner := old.owner;
    new.assignee_id := old.assignee_id; new.due_date := old.due_date;
    new.delivery_date := old.delivery_date; new.source := old.source;
    new.audience := old.audience; new.sync_mode := old.sync_mode; new.evidence := old.evidence;
    new.description := old.description; new.user_story := old.user_story;
    new.acceptance_criteria := old.acceptance_criteria; new.attachments := old.attachments;
    new.email_to := old.email_to; new.email_subject := old.email_subject;
    new.completed_at := old.completed_at; new.worked_hours := old.worked_hours;
    new.category := old.category; new.rating := old.rating;
    new.rating_comment := old.rating_comment; new.ai_usage := old.ai_usage;
    new.task_ref := old.task_ref; new.created_at := old.created_at;
    -- El empleado NO puede alterar el sello del admin (evita apagarse su propia campanita).
    -- Sí puede escribir assignee_seen_at (marcar la tarea como vista) — no se revierte.
    new.admin_touched_at := old.admin_touched_at;
    -- Instrumentación DesignOps: solo la fija el admin/MD, el empleado no.
    new.design_points := old.design_points; new.qa_defects := old.qa_defects;
    new.change_request := old.change_request; new.tools := old.tools; new.ai_usage := old.ai_usage;
    if new.status is distinct from old.status and new.status not in ('doing','review','actualizada') then
      new.status := old.status;
    end if;
  end if;
  return new;
end
$fn$;
drop trigger if exists app_guard_task_update on tasks;
create trigger app_guard_task_update before update on tasks
  for each row execute function app_guard_employee_task_update();

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
