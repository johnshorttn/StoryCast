create table if not exists billing_ledger (
  id text primary key,
  provider text not null check (provider in ('stripe', 'paddle')),
  provider_event_id text not null,
  provider_transaction_id text not null,
  event_type text not null check (event_type in ('payment', 'refund', 'dispute', 'adjustment')),
  user_id text,
  gift_id text references plan_gifts(id) on delete set null,
  billing_country text,
  currency text not null,
  gross_minor bigint not null default 0,
  refunds_minor bigint not null default 0,
  disputes_minor bigint not null default 0,
  fees_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  net_minor bigint not null,
  occurred_at timestamptz not null,
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists billing_ledger_period_idx on billing_ledger (occurred_at desc, currency, provider);
create index if not exists billing_ledger_transaction_idx on billing_ledger (provider, provider_transaction_id);
