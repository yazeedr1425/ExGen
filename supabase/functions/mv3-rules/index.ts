// mv3-rules — serves the curated Manifest V3 rulebook to the n8n agents.
//
// Exists so that n8n never needs a Supabase database credential. The mv3_rules
// table is service_role-only (RLS on, no policy), and this function is the one
// door in front of it. verify_jwt is ON; n8n calls it with the public anon key,
// exactly like validate-extension.
//
// Read two ways by design:
//   1. The main flow fetches all `must` rules once and injects them into every
//      agent prompt. That is the deterministic grounding floor — it does not
//      depend on the model choosing to call a tool.
//   2. The agents can additionally call it per topic for the full detail,
//      including `should`/`info` rules, when they want more than the floor.

import { json, preflight, withCors } from "../_shared/cors.ts";
import { adminClient } from "../_shared/db.ts";

const VALID_SEVERITIES = ["must", "should", "info"];

Deno.serve(withCors(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "method not allowed" }, 405);
  }

  let topics: string[] = [];
  let severities: string[] = [];
  let api: string | null = null;

  if (req.method === "GET") {
    const u = new URL(req.url);
    const t = u.searchParams.get("topic") ?? u.searchParams.get("topics");
    if (t) topics = t.split(",").map((s) => s.trim()).filter(Boolean);
    const s = u.searchParams.get("severity");
    if (s) severities = s.split(",").map((x) => x.trim()).filter(Boolean);
    api = u.searchParams.get("api");
  } else {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const t = body.topics ?? body.topic;
    if (Array.isArray(t)) topics = t.map(String);
    else if (typeof t === "string" && t.trim()) {
      topics = t.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const s = body.severity ?? body.severities;
    if (Array.isArray(s)) severities = s.map(String);
    else if (typeof s === "string" && s.trim() && s !== "all") severities = [s.trim()];
    api = typeof body.api === "string" && body.api.trim() ? body.api.trim() : null;
  }

  severities = severities.filter((s) => VALID_SEVERITIES.includes(s));

  const db = adminClient();
  let query = db
    .from("mv3_rules")
    .select("topic, api, rule, example, antipattern, severity");

  if (topics.length) query = query.in("topic", topics);
  if (severities.length) query = query.in("severity", severities);
  if (api) query = query.ilike("api", `%${api}%`);

  const { data, error } = await query;
  if (error) {
    console.error("mv3_rules query failed", error);
    return json({ error: "could not load rulebook" }, 500);
  }

  const rows = data ?? [];

  // Deterministic ordering: must-rules first, then by topic. A model weights the
  // top of a long list more heavily, so the blocking rules go there.
  const rank: Record<string, number> = { must: 0, should: 1, info: 2 };
  rows.sort((a, b) => {
    const d = (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
    return d !== 0 ? d : String(a.topic).localeCompare(String(b.topic));
  });

  const lines: string[] = [];
  for (const r of rows) {
    const tag = r.api ? `${r.topic}/${r.api}` : r.topic;
    lines.push(`[${tag}] ${String(r.severity).toUpperCase()}: ${r.rule}`);
    if (r.example) lines.push(`    DO: ${r.example}`);
    if (r.antipattern) lines.push(`    NOT: ${r.antipattern}`);
  }

  const availableTopics = [...new Set(rows.map((r) => r.topic))].sort();

  return json({
    rule_count: rows.length,
    topics: availableTopics,
    rules_text: lines.length
      ? lines.join("\n")
      : "No rules matched that filter. Valid topics: manifest, service_worker, permissions, csp, content_scripts, messaging, storage, ui, network, web_accessible_resources, i18n, packaging.",
  });
}));
