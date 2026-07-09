alter table if exists tasks drop constraint if exists tasks_assignee_id_fkey;

alter table if exists people
  alter column id type text using id::text;

alter table if exists tasks
  alter column assignee_id type text using assignee_id::text;

alter table if exists tasks
  add constraint tasks_assignee_id_fkey
  foreign key (assignee_id) references people(id) on delete set null;
