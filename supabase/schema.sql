-- Esquema de la base de datos del Organizador de Tareas.
-- Ejecútalo una vez en Supabase: SQL Editor → New query → pegar → Run.
--
-- Cada fila lleva el usuario que la creó (user_id) y las políticas RLS
-- garantizan que cada persona solo puede leer y modificar sus propios datos.
-- Los tablones "trabajo" y "personal" se distinguen por la columna board.

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  board text not null check (board in ('trabajo', 'personal')),
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#6366f1',
  is_me boolean not null default false,
  created_at timestamptz not null default now()
);

-- Solo puede haber un "Yo" por usuario y tablón.
create unique index if not exists members_one_me_per_board
  on public.members (user_id, board) where is_me;
create index if not exists members_user_board on public.members (user_id, board);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  board text not null check (board in ('trabajo', 'personal')),
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '',
  assignee_id uuid references public.members (id) on delete set null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'en-curso', 'bloqueado', 'hecho')),
  priority text not null default 'media' check (priority in ('alta', 'media', 'baja')),
  due_date date,
  urgent boolean not null default false,
  blocked_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_board on public.tasks (user_id, board);
create index if not exists tasks_assignee on public.tasks (assignee_id);

-- Seguridad a nivel de fila: cada usuario solo ve y toca lo suyo.
alter table public.members enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "members: solo el propietario" on public.members;
create policy "members: solo el propietario" on public.members
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "tasks: solo el propietario" on public.tasks;
create policy "tasks: solo el propietario" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.members, public.tasks to authenticated;
