-- Migración: tag "Tocada por el MD". Seguro e idempotente. Pégalo en Supabase → SQL Editor.
-- md_touched_at = el MD (daily-run) complementó/enriqueció la tarea; el admin debe revisar.
alter table tasks add column if not exists md_touched_at timestamptz;

-- Blindaje: el empleado no puede alterar md_touched_at.
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
    new.design_points := old.design_points; new.qa_defects := old.qa_defects;
    new.change_request := old.change_request; new.tools := old.tools;
    new.md_touched_at := old.md_touched_at;
    -- change_requests NO se revierte: el empleado puede resolver un CR.
    if new.status is distinct from old.status and new.status not in ('doing','review','actualizada') then
      new.status := old.status;
    end if;
  end if;
  return new;
end
$fn$;
