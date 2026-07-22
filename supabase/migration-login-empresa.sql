-- ============================================================================
-- Migración: login por empresa (branding + empleado atado a su empresa).
-- Corre una vez en Supabase → SQL Editor → Run. Idempotente.
--
-- - people.company_id: la empresa a la que pertenece el empleado externo (para acotar su vista
--   y su branding). null = empleado interno de MediaLab (ve normal).
-- - company_branding(cid): función pública (SECURITY DEFINER) que devuelve nombre + logo de UNA
--   empresa por id, para brandear la pantalla de login ANTES de autenticar. No permite listar
--   todas (hay que pasar el id, que viene del token del link). No expone datos sensibles.
-- La seguridad real la siguen dando Supabase Auth + las políticas RLS (el empleado solo ve SUS
-- tareas). El token del link es anti-enumeración/branding, no control de acceso.
-- ============================================================================

alter table people add column if not exists company_id text;

create or replace function company_branding(cid text)
  returns table (id text, name text, logo jsonb)
  language sql stable security definer set search_path = public as $fn$
  select c.id, c.name, c.logo from companies c where c.id = cid
$fn$;

grant execute on function company_branding(text) to anon, authenticated;

-- El empleado no puede cambiar su propia company_id (la fija el admin al crearlo). Ya lo protege
-- el patrón de RLS de people (solo lee su registro); las escrituras las hace api/employee.js con
-- service_role.
