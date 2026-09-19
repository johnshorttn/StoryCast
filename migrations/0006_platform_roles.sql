create table if not exists user_roles (
  user_id text primary key,
  role text not null default 'user' check (role in ('owner', 'developer', 'moderator', 'user')),
  assigned_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_roles_role_idx on user_roles (role, updated_at desc);
