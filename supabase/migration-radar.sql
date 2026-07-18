-- Migración: Radar de oportunidades — tag "Postulado" dentro de "Me gusta".
-- Seguro e idempotente. Pégalo en Supabase → SQL Editor → Run.
-- (Ya está incluido en setup.sql; este archivo es solo el delta.)

-- postulado = la oferta/propuesta sigue en "Me gusta" (estado=me_interesa) y además
-- se marcó como postulada/aplicada. Es un tag independiente del estado.
alter table oportunidades add column if not exists postulado boolean not null default false;
alter table vacantes     add column if not exists postulado boolean not null default false;
