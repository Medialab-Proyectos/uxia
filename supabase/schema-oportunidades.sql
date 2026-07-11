-- Oportunidades del Radar. El scraping YA NO lo hace la interfaz: lo corre Claude
-- Code por dentro (scripts/radar-fetch.mjs, reutiliza server/scraper.js) y guarda
-- aquí. La app solo lee, busca y da seguimiento.
--
-- Guarda el objeto de oportunidad TAL CUAL (jsonb `data`) para reutilizar lo que ya
-- existe; solo se indexan score/estado.
-- Correr en Supabase → SQL Editor.

create table if not exists oportunidades (
  id text primary key,
  score int not null default 0,
  estado text not null default 'nueva',   -- nueva | me_interesa | descartada
  data jsonb not null default '{}'::jsonb, -- objeto completo del scraper
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oportunidades_estado_idx on oportunidades (estado, score desc);

alter table oportunidades enable row level security;
drop policy if exists "auth_all_oportunidades" on oportunidades;
create policy "auth_all_oportunidades" on oportunidades for all to authenticated using (true) with check (true);
