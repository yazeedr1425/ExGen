-- Demo simplification: removes every access control and the stuck-job sweeper.
--
-- This is a deliberate, requested rollback of the security model. After this
-- migration the anon key can read and write every row in every table, and a
-- hung n8n execution will leave its job spinning forever with no timeout.
--
-- To restore any of it, re-apply 0001 (policies), 0003 (function privileges)
-- and 0004 (sweeper); nothing here drops a table or a column, so the data model
-- is unchanged and the earlier migrations remain valid as written.

-- ─────────────── 1. drop every RLS policy ───────────────
drop policy if exists own_files          on generated_files;
drop policy if exists own_events         on job_events;
drop policy if exists own_jobs           on jobs;
drop policy if exists own_profile        on profiles;
drop policy if exists own_profile_update on profiles;
drop policy if exists create_projects    on projects;
drop policy if exists own_projects       on projects;
drop policy if exists update_projects    on projects;

-- ─────────────── 2. turn RLS off entirely ───────────────
alter table api_logs        disable row level security;
alter table generated_files disable row level security;
alter table job_events      disable row level security;
alter table jobs            disable row level security;
alter table mv3_rules       disable row level security;
alter table profiles        disable row level security;
alter table projects        disable row level security;

-- ─────────────── 3. remove the stuck-job sweeper ───────────────
-- unschedule is not idempotent: it errors when the job is absent, so guard it.
do $$
begin
  perform cron.unschedule('extgen-sweep-stuck-jobs');
exception
  when others then null;
end
$$;

drop function if exists sweep_stuck_jobs(interval);

-- ─────────────── 4. undo the function privilege revokes from 0003/0004 ───────────────
grant execute on function can_create_job(uuid) to public, anon, authenticated;
