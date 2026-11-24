-- ============================================================================
-- OS Maneger · Schema Supabase (Postgres + Auth Gmail + Realtime + Storage)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Seguro para reexecucao (idempotente).
-- ============================================================================

-- 1. Tabela principal de Ordens de Servico
create table if not exists public.os_orders (
  number text primary key,
  title text not null default '',
  status text not null default 'Recebido',
  link text not null default '',
  print_link text not null default '',
  path text not null default '',
  notes text not null default '',
  rank text not null default '',
  complexity text not null default '',
  urgent boolean not null default false,
  deadline text not null default '',
  printed_at text not null default '',
  received_at text not null default '',
  production_date text not null default '',
  owner text not null default '',
  elapsed_ms bigint not null default 0,
  started_at bigint not null default 0,
  workflow jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  printers jsonb not null default '[]'::jsonb,
  items jsonb not null default '[]'::jsonb,
  reminders jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  updated timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default ''
);

-- Caso a tabela ja exista sem a coluna attachments, paused_from, printers, items, reminders, datas ou metadados de auditoria:
alter table public.os_orders
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists paused_from text not null default '',
  add column if not exists printers jsonb not null default '[]'::jsonb,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists reminders jsonb not null default '[]'::jsonb,
  add column if not exists printed_at text not null default '',
  add column if not exists received_at text not null default '',
  add column if not exists production_date text not null default '',
  add column if not exists print_link text not null default '',
  add column if not exists created_by text not null default '',
  add column if not exists updated_by text not null default '';

create index if not exists os_orders_rank_idx on public.os_orders (rank);
create index if not exists os_orders_status_idx on public.os_orders (status);
create index if not exists os_orders_updated_idx on public.os_orders (updated desc);

-- 2. Lista obrigatoria de e-mails autorizados da equipe (whitelist fail-closed)
-- Cadastre ao menos o e-mail do administrador antes de usar o app:
-- insert into public.os_allowed_emails (email, role) values ('seu-email@gmail.com', 'owner') on conflict (email) do nothing;
create table if not exists public.os_allowed_emails (
  email text primary key,
  role text not null default 'equipe',
  added_at timestamptz not null default now()
);

create unique index if not exists os_allowed_emails_lower_idx
  on public.os_allowed_emails (lower(btrim(email)));

alter table public.os_allowed_emails enable row level security;

drop policy if exists "Authenticated users can check allowlist" on public.os_allowed_emails;
create policy "Authenticated users can check allowlist"
  on public.os_allowed_emails
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') <> 'true'
    and lower(btrim(email)) = lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
  );

-- 3. Funcao helper de autorizacao para RLS em schema privado (nao exposto via Data API)
-- Modo FAIL-CLOSED: exige sessao Google autenticada (nao anonima) e e-mail presente em os_allowed_emails.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_allowed_os_user()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select
    (select auth.uid()) is not null
    and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') <> 'true'
    and coalesce((select auth.jwt()) ->> 'email', '') <> ''
    and (
      coalesce((select auth.jwt()) -> 'app_metadata' ->> 'provider', '') = 'google'
      or coalesce((select auth.jwt()) -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'google'
    )
    and exists (
      select 1 from public.os_allowed_emails e
      where lower(btrim(e.email)) = lower(btrim((select auth.jwt()) ->> 'email'))
    );
$$;

revoke all on function private.is_allowed_os_user() from public, anon;
grant execute on function private.is_allowed_os_user() to authenticated;

-- Opcional: se quiser restringir SOMENTE a enderecos @gmail.com,
-- troque ou adicione na funcao acima:
--   and lower(coalesce((select auth.jwt()) ->> 'email', '')) like '%@gmail.com'

-- 4. Row Level Security (RLS) na tabela os_orders
alter table public.os_orders enable row level security;

drop policy if exists "Equipe Gmail le OS" on public.os_orders;
create policy "Equipe Gmail le OS"
  on public.os_orders
  for select
  to authenticated
  using (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail cria OS" on public.os_orders;
create policy "Equipe Gmail cria OS"
  on public.os_orders
  for insert
  to authenticated
  with check (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail atualiza OS" on public.os_orders;
create policy "Equipe Gmail atualiza OS"
  on public.os_orders
  for update
  to authenticated
  using (private.is_allowed_os_user())
  with check (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail exclui OS" on public.os_orders;
create policy "Equipe Gmail exclui OS"
  on public.os_orders
  for delete
  to authenticated
  using (private.is_allowed_os_user());

-- 5. Ativar Supabase Realtime para sincronizacao automatica entre dispositivos
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'os_orders'
  ) then
    alter publication supabase_realtime add table public.os_orders;
  end if;
end $$;

-- 6. Bucket de fallback no Supabase Storage (caso o token do Google Drive expire no aparelho)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'os-attachments',
  'os-attachments',
  false,
  26214400,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Equipe Gmail le anexos" on storage.objects;
create policy "Equipe Gmail le anexos"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'os-attachments' and private.is_allowed_os_user());

drop policy if exists "Equipe Gmail envia anexos" on storage.objects;
create policy "Equipe Gmail envia anexos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'os-attachments' and private.is_allowed_os_user());

-- 7. Modelos salvos do modulo Folha (sincronizados entre dispositivos da equipe)
create table if not exists public.folha_templates (
  name text primary key,
  state jsonb not null default '{}'::jsonb,
  updated timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default ''
);

alter table public.folha_templates enable row level security;

drop policy if exists "Equipe Gmail le modelos Folha" on public.folha_templates;
create policy "Equipe Gmail le modelos Folha"
  on public.folha_templates
  for select
  to authenticated
  using (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail salva modelos Folha" on public.folha_templates;
create policy "Equipe Gmail salva modelos Folha"
  on public.folha_templates
  for insert
  to authenticated
  with check (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail atualiza modelos Folha" on public.folha_templates;
create policy "Equipe Gmail atualiza modelos Folha"
  on public.folha_templates
  for update
  to authenticated
  using (private.is_allowed_os_user())
  with check (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail remove modelos Folha" on public.folha_templates;
create policy "Equipe Gmail remove modelos Folha"
  on public.folha_templates
  for delete
  to authenticated
  using (private.is_allowed_os_user());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'folha_templates'
  ) then
    alter publication supabase_realtime add table public.folha_templates;
  end if;
end $$;

drop policy if exists "Equipe Gmail remove anexos" on storage.objects;
create policy "Equipe Gmail remove anexos"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'os-attachments' and private.is_allowed_os_user());

-- Remover helper legado do schema publico se ainda existir
drop function if exists public.is_allowed_os_user();

-- 9. Cadastro de impressoras da grafica (OS Maneger)
create table if not exists public.os_printers (
  id text primary key,
  name text not null,
  category text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by text not null default ''
);

create unique index if not exists os_printers_lower_name_idx
  on public.os_printers (lower(btrim(name)));

alter table public.os_printers enable row level security;

drop policy if exists "Equipe Gmail le impressoras" on public.os_printers;
create policy "Equipe Gmail le impressoras"
  on public.os_printers
  for select
  to authenticated
  using (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail salva impressoras" on public.os_printers;
create policy "Equipe Gmail salva impressoras"
  on public.os_printers
  for insert
  to authenticated
  with check (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail atualiza impressoras" on public.os_printers;
create policy "Equipe Gmail atualiza impressoras"
  on public.os_printers
  for update
  to authenticated
  using (private.is_allowed_os_user())
  with check (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail remove impressoras" on public.os_printers;
create policy "Equipe Gmail remove impressoras"
  on public.os_printers
  for delete
  to authenticated
  using (private.is_allowed_os_user());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'os_printers'
  ) then
    alter publication supabase_realtime add table public.os_printers;
  end if;
end $$;

-- 10. Dados sincronizados entre dispositivos de toda a suite (presets personalizados, tipos de papel, estado Folha, projetos/estado Numera Bloco, preferencias OS Maneger)
create table if not exists public.suite_data (
  key text primary key,
  app text not null default 'suite',
  payload jsonb not null default '{}'::jsonb,
  updated timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default '',
  constraint suite_data_key_len check (char_length(key) between 1 and 120),
  constraint suite_data_app_chk check (app in ('folha', 'numera-bloco', 'os-maneger', 'suite'))
);

create index if not exists suite_data_app_updated_idx
  on public.suite_data (app, updated desc);

alter table public.suite_data enable row level security;

drop policy if exists "Equipe Gmail le suite_data" on public.suite_data;
create policy "Equipe Gmail le suite_data"
  on public.suite_data
  for select
  to authenticated
  using (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail cria suite_data" on public.suite_data;
create policy "Equipe Gmail cria suite_data"
  on public.suite_data
  for insert
  to authenticated
  with check (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail atualiza suite_data" on public.suite_data;
create policy "Equipe Gmail atualiza suite_data"
  on public.suite_data
  for update
  to authenticated
  using (private.is_allowed_os_user())
  with check (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail remove suite_data" on public.suite_data;
create policy "Equipe Gmail remove suite_data"
  on public.suite_data
  for delete
  to authenticated
  using (private.is_allowed_os_user());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'suite_data'
  ) then
    alter publication supabase_realtime add table public.suite_data;
  end if;
end $$;

-- 11. Atendimento de Balcao (criacao, ajuste, cronometro — sem exigencia inicial de numero de cliente ou pedido)
create table if not exists public.os_counter_tickets (
  id text primary key,
  code text not null default '',
  customer_name text not null default '',
  customer_contact text not null default '',
  client_number text not null default '',
  order_number text not null default '',
  linked_os_number text not null default '',
  service_type text not null default 'criacao',
  channel text not null default 'balcao',
  file_status text not null default 'cliente_trouxe',
  title text not null default '',
  briefing text not null default '',
  status text not null default 'Aguardando',
  attendant text not null default '',
  urgent boolean not null default false,
  estimated_minutes integer not null default 0,
  revisions_count integer not null default 0,
  elapsed_ms bigint not null default 0,
  started_at bigint not null default 0,
  sessions jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default ''
);

create index if not exists os_counter_tickets_status_updated_idx
  on public.os_counter_tickets (status, updated desc);

create index if not exists os_counter_tickets_linked_os_idx
  on public.os_counter_tickets (linked_os_number)
  where linked_os_number <> '';

alter table public.os_counter_tickets enable row level security;

drop policy if exists "Equipe Gmail le balcao" on public.os_counter_tickets;
create policy "Equipe Gmail le balcao"
  on public.os_counter_tickets
  for select
  to authenticated
  using (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail cria balcao" on public.os_counter_tickets;
create policy "Equipe Gmail cria balcao"
  on public.os_counter_tickets
  for insert
  to authenticated
  with check (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail atualiza balcao" on public.os_counter_tickets;
create policy "Equipe Gmail atualiza balcao"
  on public.os_counter_tickets
  for update
  to authenticated
  using (private.is_allowed_os_user())
  with check (private.is_allowed_os_user());

drop policy if exists "Equipe Gmail remove balcao" on public.os_counter_tickets;
create policy "Equipe Gmail remove balcao"
  on public.os_counter_tickets
  for delete
  to authenticated
  using (private.is_allowed_os_user());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'os_counter_tickets'
  ) then
    alter publication supabase_realtime add table public.os_counter_tickets;
  end if;
end $$;

-- 12. Privilegios minimos em nivel de tabela (defesa em profundidade alem do RLS)
revoke all on table public.os_orders, public.folha_templates, public.os_printers, public.suite_data, public.os_counter_tickets, public.os_allowed_emails from public, anon;
revoke all on table public.os_allowed_emails from authenticated;
grant select on table public.os_allowed_emails to authenticated;
revoke truncate, references, trigger on table public.os_orders, public.folha_templates, public.os_printers, public.suite_data, public.os_counter_tickets from authenticated;
grant select, insert, update, delete on table public.os_orders, public.folha_templates, public.os_printers, public.suite_data, public.os_counter_tickets to authenticated;
