-- Migración: instrumentación DesignOps (puntos de diseño, defectos QA, Change Requests).
-- Seguro e idempotente. Pégalo en Supabase → SQL Editor → Run.
-- (Ya está incluido en setup.sql; este archivo es solo el delta.)

-- 1) Columnas nuevas en tasks -----------------------------------------------------
-- design_points  = estimación por complejidad: 1 simple / 2 media / 4 compleja.
--                  Alimenta velocidad (pts/sem), utilización por diseñador y duración.
-- qa_defects     = defectos UX/UI hallados en QA de esa tarea (calidad).
-- change_request = el cliente pidió el cambio DESPUÉS de aprobar el diseño (eficiencia/alcance).
alter table tasks add column if not exists design_points numeric;
alter table tasks add column if not exists qa_defects numeric;
alter table tasks add column if not exists change_request boolean not null default false;
-- tools = herramientas usadas en la tarea (Figma, Claude, etc.); con ai_usage (0..100)
-- da la visibilidad de uso/consumo de IA + herramientas por tarea.
alter table tasks add column if not exists tools jsonb not null default '[]'::jsonb;

-- 2) Blindaje: el empleado NO puede alterar la instrumentación DesignOps -----------
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
    new.change_request := old.change_request; new.tools := old.tools; new.ai_usage := old.ai_usage;
    if new.status is distinct from old.status and new.status not in ('doing','review','actualizada') then
      new.status := old.status;
    end if;
  end if;
  return new;
end
$fn$;
