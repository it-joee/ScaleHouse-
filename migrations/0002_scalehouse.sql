-- JNI Scalehouse: shared yard for sister companies.
-- Rows are organization data. Admission is the staff table, not per-user ownership.

create table if not exists companies (
  id text primary key,
  name text not null unique,
  code text not null unique,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists commodities (
  id text primary key,
  name text not null unique,
  moisture_max double precision not null
);

create table if not exists hubs (
  id text primary key,
  name text not null unique,
  region text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists market_prices (
  id text primary key,
  commodity_id text not null references commodities (id),
  hub_id text not null references hubs (id),
  price_per_mt double precision not null,
  currency text not null default 'GHS',
  quoted_on date not null,
  note text not null default '',
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  unique (commodity_id, hub_id, quoted_on)
);

create table if not exists deliveries (
  id text primary key,
  company_id text not null references companies (id),
  logged_on date,
  waybill text not null default '',
  truck_number text not null default '',
  truck_norm text not null default '',
  commodity_id text not null references commodities (id),
  declared_mt double precision,
  sgs_mt double precision,
  contract_qty_mt double precision,
  contract_bal_mt double precision,
  gross_kg double precision,
  tare_kg double precision,
  moisture_pct double precision,
  broken_seal boolean not null default false,
  damaged_bags integer not null default 0,
  qc_note text not null default '',
  driver_name text not null default '',
  driver_contact text not null default '',
  origin text not null default '',
  supplier_name text not null default '',
  supplier_contact text not null default '',
  warehouse text not null default '',
  delivered_on date,
  status text not null default 'pending',
  offloaded_on date,
  comment text not null default '',
  officer text not null default '',
  purchase_price_mt double precision,
  market_hub_id text references hubs (id),
  photo_url text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  modified_by text not null default '',
  modified_at timestamptz not null default now(),
  constraint deliveries_status_chk check (
    status in (
      'pending', 'weighing', 'inspection', 'hold',
      'cleared', 'offloading', 'offloaded', 'exited'
    )
  )
);

create index if not exists deliveries_company_idx on deliveries (company_id);
create index if not exists deliveries_status_idx on deliveries (status);
create index if not exists deliveries_truck_idx on deliveries (truck_norm);
create index if not exists deliveries_logged_idx on deliveries (logged_on desc);

create table if not exists audit_events (
  id text primary key,
  delivery_id text not null references deliveries (id) on delete cascade,
  at timestamptz not null default now(),
  actor_user_id text not null,
  actor_name text not null default '',
  action text not null,
  detail text not null default ''
);

create index if not exists audit_delivery_idx on audit_events (delivery_id, at desc);

create table if not exists staff (
  user_id text primary key,
  display_name text not null default '',
  email text not null default '',
  role text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint staff_role_chk check (
    role in ('pending', 'floor', 'procurement', 'executive', 'admin')
  )
);

insert into commodities (id, name, moisture_max) values
  ('shea', 'Shea Nuts', 8),
  ('maize', 'Maize', 13.5),
  ('soybeans', 'Soybeans', 13),
  ('sorghum', 'Sorghum', 13),
  ('millet', 'Millet', 13)
on conflict (id) do nothing;

insert into hubs (id, name, region) values
  ('tamale', 'Tamale', 'Northern'),
  ('techiman', 'Techiman', 'Bono East'),
  ('kumasi', 'Kumasi', 'Ashanti'),
  ('bawku', 'Bawku', 'Upper East'),
  ('kintampo', 'Kintampo', 'Bono East'),
  ('wa', 'Wa', 'Upper West'),
  ('bolgatanga', 'Bolgatanga', 'Upper East'),
  ('hamile', 'Hamile', 'Upper West border'),
  ('tumu', 'Tumu', 'Upper West'),
  ('lome', 'Lomé', 'Togo'),
  ('cotonou', 'Cotonou', 'Benin'),
  ('ouagadougou', 'Ouagadougou', 'Burkina Faso'),
  ('nigeria', 'Nigeria', 'Nigeria')
on conflict (id) do nothing;

alter table companies enable row level security;
alter table commodities enable row level security;
alter table hubs enable row level security;
alter table market_prices enable row level security;
alter table deliveries enable row level security;
alter table audit_events enable row level security;
alter table staff enable row level security;
