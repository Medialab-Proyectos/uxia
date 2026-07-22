-- ============================================================================
-- Migración: LÍDERES DE SUBPROYECTO (empleados MediaLab).
-- Corre una vez en Supabase → SQL Editor → Run. Idempotente.
--
-- Un líder de subproyecto puede:
--   - crear tareas nuevas en SU subproyecto (company_id + client que lidera),
--   - subir insumos a SU subproyecto,
--   - editar/borrar SOLO las tareas que ÉL creó (created_by = su correo).
-- El resto de empleados siguen igual (solo ven/actualizan sus tareas asignadas, blindados).
-- La seguridad la dan estas políticas RLS + el guard de columnas.
-- ============================================================================

-- 1) Quién creó cada tarea (correo). Las tareas del admin/MD quedan con su creador o null.
alter table tasks add column if not exists created_by text;

-- 2) Liderazgos: qué correo lidera qué subproyecto (company_id + client).
create table if not exists subproject_leads (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null,
  client      text not null,
  email       text not null,
  created_at  timestamptz default now(),
  unique (company_id, client, email)
);
create index if not exists subproject_leads_email_idx on subproject_leads (lower(email));

alter table subproject_leads enable row level security;
drop policy if exists "admin_all_subproject_leads" on subproject_leads;
create policy "admin_all_subproject_leads" on subproject_leads for all to authenticated
  using (app_is_admin()) with check (app_is_admin());
drop policy if exists "lead_read_own_leads" on subproject_leads;
create policy "lead_read_own_leads" on subproject_leads for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- 3) ¿El usuario actual lidera este subproyecto? (SECURITY DEFINER: lee subproject_leads.)
create or replace function app_is_lead(cid text, cli text) returns boolean
  language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from subproject_leads l
    where l.company_id = cid and coalesce(l.client, '') = coalesce(cli, '')
      and lower(l.email) = lower(auth.jwt() ->> 'email'))
$fn$;

-- 4) Políticas de LÍDER sobre tasks. Se SUMAN a las de empleado/asignado (permisivas = OR).
drop policy if exists "lead_read_tasks" on tasks;
create policy "lead_read_tasks" on tasks for select to authenticated
  using (app_is_employee() and app_is_lead(company_id, client));
drop policy if exists "lead_insert_tasks" on tasks;
create policy "lead_insert_tasks" on tasks for insert to authenticated
  with check (app_is_employee() and app_is_lead(company_id, client)
    and lower(coalesce(created_by, '')) = lower(auth.jwt() ->> 'email'));
drop policy if exists "lead_update_own_tasks" on tasks;
create policy "lead_update_own_tasks" on tasks for update to authenticated
  using (app_is_employee() and lower(coalesce(created_by, '')) = lower(auth.jwt() ->> 'email'))
  with check (app_is_employee() and lower(coalesce(created_by, '')) = lower(auth.jwt() ->> 'email'));
drop policy if exists "lead_delete_own_tasks" on tasks;
create policy "lead_delete_own_tasks" on tasks for delete to authenticated
  using (app_is_employee() and lower(coalesce(created_by, '')) = lower(auth.jwt() ->> 'email'));

-- 5) LÍDER: leer / subir / borrar insumos de SU subproyecto.
drop policy if exists "lead_read_insumos" on insumos_pendientes;
create policy "lead_read_insumos" on insumos_pendientes for select to authenticated
  using (app_is_employee() and app_is_lead(company_id, client));
drop policy if exists "lead_insert_insumos" on insumos_pendientes;
create policy "lead_insert_insumos" on insumos_pendientes for insert to authenticated
  with check (app_is_employee() and app_is_lead(company_id, client));
drop policy if exists "lead_delete_insumos" on insumos_pendientes;
create policy "lead_delete_insumos" on insumos_pendientes for delete to authenticated
  using (app_is_employee() and app_is_lead(company_id, client));

-- 6) Un LÍDER puede leer las personas (para elegir responsable al crear tareas).
drop policy if exists "lead_read_people" on people;
create policy "lead_read_people" on people for select to authenticated
  using (app_is_employee() and exists (
    select 1 from subproject_leads l where lower(l.email) = lower(auth.jwt() ->> 'email')));

-- 7) El guard de empleado NO debe revertir los cambios del CREADOR sobre SU propia tarea.
--    (Copia del guard original + la excepción del creador + fija created_by inmutable para el resto.)
create or replace function app_guard_employee_task_update() returns trigger
  language plpgsql as $fn$
begin
  -- El creador (líder) edita libremente SU tarea. Los demás empleados quedan blindados.
  if app_is_employee() and not (old.created_by is not null
      and lower(old.created_by) = lower(auth.jwt() ->> 'email')) then
    new.company_id := old.company_id; new.client := old.client; new.title := old.title;
    new.priority := old.priority; new.role := old.role; new.owner := old.owner;
    new.assignee_id := old.assignee_id; new.due_date := old.due_date;
    new.prev_due_date := old.prev_due_date; new.due_change_reason := old.due_change_reason;
    new.delivery_date := old.delivery_date; new.source := old.source;
    new.audience := old.audience; new.sync_mode := old.sync_mode; new.evidence := old.evidence;
    new.description := old.description; new.user_story := old.user_story;
    new.acceptance_criteria := old.acceptance_criteria; new.attachments := old.attachments;
    new.email_to := old.email_to; new.email_subject := old.email_subject;
    new.completed_at := old.completed_at; new.worked_hours := old.worked_hours;
    new.category := old.category; new.rating := old.rating;
    new.rating_comment := old.rating_comment; new.ai_usage := old.ai_usage;
    new.task_ref := old.task_ref; new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.admin_touched_at := old.admin_touched_at;
    new.design_points := old.design_points; new.qa_defects := old.qa_defects;
    new.change_request := old.change_request; new.tools := old.tools; new.ai_usage := old.ai_usage;
    new.md_touched_at := old.md_touched_at;
    if new.status is distinct from old.status and new.status not in ('doing','review','actualizada') then
      new.status := old.status;
    end if;
  else
    -- Aun editando su propia tarea, el creador no puede cambiar quién la creó.
    new.created_by := old.created_by;
  end if;
  return new;
end
$fn$;
