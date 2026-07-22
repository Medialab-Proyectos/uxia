-- ============================================================================
-- Migración: buenas prácticas de CRECIMIENTO por proyecto (las genera el MD).
-- Corre una vez en Supabase → SQL Editor → Run. Idempotente.
--
-- El MD actúa como consultor senior/lead de producto y arma, por subproyecto, una lista corta
-- de prácticas accionables para crecer con el cliente (marcos de influencia/ventas/crecimiento,
-- voz del CEO y del lead, aliviando los dolores detectados). La app las muestra con un botón al
-- lado de los indicadores; cada práctica se puede convertir en tarea.
-- ============================================================================

create table if not exists growth_practices (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  client text,                                  -- subproyecto (null = toda la empresa)
  titulo text not null,
  porque text,                                  -- el dolor/oportunidad que ataca
  como text,                                    -- acción concreta
  marco text,                                   -- autor/marco (Cialdini, Hormozi, Sinek…)
  impacto text default 'medio',                 -- alto | medio | bajo
  esfuerzo text default 'medio',                -- alto | medio | bajo
  status text not null default 'activa',        -- activa | convertida | descartada
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists growth_practices_company_idx on growth_practices (company_id, status);

alter table growth_practices enable row level security;
drop policy if exists "admin_all_growth_practices" on growth_practices;
create policy "admin_all_growth_practices" on growth_practices for all to authenticated
  using (app_is_admin()) with check (app_is_admin());
