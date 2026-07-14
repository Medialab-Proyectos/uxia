-- Imagen por subproyecto: mapa { "Nombre del subproyecto": { url, label, path, ... } }
-- guardado como jsonb en la fila de la empresa (mismo patrón que project_descriptions).
-- Correr una vez en el SQL Editor de Supabase.
alter table companies
  add column if not exists project_images jsonb not null default '{}'::jsonb;
