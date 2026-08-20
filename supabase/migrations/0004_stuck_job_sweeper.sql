-- The last hole in the failure story.
--
-- Three failure modes, three mechanisms:
--   1. A node fails          -> its onError branch posts a failed callback.
--   2. The execution crashes -> the n8n Error Workflow posts a failed callback,
--                               resolving the job by n8n_execution_id.
--   3. The execution HANGS   -> neither of the above fires, because nothing
--                               failed. That is what this migration is for.
--
-- The obvious fix for case 3 is an n8n execution timeout. It is not usable here:
-- this instance caps executionTimeout at 180s, and a planner plus a per-file
-- coder loop plus a repair pass routinely runs longer, so enabling it would kill
-- healthy builds. A database-side sweeper has neither problem, and it keeps
-- working even when n8n is unreachable entirely.

create extension if not exists pg_cron;

create or replace function sweep_stuck_jobs(max_idle interval default interval '20 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  swept integer;
begin
  -- updated_at is bumped by the touch trigger on every stage callback, so a
  -- healthy job refreshes it every 30-60s. Twenty minutes of total silence is
  -- not a slow build, it is a dead one.
  with stale as (
    update jobs
       set status = 'failed',
           error = coalesce(
             error,
             'The build stopped reporting progress and was timed out after ' || max_idle::text || ' of silence.'
           ),
           finished_at = now()
     where status not in ('ready', 'failed', 'canceled')
       and updated_at < now() - max_idle
    returning id
  )
  insert into job_events (job_id, stage, message, payload)
  select id, 'failed', 'Timed out: no progress reported', jsonb_build_object('failed_stage', 'sweeper')
    from stale;

  get diagnostics swept = row_count;
  return swept;
end
$fn$;

-- BOTH halves are required. Supabase grants EXECUTE on a new public function to
-- PUBLIC *and* explicitly to anon and authenticated; revoking one leaves the
-- other. Revoking only PUBLIC here was caught by the security advisor.
--
-- Without this, anyone holding the anon key could POST
-- /rest/v1/rpc/sweep_stuck_jobs with max_idle => '0 seconds' and mark every
-- in-flight build on the platform as failed.
revoke execute on function sweep_stuck_jobs(interval) from public, anon, authenticated;

-- Re-assert the earlier ones in case a later grant re-added them.
revoke execute on function can_create_job(uuid)  from public, anon, authenticated;
revoke execute on function handle_new_user()     from public, anon, authenticated;
revoke execute on function touch_updated_at()    from public, anon, authenticated;
grant  execute on function can_create_job(uuid)  to service_role;

select cron.schedule(
  'extgen-sweep-stuck-jobs',
  '*/5 * * * *',
  $cron$ select public.sweep_stuck_jobs() $cron$
);

-- Verified by probe (rolled back): a job silent for 40 minutes mid-pipeline was
-- swept to failed with a timeline event; a job that reported 2 minutes ago was
-- left running; an already-ready job was untouched.
