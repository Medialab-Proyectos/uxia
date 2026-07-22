-- ============================================================================
-- Migración: notificaciones push (PWA). Guarda la suscripción push de cada dispositivo.
-- Corre una vez en Supabase → SQL Editor → Run. Idempotente.
--
-- La tabla la escriben/leen SOLO las funciones serverless con service_role (api/push-subscribe
-- y api/notify-cron). Con RLS activo y sin políticas, anon/authenticated no tienen acceso: el
-- service_role las salta. No expone datos al navegador.
-- ============================================================================

create table if not exists push_subscriptions (
  endpoint          text primary key,
  email             text,
  company_id        text,
  subscription      jsonb not null,
  last_notified_at  timestamptz,
  created_at        timestamptz default now()
);

create index if not exists push_subscriptions_email_idx on push_subscriptions (email);

alter table push_subscriptions enable row level security;
-- Sin políticas a propósito: solo el service_role (funciones serverless) accede.
