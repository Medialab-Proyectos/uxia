-- Políticas RLS para que la app hable DIRECTO con Supabase (sin servidor intermediario).
-- Cualquier usuario autenticado (login por Supabase Auth) puede gestionar la operación.
-- Es una herramienta interna; el control fino por rol se agrega después.
--
-- Correr en Supabase → SQL Editor → pegar → Run.

-- 1) Tablas de datos
do $$
declare t text;
begin
  foreach t in array array['companies','projects','tasks','people','source_documents','app_state','insumos_pendientes','oportunidades']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "auth_all_%1$s" on %1$I;', t);
    execute format('create policy "auth_all_%1$s" on %1$I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- 2) Storage (bucket operations-documents): lectura pública, escritura de autenticados
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
