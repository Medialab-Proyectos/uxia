create extension if not exists pgcrypto;

create table if not exists companies (
  id text primary key,
  name text not null,
  status text not null default 'activa',
  owner text not null default 'MediaLab',
  workspaces jsonb not null default '[]'::jsonb,
  archived_clients jsonb not null default '{}'::jsonb,
  project_links jsonb not null default '{}'::jsonb,
  project_descriptions jsonb not null default '{}'::jsonb,
  context_documents jsonb not null default '{}'::jsonb,
  project_images jsonb not null default '{}'::jsonb,
  logo jsonb,
  connectors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  status text not null default 'activo',
  board_tool text,
  board_url text,
  description text,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists people (
  id text primary key,
  name text not null,
  email text,
  phone text,
  type text not null default 'Empleado MediaLab',
  chat_url text,
  company_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  client text,
  title text not null,
  status text not null,
  priority text not null,
  role text,
  owner text,
  assignee_id text references people(id) on delete set null,
  due_date date,
  delivery_date date,
  source text,
  audience text,
  sync_mode text,
  evidence text,
  description text,
  user_story text,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  email_to text,
  email_subject text,
  created_at timestamptz not null default now()
);

create table if not exists source_documents (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  client text,
  source text,
  file_name text not null,
  storage_path text,
  status text not null default 'uploaded',
  task_ids jsonb not null default '[]'::jsonb,
  task_count integer not null default 0,
  attachments jsonb not null default '[]'::jsonb,
  summary text,
  raw_text text,
  deleted_source boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists app_state (
  id text primary key default 'operations',
  active_company text,
  updated_at timestamptz not null default now()
);

insert into companies (id, name, status, owner, workspaces)
values ('metrics-lab', 'Metrics Lab', 'activa', 'MediaLab', '["Documentacion"]'::jsonb)
on conflict (id) do nothing;

insert into app_state (id, active_company)
values ('operations', 'metrics-lab')
on conflict (id) do nothing;
