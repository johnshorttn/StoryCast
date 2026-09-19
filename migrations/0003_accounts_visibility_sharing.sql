alter table stories add column if not exists visibility text;
update stories set visibility = case when published then 'public' else 'private' end where visibility is null;
alter table stories alter column visibility set default 'private';
alter table stories alter column visibility set not null;
alter table stories drop constraint if exists stories_visibility_check;
alter table stories add constraint stories_visibility_check check (visibility in ('private', 'unlisted', 'public'));

create index if not exists stories_owner_updated_idx on stories (owner_id, updated_at desc);
create index if not exists stories_visibility_updated_idx on stories (visibility, updated_at desc);

create table if not exists user_tiers (
  user_id text primary key,
  tier text not null default 'free' check (tier in ('free', 'creator', 'studio')),
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists story_shares (
  id text primary key,
  story_id text not null references stories(id) on delete cascade,
  owner_id text not null,
  token_hash text not null unique,
  label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create index if not exists story_shares_owner_idx on story_shares (owner_id, story_id, created_at desc);
create index if not exists story_shares_token_idx on story_shares (token_hash) where revoked_at is null;
