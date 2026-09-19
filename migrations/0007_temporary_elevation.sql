create table if not exists privilege_elevation_requests (
  id text primary key,
  user_id text not null,
  requested_capabilities jsonb not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'revoked', 'expired')),
  requested_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  approved_until timestamptz,
  revoked_by text,
  revoked_at timestamptz
);

create index if not exists privilege_elevation_pending_idx
  on privilege_elevation_requests (status, requested_at desc);
create index if not exists privilege_elevation_user_idx
  on privilege_elevation_requests (user_id, approved_until desc);
