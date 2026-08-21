// job-download — hands the caller a short-lived signed URL for their zip.
//
// The `builds` bucket is private and has no storage RLS policy, so this
// function is the only path from a browser to a build artifact. It exists so
// that ownership is checked in one place rather than trusted to a policy
// expression spread across storage internals.

import { json, preflight, withCors } from "../_shared/cors.ts";
import { adminClient, clientIp, logApi, requireUser } from "../_shared/db.ts";

const URL_TTL_SECONDS = 300;

Deno.serve(withCors(async (req) => {
  const started = Date.now();
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const db = adminClient();
  const ip = clientIp(req);

  const user = await requireUser(req);
  if (!user) {
    await logApi(db, { fn: "job-download", status_code: 401, ip });
    return json({ error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const jobId = body.job_id ? String(body.job_id) : "";
  if (!jobId) return json({ error: "job_id is required" }, 400);

  const { data: job, error } = await db
    .from("jobs")
    .select("id, owner, status, zip_path, ext_slug")
    .eq("id", jobId)
    .maybeSingle();

  if (error) return json({ error: "job lookup failed" }, 500);
  if (!job) {
    await logApi(db, { fn: "job-download", status_code: 404, user_id: user.id, ip });
    return json({ error: "job not found" }, 404);
  }

  if (job.status !== "ready" || !job.zip_path) {
    return json({ error: `build is not ready (status: ${job.status})` }, 409);
  }

  const { data: signed, error: signError } = await db
    .storage
    .from("builds")
    .createSignedUrl(job.zip_path, URL_TTL_SECONDS, {
      download: `${job.ext_slug ?? "extension"}.zip`,
    });

  if (signError || !signed) {
    console.error("createSignedUrl failed", signError);
    return json({ error: "could not sign download url" }, 500);
  }

  await logApi(db, {
    fn: "job-download",
    status_code: 200,
    user_id: user.id,
    job_id: jobId,
    latency_ms: Date.now() - started,
    ip,
  });

  return json({ url: signed.signedUrl, expires_in: URL_TTL_SECONDS });
}));
