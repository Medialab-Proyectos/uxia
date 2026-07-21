-- ============================================================================
-- Migración: fecha de vencimiento ANTERIOR al último cambio (soporte).
-- Corre esto una vez en Supabase → SQL Editor → Run. Es idempotente.
--
-- Norma: cuando se cambia la fecha de entrega de una tarea (por el admin o por el
-- MD diario), NO se pierde la fecha previa: queda guardada en `prev_due_date` y la
-- tarjeta la muestra como "antes: dd/mm/aaaa". Sirve de soporte para justificar
-- corrimientos de fecha ante el cliente y alimenta el análisis de predictibilidad.
-- ============================================================================

alter table tasks add column if not exists prev_due_date date;
alter table tasks add column if not exists due_change_reason text;  -- motivo del último cambio de fecha

-- El empleado NO puede alterarla (solo el admin/MD). El trigger de blindaje ya
-- revierte las columnas que no le pertenecen; se añade esta al mismo guard.
create or replace function app_guard_employee_task_update() returns trigger
  language plpgsql as $fn$
begin
  if app_is_employee() then
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
    new.admin_touched_at := old.admin_touched_at;
    new.design_points := old.design_points; new.qa_defects := old.qa_defects;
    new.change_request := old.change_request; new.tools := old.tools; new.ai_usage := old.ai_usage;
    new.md_touched_at := old.md_touched_at;
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
