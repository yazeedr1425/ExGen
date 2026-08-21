// Cross-file checks that only make sense once every file exists.
//
// mv3.ts validates each file against the Manifest V3 rules. It cannot catch the
// failure mode that actually shipped broken extensions: popup.html defining
// id="tab-count" while popup.js looks up "total-tabs". Every file is written in
// its own model call with no sight of the others, so each invents plausible
// names and nothing compares them. The result passes validation, loads in
// Chrome, and silently does nothing — the lookups return null and the guards
// swallow it.

import type { GeneratedFile } from "./mv3.ts";

export interface CrossCheckResult {
  errors: string[];
  warnings: string[];
}

const HTML_ID = /\bid\s*=\s*["']([A-Za-z0-9_\-:.]+)["']/g;
const JS_ASSIGNED_ID = /\.id\s*=\s*["']([A-Za-z0-9_\-:.]+)["']/g;
const JS_SET_ATTR_ID = /setAttribute\(\s*["']id["']\s*,\s*["']([A-Za-z0-9_\-:.]+)["']\s*\)/g;

const GET_BY_ID = /getElementById\(\s*["']([A-Za-z0-9_\-:.]+)["']\s*\)/g;
const QUERY_ID = /querySelector(?:All)?\(\s*["']#([A-Za-z0-9_\-:.]+)["']\s*\)/g;

function collect(re: RegExp, text: string, into: Set<string>) {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) into.add(m[1]);
}

const isHtml = (p: string) => p.toLowerCase().endsWith(".html");
const isJs = (p: string) => /\.(js|mjs)$/i.test(p);

/** Flags element ids a script looks up that no file ever creates. */
export function crossCheckDom(files: GeneratedFile[]): CrossCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const defined = new Set<string>();
  const referenced = new Map<string, string[]>(); // id -> files referencing it

  for (const f of files) {
    const text = String(f.content ?? "");

    // Ids can be authored in markup or built at runtime; both count as defined,
    // otherwise a content script that injects its own UI trips a false error.
    if (isHtml(f.path)) collect(HTML_ID, text, defined);
    if (isJs(f.path)) {
      collect(HTML_ID, text, defined); // ids inside template literals
      collect(JS_ASSIGNED_ID, text, defined);
      collect(JS_SET_ATTR_ID, text, defined);
    }
  }

  for (const f of files) {
    if (!isJs(f.path)) continue;
    const text = String(f.content ?? "");
    const found = new Set<string>();
    collect(GET_BY_ID, text, found);
    collect(QUERY_ID, text, found);
    for (const id of found) {
      if (!referenced.has(id)) referenced.set(id, []);
      referenced.get(id)!.push(f.path);
    }
  }

  for (const [id, where] of referenced) {
    if (defined.has(id)) continue;
    const near = closest(id, [...defined]);
    errors.push(
      `${where.join(", ")} looks up element id "${id}", which no file defines` +
        (near ? `. The markup defines "${near}" — the two must match exactly.` : "."),
    );
  }

  // Purely informational: unused ids are untidy, never broken.
  for (const id of defined) {
    if (!referenced.has(id)) continue;
  }

  return { errors, warnings };
}

/** Nearest defined id by edit distance, to make the error actionable. */
function closest(target: string, pool: string[]): string | null {
  let best: string | null = null;
  let bestScore = Infinity;
  for (const cand of pool) {
    const d = distance(target, cand);
    if (d < bestScore) {
      bestScore = d;
      best = cand;
    }
  }
  // Only suggest when it is plausibly the same thing renamed.
  return best && bestScore <= Math.max(4, Math.floor(target.length / 2)) ? best : null;
}

function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}
