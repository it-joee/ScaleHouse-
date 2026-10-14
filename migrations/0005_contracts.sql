-- A contract is the paper a sister house signed with a supplier.
-- Received tonnes are computed from later tickets, not stored here.

create table if not exists contracts (
  id text primary key,
  company_id text not null references companies (id),
  supplier_name text not null,
  commodity_id text not null references commodities (id),
  tonnes double precision not null,
  price_per_mt double precision,
  signed_on date not null,
  note text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  constraint contracts_tonnes_chk check (tonnes > 0)
);

create index if not exists contracts_company_idx on contracts (company_id, signed_on desc);

alter table contracts enable row level security;
