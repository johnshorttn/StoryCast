create table if not exists story_voice_assignments (
  id text primary key,
  story_id text not null references stories(id) on delete cascade,
  character_id text not null,
  provider text not null,
  voice_id text not null,
  settings jsonb not null default '{}'::jsonb,
  recommended boolean not null default false,
  assignment_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (story_id, character_id)
);

create index if not exists story_voice_assignments_story_idx
  on story_voice_assignments (story_id, character_id);

create table if not exists story_render_jobs (
  id text primary key,
  story_id text not null references stories(id) on delete cascade,
  owner_id text not null,
  job_type text not null check (job_type in ('rewrite', 'beat-audio', 'chapter-build', 'book-build')),
  status text not null check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists story_render_jobs_owner_status_idx
  on story_render_jobs (owner_id, status, created_at desc);

create table if not exists story_beat_renders (
  id text primary key,
  story_id text not null references stories(id) on delete cascade,
  story_revision integer not null,
  chapter_id text not null,
  beat_id text not null,
  character_id text not null,
  voice_assignment_id text references story_voice_assignments(id) on delete set null,
  provider text not null,
  model_version text not null,
  spoken_text text not null,
  text_hash text not null,
  settings_hash text not null,
  pronunciation_hash text not null,
  render_hash text not null,
  master_path text,
  playback_path text,
  mime_type text,
  duration_ms integer,
  status text not null check (status in ('queued', 'rendering', 'ready', 'failed', 'superseded')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (story_id, chapter_id, beat_id, render_hash)
);

create index if not exists story_beat_renders_lookup_idx
  on story_beat_renders (story_id, chapter_id, beat_id, status, created_at desc);

create table if not exists story_chapter_builds (
  id text primary key,
  story_id text not null references stories(id) on delete cascade,
  story_revision integer not null,
  chapter_id text not null,
  render_manifest jsonb not null,
  manifest_hash text not null,
  playback_path text,
  caption_path text,
  mime_type text,
  duration_ms integer,
  status text not null check (status in ('queued', 'building', 'ready', 'failed', 'superseded')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (story_id, chapter_id, manifest_hash)
);

create index if not exists story_chapter_builds_lookup_idx
  on story_chapter_builds (story_id, chapter_id, status, created_at desc);
