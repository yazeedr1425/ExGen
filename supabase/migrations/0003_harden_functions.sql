-- Post-DDL hardening, driven by the Supabase security advisor.
--
-- Two real findings, both fixed here:
--
-- 1. touch_updated_at had a mutable search_path. The other two functions pinned
--    it; this one was missed.
--
-- 2. Every function in `public` was callable from a browser. Postgres grants
--    EXECUTE on new functions to PUBLIC, and anon/authenticated inherit it, so
--    anyone with the anon key could POST /rest/v1/rpc/can_create_job with an
--    arbitrary uuid and learn whether that user was over quota.
--
--    NOTE the ordering trap: revoking from `anon, authenticated` alone does
--    nothing, because the PUBLIC grant survives and those roles inherit it.
--    The revoke must target PUBLIC. Verified by calling the endpoint with the
--    anon key before and after: 200 `true` became 401 `permission denied`.
--
--    handle_new_user still fires on signup afterwards, because the auth schema
--    inserts as supabase_auth_admin, not as anon. Verified by inserting into
--    auth.users inside a transaction and confirming a profiles row appeared.

alter function touch_updated_at() set search_path = public;

revoke execute on function can_create_job(uuid)  from public;
revoke execute on function handle_new_user()     from public;
revoke execute on function touch_updated_at()    from public;

-- create-job calls this with the service_role key; nothing else needs it.
grant execute on function can_create_job(uuid) to service_role;

-- Deliberately NOT fixed: the advisor reports rls_enabled_no_policy (INFO) for
-- api_logs and mv3_rules. That is the intended design — RLS on with no policy
-- means service_role only, which is exactly right for a request log and for the
-- agent's rulebook. Adding a policy to silence the notice would weaken both.
