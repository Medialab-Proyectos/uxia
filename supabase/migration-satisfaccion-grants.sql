-- ============================================================================
-- Migración: exponer las vistas de satisfacción al portal (rol autenticado).
-- Corre una vez en Supabase → SQL Editor → Run. Idempotente.
--
-- satisfaccion_general y satisfaccion_por_empresa son VISTAS agregadas sobre `tasks`
-- (promedio de rating y ai_usage). Se recalculan SOLAS en cada consulta (no hay que
-- "refrescarlas"): lo que hay que mantener al día es el DATO fuente — el `rating` y el
-- `ai_usage` de las tareas — que captura el admin/MD.
--
-- Por defecto una vista corre con los permisos de su DUEÑO (no aplica el RLS por-tarea del
-- empleado), así que devuelve el agregado de TODA la empresa. Solo falta DAR EL SELECT al
-- rol `authenticated`/`anon` para que el portal (empleado y admin) pueda leerlas.
-- Son datos agregados de empresa (sin detalle de tarea): seguros de compartir con el equipo.
-- ============================================================================

-- Se aseguran las vistas (por si esta base no corrió el setup completo).
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

grant select on satisfaccion_general to anon, authenticated;
grant select on satisfaccion_por_empresa to anon, authenticated;
