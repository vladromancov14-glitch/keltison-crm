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
