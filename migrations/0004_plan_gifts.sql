create table if not exists plan_gifts (
  id text primary key,
  purchaser_user_id text,
  recipient_email text,
  tier text not null check (tier in ('creator', 'studio')),
  duration_days integer not null check (duration_days between 1 and 730),
  code_hash text not null unique,
  payment_provider text not null,
  payment_reference text not null unique,
  status text not null default 'active' check (status in ('active', 'redeemed', 'expired', 'refunded', 'cancelled')),
  expires_at timestamptz not null,
  redeemed_by text,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists plan_gifts_code_active_idx on plan_gifts (code_hash) where status = 'active';
create index if not exists plan_gifts_purchaser_idx on plan_gifts (purchaser_user_id, created_at desc);
