-- Método de conexión por persona (cómo se le envía la tarea: automático/WhatsApp/Chat/Correo).
-- Correr en Supabase → SQL Editor.
alter table people add column if not exists contact_method text default 'auto';
