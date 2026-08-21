// job-callback — the writer of job state.
//
// This endpoint is public and unauthenticated: it runs with verify_jwt = false
// and performs no origin check, so anyone who knows the URL can write job state
// with the service_role key. That is a deliberate simplification for a demo.
//
// Like every other function here, it contains no AI logic whatsoever.

import { json, preflight, withCors } from "../_shared/cors.ts";
import { adminClient, clientIp, logApi } from "../_shared/db.ts";

// Which n8n stage maps to which job status. `published` deliberately maps to
// null: it decorates an already-finished job with its repo URL and must not
// move the status backwards out of `ready`.
const STAGE_STATUS: Record<string, string | null> = {
  planning: "planning",
  generating: "generating",
  validating: "validating",
  repairing: "repairing",
  packaging: "packaging",
  ready: "ready",
  failed: "failed",
  published: null,
};

const MAX_FILES = 60;
const MAX_FILE_CHARS = 200_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(withCors(async (req) => {
  const started = Date.now();
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const stage = String(body.stage ?? "");
  if (!(stage in STAGE_STATUS)) return json({ error: `unknown stage: ${stage}` }, 400);

  // The uuid test matters: passing a non-uuid to .eq("id", ...) is a Postgres
  // type error, which would surface as a 500 instead of an honest 400.
  const rawJobId = String(body.job_id ?? "").trim();
  const execId = String(body.n8n_execution_id ?? "").trim();
  const byId = UUID_RE.test(rawJobId);

  if (!byId && !execId) {
    return json({ error: "job_id (uuid) or n8n_execution_id is required" }, 400);
  }

  const db = adminClient();
  const ip = clientIp(req);

  const columns = "id, owner, status, repair_attempts";
  const lookup = byId
    ? db.from("jobs").select(columns).eq("id", rawJobId)
    : db
      .from("jobs")
      .select(columns)
      // An execution id is unique in practice, but ordering + limit means a
      // duplicate would resolve to the newest job rather than erroring.
      .eq("n8n_execution_id", execId)
      .order("created_at", { ascending: false })
      .limit(1);

  const { data: job } = await lookup.maybeSingle();
  if (!job) return json({ error: "job not found" }, 404);

  // Everything downstream writes against the resolved id, never the raw input.
  const jobId = String(job.id);

  const status = STAGE_STATUS[stage];
  const message = typeof body.message === "string" ? body.message.slice(0, 500) : null;

  const patch: Record<string, unknown> = { progress_note: message };
  if (status) patch.status = status;
  if (body.n8n_execution_id) patch.n8n_execution_id = String(body.n8n_execution_id);
  if (Number.isFinite(Number(body.repair_attempts))) {
    patch.repair_attempts = Number(body.repair_attempts);
  }

  // The planner's decisions can arrive on any stage, not only on ready.
  if (body.ext && typeof body.ext === "object") {
    const e = body.ext as Record<string, unknown>;
    if (e.name) patch.ext_name = str(e.name, 200);
    if (e.slug) patch.ext_slug = str(e.slug, 60);
    if (Array.isArray(e.permissions)) patch.permissions = e.permissions.slice(0, 40).map(String);
    if (Array.isArray(e.host_permissions)) {
      patch.host_permissions = e.host_permissions.slice(0, 40).map(String);
    }
  }

  if (body.usage && typeof body.usage === "object") {
    const u = body.usage as Record<string, unknown>;
    if (u.model) patch.model = str(u.model, 100);
    if (Number.isFinite(Number(u.prompt_tokens))) patch.prompt_tokens = Number(u.prompt_tokens);
    if (Number.isFinite(Number(u.output_tokens))) patch.output_tokens = Number(u.output_tokens);
  }

  if (Array.isArray(body.validation_errors)) {
    patch.validation_errors = body.validation_errors.slice(0, 100);
  }

  if (stage === "failed") {
    patch.error = String(body.error ?? message ?? "unknown error").slice(0, 2000);
    patch.finished_at = new Date().toISOString();
  }

  if (stage === "ready") {
    if (body.zip_path) patch.zip_path = str(body.zip_path, 500);
    if (Number.isFinite(Number(body.zip_bytes))) patch.zip_bytes = Number(body.zip_bytes);
    patch.finished_at = new Date().toISOString();
  }

  if (stage === "published" && body.payload?.repo_url) {
    patch.repo_url = str(body.payload.repo_url, 500);
  }

  const { error: updateError } = await db.from("jobs").update(patch).eq("id", jobId);
  if (updateError) {
    console.error("status update failed", updateError);
    return json({ error: "could not update job" }, 500);
  }

  await db.from("job_events").insert({
    job_id: jobId,
    stage,
    message,
    payload: body.payload ?? null,
  });

  // ─── the generated code only arrives with the `ready` stage ───
  if (stage === "ready" && Array.isArray(body.files) && body.files.length) {
    const rows = body.files
      .slice(0, MAX_FILES)
      .filter((f: Record<string, unknown>) => f && typeof f.path === "string" && f.path.length)
      .map((f: Record<string, unknown>) => {
        const content = String(f.content ?? "").slice(0, MAX_FILE_CHARS);
        return {
          job_id: jobId,
          path: String(f.path).slice(0, 200),
          content,
          bytes: new TextEncoder().encode(content).length,
          language: f.language ? String(f.language).slice(0, 30) : guessLanguage(String(f.path)),
        };
      });

    if (rows.length) {
      const { error: filesError } = await db
        .from("generated_files")
        .upsert(rows, { onConflict: "job_id,path" });

      if (filesError) {
        console.error("generated_files upsert failed", filesError);
        return json({ error: "could not store generated files" }, 500);
      }
    }
  }

  await logApi(db, {
    fn: "job-callback",
    status_code: 200,
    job_id: jobId,
    latency_ms: Date.now() - started,
    ip,
    detail: { stage },
  });

  return json({ ok: true, stage, status: status ?? job.status });
}));

function str(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  return String(v).slice(0, max);
}

function guessLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript",
    mjs: "javascript",
    ts: "typescript",
    json: "json",
    html: "html",
    css: "css",
    md: "markdown",
    svg: "svg",
  };
  return map[ext] ?? "text";
}
