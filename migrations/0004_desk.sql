-- Exception clears and company movements.
-- Exceptions themselves are computed from the log. A clear dismisses one
-- fingerprint; if the truck changes, the same problem opens again.

create table if not exists exception_clears (
  id text primary key,
  delivery_id text not null references deliveries (id) on delete cascade,
  kind text not null,
  fingerprint text not null,
  note text not null default '',
  cleared_by text not null default '',
  cleared_user_id text not null default '',
  cleared_at timestamptz not null default now(),
  constraint exception_kind_chk check (
    kind in (
      'sgs_missing', 'weight_gap', 'moisture', 'broken_seal',
      'shared_plate', 'shared_waybill', 'above_desk'
    )
  ),
  unique (delivery_id, kind, fingerprint)
);

create index if not exists exception_clears_delivery_idx on exception_clears (delivery_id);

create table if not exists movements (
  id text primary key,
  from_company_id text not null references companies (id),
  to_company_id text not null references companies (id),
  commodity_id text not null references commodities (id),
  tonnes double precision not null,
  logged_on date not null,
  delivery_id text references deliveries (id) on delete set null,
  note text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  constraint movements_direction_chk check (from_company_id <> to_company_id),
  constraint movements_tonnes_chk check (tonnes > 0)
);

create index if not exists movements_from_idx on movements (from_company_id, logged_on desc);
create index if not exists movements_to_idx on movements (to_company_id, logged_on desc);

alter table exception_clears enable row level security;
alter table movements enable row level security;
