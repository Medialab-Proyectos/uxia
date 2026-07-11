-- Insumos pendientes de análisis (imágenes, .md, .txt que se suben durante el día
-- para que el "run diario" los procese). Tabla dedicada para que NO la toque el
-- sync de source_documents (que borra filas con task_count = 0).
--
-- Cómo correrlo: Supabase → SQL Editor → nuevo query → pega esto → Run.
-- Requiere además el bucket de Storage `operations-documents` (público).

create table if not exists insumos_pendientes (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  client text,
  file_name text not null,
  storage_path text not null,
  content_type text,
  kind text not null default 'imagen',       -- 'imagen' | 'texto'
  raw_text text,                              -- contenido para .md/.txt (texto)
  status text not null default 'pendiente',   -- 'pendiente' | 'procesado'
  created_at timestamptz not null default now()
);

create index if not exists insumos_pendientes_company_status_idx
  on insumos_pendientes (company_id, status);
