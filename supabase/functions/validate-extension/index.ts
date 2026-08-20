// validate-extension — the deterministic MV3 gate.
//
// Pure function: reads nothing, writes nothing, holds no secret. It is called by
// the n8n main flow after generation, and attached to the Repair agent as a tool
// so the agent can check its own fix before returning it.
//
// verify_jwt is ON. n8n calls it with the project's publishable/anon key, which
// is public by design and grants nothing here — there is no table access in this
// function at all. That keeps the endpoint off the open internet without adding
// another shared secret to manage.

import { json, preflight } from "../_shared/cors.ts";
import { GeneratedFile, renderReport, validateExtension } from "../_shared/mv3.ts";

// A generated extension is a handful of small text files. Anything beyond this
// is a bug or an abuse attempt, not a Chrome extension.
const MAX_FILES = 60;
const MAX_TOTAL_CHARS = 1_000_000;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  // Accept either a real array or a JSON string, because an n8n expression that
  // stringifies once too often is a very easy mistake to make and a confusing
  // one to debug from the far side.
  let raw: unknown = body.files ?? body.files_json;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      return json({
        ok: false,
        errors: [`files was a string but not valid JSON: ${e instanceof Error ? e.message : String(e)}`],
        warnings: [],
        error_count: 1,
        warning_count: 0,
        file_count: 0,
        report: "ERRORS (1):\n- files was a string but not valid JSON",
      });
    }
  }

  if (!Array.isArray(raw)) {
    return json({
      ok: false,
      errors: ["files must be an array of { path, content } objects"],
      warnings: [],
      error_count: 1,
      warning_count: 0,
      file_count: 0,
      report: "ERRORS (1):\n- files must be an array of { path, content } objects",
    });
  }

  if (raw.length > MAX_FILES) {
    return json({ error: `too many files: ${raw.length} (max ${MAX_FILES})` }, 413);
  }
  const totalChars = raw.reduce(
    (n: number, f: GeneratedFile) => n + String(f?.content ?? "").length,
    0,
  );
  if (totalChars > MAX_TOTAL_CHARS) {
    return json({ error: `payload too large: ${totalChars} chars (max ${MAX_TOTAL_CHARS})` }, 413);
  }

  const result = validateExtension(raw as GeneratedFile[]);

  return json({
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
    error_count: result.errors.length,
    warning_count: result.warnings.length,
    file_count: raw.length,
    report: renderReport(result),
  });
});
