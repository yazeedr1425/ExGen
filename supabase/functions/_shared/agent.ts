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

// The coder writes the whole extension in one call, so it can design freely and
// stay internally consistent. What stays mandatory here is only the floor a
// user would notice as broken — contrast, focus, dark mode, hit targets. The
// look itself is the model's to choose; prescribing exact tokens and pixel
// sizes made every extension come out identical.
const DESIGN_RULES = `
DESIGN — you are the designer. Choose a visual direction that suits THIS extension
and commit to it. A tab manager and a pomodoro timer should not look like the same
template.

Decide for yourself: the palette, the type treatment, density, whether the surface
is flat or layered, how the hero element is framed. Give the extension a point of
view rather than a default one.

What is not optional, because a user notices these as broken:
- Declare your colours as :root tokens and use them; never repeat a raw hex in rules.
- Redefine those tokens under @media (prefers-color-scheme: dark). Both themes must
  be legible — no white panel that stays white in dark mode.
- Text contrast at least 4.5:1 against its own background, in both themes.
- Hierarchy must be visible: the thing the popup exists to show dominates, secondary
  text recedes. If two levels share a size and a colour, there is no hierarchy.
- box-sizing: border-box everywhere, or bordered and borderless controls beside each
  other end up different heights.
- Every interactive element defines :hover, :active, :focus-visible and :disabled.
  focus-visible shows a real outline; never "outline: none" alone.
- Hit targets at least 32px tall. Popup body 320-400px wide.
- Colour carries meaning: the primary action is not the danger colour.
- Controls acting on the same thing share a row — their container declares
  display:flex with a gap, and the buttons flex:1. Setting flex on children while
  the parent is display:block collapses the row.
- Show state instead of blanks: something to look at while data loads, an empty
  state when a list has no rows, feedback after a destructive action.
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

Reply with JSON only, exactly this shape:
{"ext_name":string,"ext_slug":string,"description":string,"permissions":string[],"host_permissions":string[],"manifest":object,"files":[{"path":string,"purpose":string,"apis":string[]}],}`;

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


/** Writes every file in ONE call.
 *
 *  This is the fix for the whole family of bugs that kept shipping: an id, a
 *  message type, a storage key or a unit agreed in one file and contradicted in
 *  another. Each file used to be written in its own call, blind to the rest, so
 *  every one of them invented plausible names and nothing reconciled them.
 *  Contracts in the plan patched around it; writing them together removes the
 *  seam instead.
 *
 *  The original reason for splitting was output truncation. That is now handled
 *  head-on: MAX_TOKENS surfaces as a retryable error from the client, and a
 *  short file set costs far less than the 32k ceiling. */
async function writeAllFiles(p: Plan, rulebook: string): Promise<GeneratedFile[]> {
  const system = `You are a senior Chrome extension engineer AND its designer. You write the COMPLETE file set for one Manifest V3 extension in a single response.

Because you write every file at once, they must agree with each other exactly:
- an id in the markup is the id the script looks up
- a message string a sender uses is the string its listener compares against, character for character
- a chrome.storage key one file writes is the key another reads, storing the SAME unit
- a file a page references is a file you actually return

Every file complete and runnable. No markdown fences, no commentary, no TODOs, no placeholder standing in for real logic.

${HARD_RULES}
- Reference sibling files by a path relative to the file that references them, never with a leading slash.

${DESIGN_RULES}

RULEBOOK — every MUST is mandatory:
${rulebook}

Reply with JSON only: {"files":[{"path":string,"content":string,"language":string}]}`;

  const user = `EXTENSION: ${p.ext_name} — ${p.description}

manifest.json is already final. Every file must agree with it:
${JSON.stringify(p.manifest, null, 2)}

WRITE ALL OF THESE FILES, and nothing else:
${p.files.map((f) => `- ${f.path} — ${f.purpose}${(f.apis ?? []).length ? ` (uses ${(f.apis ?? []).join(", ")})` : ""}`).join("\n")}

Design the interface as you see fit for this extension. Return every file in one JSON array.`;

  const out = await generateJson<{ files: GeneratedFile[] }>(system, user, {
    temperature: 0.3,
    maxOutputTokens: 32768,
  });

  const returned = (out?.files ?? []).filter((f) => f?.path && f.path !== "manifest.json");
  if (!returned.length) throw new Error("The coder returned no files.");

  // Keep the plan's paths authoritative — the manifest was written against them.
  const byPath = new Map(returned.map((f) => [String(f.path), f]));
  const missing: string[] = [];
  const files = p.files.map((planned) => {
    const got = byPath.get(planned.path) ??
      // tolerate a leading "./" or a differing directory depth
      returned.find((f) => String(f.path).replace(/^\.\//, "").endsWith(planned.path.split("/").pop()!));
    if (!got || !String(got.content ?? "").trim()) missing.push(planned.path);
    return {
      path: planned.path,
      content: String(got?.content ?? ""),
      language: got?.language ?? guessLanguage(planned.path),
    };
  });

  if (missing.length) {
    throw new Error(`The coder skipped ${missing.join(", ")}. Truncated or incomplete response.`);
  }
  return files;
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

  // One call, every file in view of every other. Slower than fanning out, and
  // worth it: the parallel version could not see what it was contradicting.
  const written = await writeAllFiles(p, rulebook);

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
