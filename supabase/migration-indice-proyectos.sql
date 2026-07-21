-- ============================================================================
-- Migración: índice GENERAL de proyectos (satisfacción empresarial del panel CEO).
-- Corre una vez en Supabase → SQL Editor → Run. Idempotente.
--
-- "Satisfacción empresarial" NO es solo lo que dicen los clientes (rating): es cómo van
-- los proyectos EN GENERAL. Esta vista combina 3 componentes en un índice 0..100:
--   • satisfacción declarada (rating 1..5)      peso 0.40  (solo si hay calificaciones)
--   • cumplimiento / predictibilidad (a tiempo)  peso 0.35  (solo si hay entregas con fecha)
--   • salud de flujo (sin vencidas ni bloqueos)  peso 0.25  (siempre disponible)
-- Cuando un componente no tiene datos, su peso se redistribuye entre los demás.
-- El portal MediaLab lee `indice` (0..100) con su OPERACIONES_SERVICE_KEY.
-- ============================================================================

create or replace view indice_proyectos as
with t as (
  select
    count(*) filter (where status <> 'done')                                     as activas,
    count(*) filter (where status <> 'done' and due_date < current_date
                       and status not in ('review','verificacion'))              as vencidas,
    count(*) filter (where status = 'blocked')                                   as bloqueadas,
    count(*) filter (where rating is not null)                                   as calificadas,
    avg(rating) filter (where rating is not null)                                as rating_prom,
    count(*) filter (where status = 'done' and due_date is not null)             as entregas_fecha,
    count(*) filter (where status = 'done' and due_date is not null
                       and completed_at is not null
                       and completed_at::date <= due_date)                       as entregas_ok
  from tasks
),
c as (
  select *,
    case when calificadas   > 0 then rating_prom / 5.0 end                       as c_sat,
    case when entregas_fecha > 0 then entregas_ok::numeric / entregas_fecha end  as c_cump,
    case when activas > 0 then 1 - least(1, (vencidas + bloqueadas)::numeric / activas) else 1 end as c_flujo
  from t
),
w as (
  select *,
    case when c_sat  is not null then 0.40 else 0 end as w_sat,
    case when c_cump is not null then 0.35 else 0 end as w_cump,
    0.25 as w_flujo
  from c
)
select
  round(100 * (coalesce(c_sat,0)*w_sat + coalesce(c_cump,0)*w_cump + c_flujo*w_flujo)
        / nullif(w_sat + w_cump + w_flujo, 0))::int                              as indice,
  round((c_sat  * 100))::int                                                     as satisfaccion,
  round((c_cump * 100))::int                                                     as cumplimiento,
  round((c_flujo * 100))::int                                                    as flujo,
  activas, vencidas, bloqueadas, calificadas
from w;

grant select on indice_proyectos to anon, authenticated;
