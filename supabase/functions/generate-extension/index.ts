// generate-extension — the build engine, in-process.
//
// This is what n8n used to do. It responds immediately and keeps working via
// EdgeRuntime.waitUntil, so the browser is not held open for the length of a
// build. Progress is written straight to Postgres with the service_role client:
// no HMAC, no callback URL, no round trip through job-callback.
//
// Limits that shape this file (Supabase hosted): 150s wall clock on the free
// plan, 400s on paid, and 2s of CPU. The work here is almost entirely waiting
// on Gemini, which does not count against CPU.

import { BlobWriter, TextReader, ZipWriter } from "jsr:@zip-js/zip-js@2.7.62";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json, preflight, withCors } from "../_shared/cors.ts";
import { adminClient } from "../_shared/db.ts";
import { buildExtension } from "../_shared/agent.ts";
import type { GeneratedFile } from "../_shared/mv3.ts";

const STAGE_STATUS: Record<string, string> = {
  planning: "planning",
  generating: "generating",
  validating: "validating",
  repairing: "repairing",
  packaging: "packaging",
};

async function setStage(
  db: SupabaseClient,
  jobId: string,
  stage: string,
  message: string,
  patch: Record<string, unknown> = {},
  payload: Record<string, unknown> | null = null,
) {
  await db.from("jobs").update({
    status: STAGE_STATUS[stage] ?? stage,
    progress_note: message,
    ...patch,
  }).eq("id", jobId);

  await db.from("job_events").insert({ job_id: jobId, stage, message, payload });
}

async function fail(db: SupabaseClient, jobId: string, message: string, errors: string[] = []) {
  await db.from("jobs").update({
    status: "failed",
    error: message.slice(0, 2000),
    validation_errors: errors.length ? errors.slice(0, 100) : null,
    finished_at: new Date().toISOString(),
  }).eq("id", jobId);

  await db.from("job_events").insert({
    job_id: jobId,
    stage: "failed",
    message: message.slice(0, 500),
    payload: errors.length ? { validation_errors: errors } : null,
  });
}

async function zip(files: GeneratedFile[], slug: string): Promise<Blob> {
  const out = new BlobWriter("application/zip");
  const writer = new ZipWriter(out);
  for (const f of files) {
    // Nested paths like popup/popup.html become real folders in the archive.
    await writer.add(f.path, new TextReader(String(f.content ?? "")));
  }
  await writer.close();
  return await out.getData();
}

async function run(jobId: string) {
  const db = adminClient();

  try {
    const { data: job } = await db
      .from("jobs")
      .select("id, owner, prompt, targets, status")
      .eq("id", jobId)
      .maybeSingle();

    if (!job) {
      console.error(`generate-extension: job ${jobId} not found`);
      return;
    }

    const built = await buildExtension(
      db,
      job.prompt,
      Array.isArray(job.targets) && job.targets.length ? job.targets : ["popup"],
      (stage, message, extra) =>
        setStage(db, jobId, stage, message, extra?.ext
          ? {
            ext_name: (extra.ext as Record<string, string>).name,
            ext_slug: (extra.ext as Record<string, string>).slug,
            permissions: (extra.ext as Record<string, string[]>).permissions ?? [],
            host_permissions: (extra.ext as Record<string, string[]>).host_permissions ?? [],
          }
          : {}, extra ?? null),
    );

    if (!built.validation.ok) {
      await fail(
        db,
        jobId,
        `Generated code still failed validation after one repair pass (${built.validation.errors.length} errors)`,
        built.validation.errors,
      );
      return;
    }

    // ── package ──
    const slug = built.plan.ext_slug || "extension";
    await setStage(db, jobId, "packaging", "Zipping the extension and uploading it");

    const blob = await zip(built.files, slug);
    const path = `${job.owner}/${jobId}/extension.zip`;

    const { error: uploadError } = await db.storage
      .from("builds")
      .upload(path, blob, { contentType: "application/zip", upsert: true });

    if (uploadError) {
      await fail(db, jobId, `could not upload the build: ${uploadError.message}`);
      return;
    }

    // ── store the source so the file browser has something to show ──
    const rows = built.files.slice(0, 60).map((f) => {
      const content = String(f.content ?? "").slice(0, 200_000);
      return {
        job_id: jobId,
        path: f.path.slice(0, 200),
        content,
        bytes: new TextEncoder().encode(content).length,
        language: f.language ?? "text",
      };
    });
    await db.from("generated_files").upsert(rows, { onConflict: "job_id,path" });

    const totalBytes = rows.reduce((n, r) => n + r.bytes, 0);

    await db.from("jobs").update({
      status: "ready",
      progress_note: null,
      zip_path: path,
      zip_bytes: blob.size,
      repair_attempts: built.repaired ? 1 : 0,
      model: Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-pro-preview",
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);

    await db.from("job_events").insert({
      job_id: jobId,
      stage: "ready",
      message: `Built ${rows.length} files, ${totalBytes} bytes`,
      payload: { zip_path: path, zip_bytes: blob.size, repair_attempts: built.repaired ? 1 : 0 },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generate-extension failed", msg);
    await fail(db, jobId, msg);
  }
}

// If the isolate is torn down mid-build the job would sit "generating" forever;
// at least say so in the log.
addEventListener("beforeunload", (ev) => {
  console.warn("generate-extension shutting down:", (ev as unknown as { detail?: { reason?: string } }).detail?.reason);
});

Deno.serve(withCors(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { job_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const jobId = String(body.job_id ?? "").trim();
  if (!jobId) return json({ error: "job_id is required" }, 400);

  // Respond now, build after. The caller is create-job, which must not wait.
  EdgeRuntime.waitUntil(run(jobId));

  return json({ accepted: true, job_id: jobId }, 202);
}));
