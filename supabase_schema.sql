-- Схема базы сервисного центра КЁЛТИСОН.
-- Статусы заказа:
--   received    — Принят
--   in_progress — В работе
--   ready       — Готов
--   issued      — Выдан
-- Файл можно выполнить повторно: новые колонки добавляются, если их ещё нет.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone text,
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number serial,
  client_id uuid references public.clients (id),
  device_type text,
  brand_model text,
  serial_number text,
  declared_defect text,
  appearance text,
  kit text,
  repair_cost numeric,
  prepayment numeric,
  estimated_ready_at date,
  receiver_notes text,
  recommendations text,
  guarantee_days integer default 30,
  status text default 'received' check (
    status in ('received', 'in_progress', 'ready', 'issued')
  ),
  created_at timestamp with time zone default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  line_no integer,
  name text,
  article text,
  warranty_days integer,
  price numeric,
  discount numeric default 0,
  quantity numeric default 1
);

alter table public.clients add column if not exists notes text;

alter table public.orders add column if not exists kit text;
alter table public.orders add column if not exists prepayment numeric;
alter table public.orders add column if not exists estimated_ready_at date;
alter table public.orders add column if not exists receiver_notes text;
alter table public.orders add column if not exists recommendations text;
alter table public.orders add column if not exists guarantee_days integer default 30;

create table if not exists public.masters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_percent numeric not null default 40,
  created_at timestamp with time zone default now()
);

alter table public.masters add column if not exists name text;
alter table public.masters add column if not exists default_percent numeric default 40;

alter table public.orders add column if not exists master_id uuid references public.masters (id);
alter table public.orders add column if not exists master_percent numeric;
alter table public.orders add column if not exists cost_price numeric default 0;

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  title text,
  category text,
  sku text,
  article text,
  quantity integer default 0,
  purchase_price numeric,
  selling_price numeric,
  created_at timestamp with time zone default now()
);

alter table public.order_items add column if not exists part_id uuid references public.parts (id);

-- ---------------------------------------------------------------------------
-- Авторизация CRM + публичный статус заказа (QR)
-- 1) В Supabase → Authentication → Users создайте ОДНОГО пользователя (email/пароль).
-- 2) Выполните этот блок в SQL Editor.
-- После этого CRM доступна только после входа; /status/<id> остаётся открытым.
-- ---------------------------------------------------------------------------

create or replace function public.get_order_public_status(p_id uuid)
returns table (
  order_number integer,
  status text,
  device_type text,
  brand_model text,
  created_at timestamp with time zone,
  estimated_ready_at date
)
language sql
security definer
set search_path = public
as $$
  select
    o.order_number,
    o.status,
    o.device_type,
    o.brand_model,
    o.created_at,
    o.estimated_ready_at
  from public.orders o
  where o.id = p_id;
$$;

revoke all on function public.get_order_public_status(uuid) from public;
grant execute on function public.get_order_public_status(uuid) to anon, authenticated;

alter table public.clients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.parts enable row level security;
alter table public.masters enable row level security;

drop policy if exists "crm_clients_all" on public.clients;
create policy "crm_clients_all" on public.clients
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "crm_orders_all" on public.orders;
create policy "crm_orders_all" on public.orders
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "crm_order_items_all" on public.order_items;
create policy "crm_order_items_all" on public.order_items
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "crm_parts_all" on public.parts;
create policy "crm_parts_all" on public.parts
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "crm_masters_all" on public.masters;
create policy "crm_masters_all" on public.masters
  for all to authenticated
  using (true)
  with check (true);
