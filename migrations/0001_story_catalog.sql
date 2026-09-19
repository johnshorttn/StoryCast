create table if not exists stories (
  id text primary key,
  owner_id text not null,
  payload jsonb not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stories_published_idx on stories (published, updated_at desc);

create table if not exists story_revisions (
  story_id text not null,
  revision integer not null,
  owner_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (story_id, revision)
);
