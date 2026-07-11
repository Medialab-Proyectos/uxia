-- Vacantes de empleo del Radar. Las llena Claude Code (búsqueda web) y la app las
-- muestra/busca/da seguimiento. Guarda el objeto tal cual en jsonb `data`.
-- Correr en Supabase → SQL Editor → Run.

create table if not exists vacantes (
  id text primary key,
  score int not null default 0,
  estado text not null default 'nueva',   -- nueva | me_interesa | descartada
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vacantes_estado_idx on vacantes (estado, score desc);

alter table vacantes enable row level security;
drop policy if exists "auth_all_vacantes" on vacantes;
create policy "auth_all_vacantes" on vacantes for all to authenticated using (true) with check (true);
