// create-job — the only way a generation job is ever born.
//
// Why this is an Edge Function and not a direct insert from Next.js:
//   1. It holds N8N_GENERATE_URL and the n8n header-auth secret. The browser
//      must never see either, or anyone could drive the paid pipeline for free.
//   2. It is the single place that decides a job is legitimate before any
//      model call happens downstream.
//   3. It mints the pre-signed Storage upload URL, which is how n8n writes the
//      finished zip without ever holding the service_role key.
//
// It contains ZERO AI logic. No model, no prompt engineering, no LLM key.
// All of that lives in n8n. This function validates, records, and hands off.

import { corsHeaders, json, preflight, withCors } from "../_shared/cors.ts";
import { adminClient, clientIp, logApi, logEvent, requireUser } from "../_shared/db.ts";

const TARGETS = ["popup", "content_script", "background", "devtools", "options"] as const;
type Target = typeof TARGETS[number];

const PROMPT_MIN = 10;
const PROMPT_MAX = 2000;

Deno.serve(withCors(async (req) => {
  const started = Date.now();
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const db = adminClient();
  const ip = clientIp(req);

  const user = await requireUser(req);
  if (!user) {
    await logApi(db, { fn: "create-job", status_code: 401, ip });
    return json({ error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  // ───────────────────────── validation ─────────────────────────
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < PROMPT_MIN || prompt.length > PROMPT_MAX) {
    await logApi(db, { fn: "create-job", status_code: 400, user_id: user.id, ip });
    return json({ error: `prompt must be between ${PROMPT_MIN} and ${PROMPT_MAX} characters` }, 400);
  }

  const rawTargets = Array.isArray(body.targets) && body.targets.length ? body.targets : ["popup"];
  const targets = [...new Set(rawTargets.map(String))] as Target[];
  const bad = targets.filter((t) => !TARGETS.includes(t));
  if (bad.length) {
    return json({ error: `unknown target(s): ${bad.join(", ")}. allowed: ${TARGETS.join(", ")}` }, 400);
  }

  const projectId = body.project_id ? String(body.project_id) : null;
  const options = (body.options ?? {}) as Record<string, unknown>;

  // ───────────────────────── quota ─────────────────────────
  // The app is open to guests, so this is the only thing standing between a
  // stranger and an unbounded Gemini bill. Checked before the row exists so a
  // rate-limited caller does not litter the jobs table.
  const { data: allowed, error: quotaError } = await db.rpc("can_create_job", { uid: user.id });
  if (quotaError) {
    console.error("quota check failed", quotaError);
    return json({ error: "could not verify quota" }, 500);
  }
  if (allowed === false) {
    await logApi(db, { fn: "create-job", status_code: 429, user_id: user.id, ip });
    return json({ error: "daily build limit reached — 5 per day", retry_after: 3600 }, 429, {
      "Retry-After": "3600",
    });
  }

  // ───────────────────────── create the job ─────────────────────────
  const { data: job, error: insertError } = await db
    .from("jobs")
    .insert({
      owner: user.id,
      project_id: projectId,
      prompt,
      targets,
      status: "queued",
      ext_slug: provisionalSlug(prompt),
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !job) {
    console.error("insert failed", insertError);
    return json({ error: "could not create job" }, 500);
  }

  await logEvent(db, job.id, "queued", "Request accepted and job created");

  // ─── pre-signed upload URL: n8n PUTs the finished zip straight here, so it
  //     never needs a Supabase key of any kind. Single-use and path-scoped.
  const uploadPath = `${user.id}/${job.id}/extension.zip`;
  const { data: signed, error: signError } = await db
    .storage
    .from("builds")
    .createSignedUploadUrl(uploadPath);

  if (signError || !signed) {
    await fail(db, job.id, `could not mint upload url: ${signError?.message ?? "unknown"}`);
    return json({ error: "could not prepare storage", job_id: job.id }, 500);
  }

  // supabase-js has returned this as both absolute and root-relative across
  // versions; normalise so n8n always receives something it can PUT to.
  const uploadUrl = signed.signedUrl.startsWith("http")
    ? signed.signedUrl
    : `${Deno.env.get("SUPABASE_URL")}/storage/v1${
      signed.signedUrl.startsWith("/") ? "" : "/"
    }${signed.signedUrl}`;

  // ───────────────────────── hand off to n8n ─────────────────────────
  const webhookUrl = Deno.env.get("N8N_GENERATE_URL");

  if (!webhookUrl) {
    await fail(db, job.id, "n8n webhook is not configured on the server");
    return json({ error: "pipeline not configured", job_id: job.id }, 500);
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: job.id,
        owner_id: user.id,
        prompt,
        targets,
        options,
        ext_slug: provisionalSlug(prompt),
        callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/job-callback`,
        upload_url: uploadUrl,
        upload_path: uploadPath,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      await fail(db, job.id, `n8n rejected the request (${res.status}): ${detail}`);
      await logApi(db, { fn: "create-job", status_code: 502, user_id: user.id, job_id: job.id, ip });
      return json({ error: "pipeline rejected the request", job_id: job.id }, 502);
    }

    // n8n answers immediately with its execution id; it does NOT wait for the
    // agents to finish. That async handoff is the whole reason n8n is here.
    let executionId: string | null = null;
    try {
      executionId = (await res.json())?.executionId ?? null;
    } catch { /* a bare 200 with no body is fine */ }

    if (executionId) {
      await db.from("jobs").update({ n8n_execution_id: String(executionId) }).eq("id", job.id);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await fail(db, job.id, `could not reach n8n: ${msg}`);
    await logApi(db, { fn: "create-job", status_code: 502, user_id: user.id, job_id: job.id, ip });
    return json({ error: "pipeline unreachable", job_id: job.id }, 502);
  }

  await logApi(db, {
    fn: "create-job",
    status_code: 201,
    user_id: user.id,
    job_id: job.id,
    latency_ms: Date.now() - started,
    ip,
  });

  return new Response(JSON.stringify({ job_id: job.id }), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}));

// A job that cannot start must not sit in `queued` forever — the UI needs a
// terminal state or the spinner never stops.
async function fail(db: ReturnType<typeof adminClient>, jobId: string, message: string) {
  console.error(message);
  await db.from("jobs")
    .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
    .eq("id", jobId);
  await logEvent(db, jobId, "failed", message);
}

/** A placeholder slug so the zip has a sensible name even if the planner never
 *  reports one. The planner's choice overwrites this later. */
function provisionalSlug(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
  return slug || "extension";
}
