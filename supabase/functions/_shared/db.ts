import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** service_role client — bypasses RLS. Never leaves the Edge Function. */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Resolves the caller from their Authorization header. Returns null if absent
 *  or invalid — callers must treat null as 401. */
export async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data, error } = await anon.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function logEvent(
  db: SupabaseClient,
  jobId: string,
  stage: string,
  message: string,
  payload: Record<string, unknown> | null = null,
) {
  await db.from("job_events").insert({ job_id: jobId, stage, message, payload });
}

/** Fire-and-forget request log. Never allowed to break the response it
 *  describes, so every failure is swallowed. */
export async function logApi(
  db: SupabaseClient,
  entry: {
    fn: string;
    status_code: number;
    user_id?: string | null;
    job_id?: string | null;
    latency_ms?: number | null;
    ip?: string | null;
    detail?: Record<string, unknown> | null;
  },
) {
  try {
    await db.from("api_logs").insert(entry);
  } catch (e) {
    console.error("api_logs insert failed", e);
  }
}

export function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : null;
}
