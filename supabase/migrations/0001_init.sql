-- ExtGen — initial schema.
--
-- Design rule that explains most of what follows: the client may READ its own
-- rows and may create a project, but it may never write a job, an event, or a
-- generated file. Those writes belong to Edge Functions holding service_role.
-- A client able to set status='ready' could hand itself a build it never paid
-- for, so there is deliberately no insert/update policy on those tables.

-- ─────────────────────────── enums ───────────────────────────
create type job_status as enum (
  'queued','planning','generating','validating','repairing',
  'packaging','ready','failed','canceled'
);
create type plan_tier   as enum ('free','pro','team');
create type target_kind as enum ('popup','content_script','background','devtools','options');

-- ─────────────────────────── users ───────────────────────────
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  avatar_url      text,
  plan            plan_tier   not null default 'free',
  github_username text,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz
);

-- A named extension the user owns. Many jobs against one project = versions.
create table projects (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  slug        text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  description text check (char_length(description) <= 500),
  repo_url    text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner, slug)
);

-- ─────────── one generation run: the unit n8n executes ───────────
create table jobs (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid not null references auth.users(id) on delete cascade,
  project_id        uuid references projects(id) on delete cascade,
  prompt            text not null check (char_length(prompt) between 10 and 2000),
  targets           target_kind[] not null default '{popup}',
  status            job_status not null default 'queued',
  progress_note     text,
  error             text,
  -- what the planner decided, mirrored here so a job list needs no join
  ext_name          text,
  ext_slug          text,
  permissions       text[] not null default '{}',
  host_permissions  text[] not null default '{}',
  -- artifacts
  zip_path          text,
  zip_bytes         int,
  repo_url          text,
  -- observability
  n8n_execution_id  text,
  model             text,
  prompt_tokens     int,
  output_tokens     int,
  repair_attempts   int not null default 0,
  validation_errors jsonb,
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index jobs_owner_created_idx on jobs (owner, created_at desc);
create index jobs_project_idx on jobs (project_id, created_at desc);
-- Lets the stuck-job sweeper find live work without scanning history.
create index jobs_active_idx on jobs (updated_at)
  where status not in ('ready','failed','canceled');

-- Append-only progress feed. This is what the UI streams over Realtime.
create table job_events (
  id         bigint generated always as identity primary key,
  job_id     uuid not null references jobs(id) on delete cascade,
  stage      text not null,
  message    text,
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index job_events_job_idx on job_events (job_id, id);

-- The generated code itself, so the UI can render a file tree and a code
-- viewer without making the user download and unzip anything.
create table generated_files (
  id         bigint generated always as identity primary key,
  job_id     uuid not null references jobs(id) on delete cascade,
  path       text not null check (char_length(path) <= 200),
  content    text not null,
  bytes      int  not null,
  language   text,
  created_at timestamptz not null default now(),
  unique (job_id, path)
);

-- ─────────── the grounding rulebook the agent reads as a tool ───────────
-- Deliberately a table we control rather than live doc-scraping: when the
-- agent gets something wrong, we add a row.
create table mv3_rules (
  id          bigint generated always as identity primary key,
  topic       text not null,
  api         text,
  rule        text not null,
  example     text,
  antipattern text,
  severity    text not null default 'must' check (severity in ('must','should','info')),
  updated_at  timestamptz not null default now()
);
create index mv3_rules_topic_idx on mv3_rules (topic);

-- Every call in and out. Debugging plus abuse detection.
create table api_logs (
  id          bigint generated always as identity primary key,
  fn          text not null,
  user_id     uuid references auth.users(id) on delete set null,
  job_id      uuid references jobs(id) on delete set null,
  status_code int  not null,
  latency_ms  int,
  ip          inet,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index api_logs_created_idx on api_logs (created_at desc);
create index api_logs_user_idx on api_logs (user_id, created_at desc);

-- ─────────────────────────── RLS ───────────────────────────
alter table profiles        enable row level security;
alter table projects        enable row level security;
alter table jobs            enable row level security;
alter table job_events      enable row level security;
alter table generated_files enable row level security;
alter table mv3_rules       enable row level security;
alter table api_logs        enable row level security;

create policy own_profile        on profiles for select using (id = auth.uid());
create policy own_profile_update on profiles for update using (id = auth.uid())
                                                   with check (id = auth.uid());

create policy own_projects    on projects for select using (owner = auth.uid());
create policy create_projects on projects for insert with check (owner = auth.uid());
create policy update_projects on projects for update using (owner = auth.uid())
                                                with check (owner = auth.uid());

create policy own_jobs on jobs for select using (owner = auth.uid());

create policy own_events on job_events for select using (
  exists (select 1 from jobs j where j.id = job_events.job_id and j.owner = auth.uid())
);
create policy own_files on generated_files for select using (
  exists (select 1 from jobs j where j.id = generated_files.job_id and j.owner = auth.uid())
);

-- mv3_rules and api_logs get RLS enabled and NO policy at all, which means
-- service_role only. The browser has no business reading either.

-- ─────────────────────── quota ───────────────────────
create or replace function can_create_job(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $fn$
  select (
    select count(*) from jobs
     where owner = uid and created_at > now() - interval '24 hours'
  ) < case coalesce((select plan from profiles where id = uid), 'free')
        when 'free' then 5
        when 'pro'  then 100
        else 1000
      end;
$fn$;

-- ─────────────────── triggers ───────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end
$fn$;

create trigger jobs_touch     before update on jobs
  for each row execute function touch_updated_at();
create trigger projects_touch before update on projects
  for each row execute function touch_updated_at();

-- Give every new auth user a profile, so quota lookups never miss.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────── realtime ───────────────────
-- replica identity full so UPDATE payloads carry the old row too, letting the
-- UI diff status transitions rather than just seeing the new value.
alter table jobs replica identity full;
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table job_events;

-- ─────────────────── storage ───────────────────
-- Private. The client never touches this bucket: n8n writes through a
-- pre-signed upload URL, the client reads through a signed download URL.
insert into storage.buckets (id, name, public)
values ('builds', 'builds', false)
on conflict (id) do nothing;
