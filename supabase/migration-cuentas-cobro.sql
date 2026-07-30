-- Cuenta de cobro mensual por empleado (contabilidad de fin de mes).
-- Cada empleado registra su cuenta del mes; el admin ve quién entregó y quién falta.
-- Correr en el SQL editor de Supabase. Requiere app_is_admin()/app_is_employee() de setup.sql.

create table if not exists cuentas_cobro (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,                       -- email del empleado (dueño de la cuenta)
  period       text not null,                       -- mes en formato 'YYYY-MM'
  status       text not null default 'entregada',   -- 'pendiente' | 'entregada'
  amount       numeric,                             -- monto (opcional)
  note         text,                                -- concepto / nota
  file_url     text,                                -- soporte (opcional)
  submitted_at timestamptz default now(),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (email, period)
);

create index if not exists cuentas_cobro_period_idx on cuentas_cobro (period);
create index if not exists cuentas_cobro_email_idx on cuentas_cobro (lower(email));

alter table cuentas_cobro enable row level security;

drop policy if exists cuentas_cobro_select on cuentas_cobro;
drop policy if exists cuentas_cobro_insert on cuentas_cobro;
drop policy if exists cuentas_cobro_update on cuentas_cobro;

-- Lee: el admin todas; el empleado solo la suya.
create policy cuentas_cobro_select on cuentas_cobro for select using (
  app_is_admin() or (app_is_employee() and lower(email) = lower(auth.jwt() ->> 'email'))
);

-- Inserta: el empleado solo la suya (email = su propio email). El admin también puede registrar.
create policy cuentas_cobro_insert on cuentas_cobro for insert with check (
  app_is_admin() or (app_is_employee() and lower(email) = lower(auth.jwt() ->> 'email'))
);

-- Actualiza: el empleado solo la suya; el admin cualquiera (para marcar/corregir).
create policy cuentas_cobro_update on cuentas_cobro for update using (
  app_is_admin() or (app_is_employee() and lower(email) = lower(auth.jwt() ->> 'email'))
) with check (
  app_is_admin() or (app_is_employee() and lower(email) = lower(auth.jwt() ->> 'email'))
);
