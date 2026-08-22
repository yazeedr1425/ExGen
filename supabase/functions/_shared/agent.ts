// The extension-building agent, as code.
//
// Replaces the n8n workflow. The shape is the same as before — plan, write,
// validate, repair — with two differences that only code makes possible:
//
//   1. Files are written CONCURRENTLY. n8n's loop was strictly sequential, so
//      six files meant six round trips end to end. Here they overlap, and the
//      stage costs roughly one file instead of all of them.
//   2. Validation is a function call, not an HTTP hop to validate-extension.
//      Same module, same 42 checks, no network in the middle.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { generateJson } from "./gemini.ts";
import { renderReport, validateExtension, type GeneratedFile } from "./mv3.ts";
import { crossCheckDom } from "./crosscheck.ts";

export interface Plan {
  ext_name: string;
  ext_slug: string;
  description: string;
  permissions: string[];
  host_permissions: string[];
  manifest: Record<string, unknown>;
  files: { path: string; purpose: string; apis?: string[] }[];
  /** Every element id the UI uses, agreed once so the file that writes the
   *  markup and the file that queries it cannot invent different names. */
  dom_contract?: { id: string; element: string; purpose: string }[];
}

export interface BuildResult {
  files: GeneratedFile[];
  plan: Plan;
  repaired: boolean;
  validation: { ok: boolean; errors: string[]; warnings: string[] };
}

/** Progress hook so the caller can stream stages into the database. */
export type OnStage = (
  stage: "planning" | "generating" | "validating" | "repairing" | "packaging",
  message: string,
  extra?: Record<string, unknown>,
) => Promise<void>;

const HARD_RULES = `
HARD CONSTRAINTS (violating any of these fails the build):
- Text files only: .json .js .html .css .md. You cannot produce images, fonts or any binary.
- Never declare "icons" or "action.default_icon", and never reference a .png/.jpg/.svg file or a font.
- Draw any visual with CSS or inline SVG markup instead of an image file.
- No inline <script> content and no on*= attributes in HTML. Every page loads a sibling .js file with a relative src and no leading slash.
- No remote scripts, no CDN, no eval, no new Function.
- A service worker has no window, no document and no localStorage. Use chrome.storage, and chrome.alarms rather than setTimeout/setInterval.
- Declare a permission only if the code actually calls the matching chrome API, and call no chrome API whose permission is missing. The two must agree exactly.
- API permissions go in "permissions"; URL match patterns go in "host_permissions". Never mix them.
- Use version "1.0.0".
`.trim();

// Without this the coder produces workable-but-anonymous CSS: raw hex repeated
// everywhere, no dark mode, no focus ring, and blank space where a loading or
// empty state belongs. The rules below are deliberately concrete — "make it
// look good" produces nothing, a required token list produces a design.
const DESIGN_RULES = `
DESIGN (the extension must look considered, not like an unstyled form):
- Exactly one stylesheet. Declare tokens on :root first, then use them. Never repeat a raw hex in a rule.
  Required: --bg --surface --text --text-muted --border --accent --accent-text --danger --ok
            --radius (8-12px) --space-1..--space-4 (4/8/12/16px) --shadow
- Support dark mode: redefine the colour tokens inside @media (prefers-color-scheme: dark). Never ship a
  hardcoded white panel that becomes unreadable there.
- A popup body is 320-380px wide with 16px padding. Never narrower than 300px.
- Set "box-sizing: border-box" on everything, or a bordered button and a borderless one beside it end up
  different heights.
- Type scale: 12px labels, 14px body. The ONE hero figure a popup exists to show — a countdown, a count, a
  total — is 40-56px and heavier than everything around it. Do not render it at body size.
- Earn the hierarchy: primary text uses --text, every secondary line uses --text-muted. If two pieces of
  text at different importance share a colour, the layout has no hierarchy.
- A card is not a card unless it has --surface behind it, a --border, --radius and padding. Never name an
  element a card and leave it transparent.
- Colour carries meaning: --accent is the primary action, --danger is ONLY for destructive or failing
  states, --ok only for success. A Start button is never red.
- Every interactive element defines :hover, :active, :focus-visible and :disabled. focus-visible must show a
  visible outline; never "outline: none" on its own.
- Buttons carry no default browser chrome: 10-12px vertical padding, 600 weight, pointer cursor, and a
  primary action spans the popup width.
- Show state instead of blanks — a loading state before data arrives, an empty state when a list has no
  rows, and a brief confirmation after a destructive action.
- Group related values into cards or rows and space everything from the scale. Nothing touches anything.
- Controls that act on the same thing share a row. Only a lone action spans the full width; two or three
  siblings (Start / Pause / Reset) sit side by side. Their container must itself declare
  "display: flex" with a gap and the buttons "flex: 1" — setting flex on the children while the parent is
  still display:block does nothing and collapses the row.
- Icons are inline SVG. Never reference an image file.
`.trim();

/** The blocking rules, read straight from the table. The mv3-rules function
 *  did this over HTTP; in-process there is no reason to leave the isolate. */
export async function loadRulebook(db: SupabaseClient): Promise<string> {
  const { data, error } = await db
    .from("mv3_rules")
    .select("topic, api, rule, example, antipattern, severity")
    .eq("severity", "must");

  if (error) throw new Error(`could not load the MV3 rulebook: ${error.message}`);

  const rows = data ?? [];
  rows.sort((a, b) => String(a.topic).localeCompare(String(b.topic)));

  const lines: string[] = [];
  for (const r of rows) {
    const tag = r.api ? `${r.topic}/${r.api}` : r.topic;
    lines.push(`[${tag}] MUST: ${r.rule}`);
    if (r.example) lines.push(`    DO: ${r.example}`);
    if (r.antipattern) lines.push(`    NOT: ${r.antipattern}`);
  }
  return lines.join("\n");
}

async function plan(prompt: string, targets: string[], rulebook: string): Promise<Plan> {
  const system = `You are a senior Chrome extension architect. You plan Manifest V3 extensions and you author manifest.json yourself. You do NOT write the other files.

${HARD_RULES}
- manifest.json is your own output. Never list it in files[].
- Use the fewest files that fully deliver the request.
- Any surface with a UI gets its own stylesheet in files[]. Plan for it; a popup with no .css is a failure.

${DESIGN_RULES}

RULEBOOK — every MUST is mandatory:
${rulebook}

You must also fix the DOM contract up front: every element id the scripts will
read or write. Each file is authored in isolation, so an id invented while
writing the markup and an id invented while writing the script will not match
unless you decide both here.

Reply with JSON only, exactly this shape:
{"ext_name":string,"ext_slug":string,"description":string,"permissions":string[],"host_permissions":string[],"manifest":object,"files":[{"path":string,"purpose":string,"apis":string[]}],"dom_contract":[{"id":string,"element":string,"purpose":string}]}`;

  const user = `Plan a Chrome Manifest V3 extension for this request.

REQUEST: ${prompt}
REQUESTED SURFACES: ${targets.join(", ")}

Return manifest.json in full, plus the list of the OTHER files to generate. Give each file a precise purpose and name the chrome APIs it will call.`;

  const p = await generateJson<Plan>(system, user, { temperature: 0.2, maxOutputTokens: 8192 });

  if (!p?.manifest || typeof p.manifest !== "object") {
    throw new Error("The planner returned no manifest object.");
  }
  p.files = (p.files ?? []).filter((f) => f?.path && f.path !== "manifest.json");
  if (!p.files.length) throw new Error("The planner listed no files to write.");

  return p;
}

function contractBlock(p: Plan): string {
  const c = p.dom_contract ?? [];
  if (!c.length) return "";
  const nl = String.fromCharCode(10);
  const rows = c
    .map((d) => "  #" + d.id + "  (" + d.element + ") - " + d.purpose)
    .join(nl);
  return nl + nl +
    "DOM CONTRACT - these ids are fixed. Markup must define exactly these, and " +
    "scripts must look up exactly these. Do not rename, do not invent others:" +
    nl + rows;
}

async function writeFile(
  p: Plan,
  file: Plan["files"][number],
  rulebook: string,
): Promise<GeneratedFile> {
  const system = `You are a senior Chrome extension engineer. You write exactly ONE file of a Manifest V3 extension.

Return that file complete and runnable. No markdown fences, no commentary, no TODOs, no placeholder comments standing in for real logic.

${HARD_RULES}
- Reference sibling files by a path relative to the file you are writing, never with a leading slash.

${DESIGN_RULES}

RULEBOOK — every MUST is mandatory:
${rulebook}

Reply with JSON only: {"path":string,"content":string,"language":string}`;

  const user = `EXTENSION: ${p.ext_name} — ${p.description}

manifest.json is already final. Do not contradict it:
${JSON.stringify(p.manifest, null, 2)}

EVERY FILE IN THIS EXTENSION (for cross-references):
manifest.json, ${p.files.map((f) => f.path).join(", ")}

NOW WRITE THIS ONE FILE AND NOTHING ELSE:
path: ${file.path}
purpose: ${file.purpose}
chrome APIs it should use: ${(file.apis ?? []).join(", ") || "none"}${contractBlock(p)}`;

  const out = await generateJson<GeneratedFile>(system, user, {
    temperature: 0.15,
    maxOutputTokens: 16384,
  });

  // Trust the plan's path over the model's — it is the one the manifest agrees with.
  return {
    path: file.path,
    content: String(out?.content ?? ""),
    language: out?.language ?? guessLanguage(file.path),
  };
}

async function repair(
  files: GeneratedFile[],
  report: string,
  rulebook: string,
): Promise<GeneratedFile[]> {
  const system = `You repair Manifest V3 Chrome extensions that failed a deterministic validator.

Return the COMPLETE file set every time: all files, including untouched ones. Never drop a file. Never rename a file. Never add a feature.
Fix only the listed errors, with the smallest change that removes each one. Warnings are optional.
If an error says a referenced file does not exist, prefer deleting the reference over inventing the file, unless the extension needs it to work.

${HARD_RULES}

RULEBOOK — every MUST is mandatory:
${rulebook}

Reply with JSON only: {"files":[{"path":string,"content":string,"language":string}],"changes":string[]}`;

  const user = `Deterministic validation failed. Fix exactly what the report lists.

VALIDATION REPORT:
${report}

CURRENT FILES:
${JSON.stringify(files)}

Return the COMPLETE corrected file set, including every file you did not change.`;

  const out = await generateJson<{ files: GeneratedFile[] }>(system, user, {
    temperature: 0.1,
    maxOutputTokens: 32768,
  });

  const fixed = (out?.files ?? []).filter((f) => f?.path);
  if (!fixed.length) throw new Error("The repair pass returned no files.");
  return fixed;
}

/** Manifest V3 rules plus the cross-file checks. A build that passes the first
 *  and fails the second loads in Chrome and does nothing, which is worse than
 *  failing outright. */
function check(files: GeneratedFile[]): { ok: boolean; errors: string[]; warnings: string[] } {
  const mv3 = validateExtension(files);
  const dom = crossCheckDom(files);
  const errors = [...mv3.errors, ...dom.errors];
  return { ok: errors.length === 0, errors, warnings: [...mv3.warnings, ...dom.warnings] };
}

function report(files: GeneratedFile[], res: { errors: string[]; warnings: string[] }): string {
  const nl = String.fromCharCode(10);
  const base = renderReport(validateExtension(files));
  const extra = res.errors.filter((e) => !base.includes(e));
  if (!extra.length) return base;
  const lines = extra.map((e) => "- " + e).join(nl);
  return base + nl + nl + "CROSS-FILE ERRORS:" + nl + lines;
}

function guessLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", mjs: "javascript", json: "json",
    html: "html", css: "css", md: "markdown",
  };
  return map[ext] ?? "text";
}

/** Plan, write every file concurrently, validate, repair once if needed. */
export async function buildExtension(
  db: SupabaseClient,
  prompt: string,
  targets: string[],
  onStage: OnStage,
): Promise<BuildResult> {
  const rulebook = await loadRulebook(db);

  await onStage("planning", "Checking the request and planning the extension");
  const p = await plan(prompt, targets, rulebook);

  await onStage("generating", `Writing ${p.files.length} files for ${p.ext_name}`, {
    ext: {
      name: p.ext_name,
      slug: p.ext_slug,
      permissions: p.permissions ?? [],
      host_permissions: p.host_permissions ?? [],
    },
    planned_files: p.files.map((f) => f.path),
  });

  // The whole point of leaving n8n: these overlap instead of queueing.
  const written = await Promise.all(p.files.map((f) => writeFile(p, f, rulebook)));

  let files: GeneratedFile[] = [
    { path: "manifest.json", content: JSON.stringify(p.manifest, null, 2), language: "json" },
    ...written,
  ];

  await onStage("validating", `Checking ${files.length} files against the Manifest V3 rules`);

  let result = check(files);
  let repaired = false;

  if (!result.ok) {
    await onStage("repairing", `Fixing ${result.errors.length} problems`);
    files = await repair(files, report(files, result), rulebook);
    result = check(files);
    repaired = true;
  }

  return { files, plan: p, repaired, validation: result };
}
