alter table if exists people
  add column if not exists company_ids jsonb not null default '[]'::jsonb;
