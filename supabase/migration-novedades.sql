-- Migración: rastreo "Nueva / Actualizada" por persona (frentes 3 y 4).
-- Seguro e idempotente. Pégalo en Supabase → SQL Editor → Run.
-- (Ya está incluido en setup.sql; este archivo es solo el delta, por si no quieres
--  correr todo setup.sql.)

-- 1) Columnas nuevas en tasks -----------------------------------------------------
-- assignee_seen_at = última vez que el EMPLEADO vio la tarea (tag "Nueva" si es null;
--   "Actualizada" si admin_touched_at es posterior). Al abrirla, el empleado la marca vista.
-- admin_touched_at = última vez que el ADMIN (CEO) cambió la tarea → dispara "Actualizada"
--   y la campanita del empleado. El empleado NO puede tocarla (la protege el trigger).
alter table tasks add column if not exists assignee_seen_at timestamptz;
alter table tasks add column if not exists admin_touched_at timestamptz;

-- 2) Blindaje de columnas del empleado (añade la protección de admin_touched_at) -----
-- El empleado sí puede escribir assignee_seen_at (marcar visto); NO puede alterar
-- admin_touched_at (evita apagarse su propia campanita).
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
    new.admin_touched_at := old.admin_touched_at;
    if new.status is distinct from old.status and new.status not in ('doing','review','actualizada') then
      new.status := old.status;
    end if;
  end if;
  return new;
end
$fn$;
