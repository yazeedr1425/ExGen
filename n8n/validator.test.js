// Tests the LIVE validate-extension Edge Function.
//
// Deliberately hits the deployed endpoint rather than a local copy of the logic:
// a local copy would pass forever while the deployed one drifted. Every negative
// case asserts on specific error text, because a validator you have only seen
// return "ok" is not a validator you have tested.
//
//   node n8n/validator.test.js

const BASE = process.env.SUPABASE_URL || "https://xqlpilvtwaensdrakqpp.supabase.co";
const KEY = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbHBpbHZ0d2FlbnNkcmFrcXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU3OTMsImV4cCI6MjEwMjcwMTc5M30.mf19QF9PNiqsEnj-RSYg3s_Z1P-_ylp_fvybErQ-T1k";
const URL_ = `${BASE}/functions/v1/validate-extension`;

let failures = 0;
let checks = 0;

async function validate(files) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  if (!res.ok && res.status !== 200) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function check(label, condition, detail) {
  checks++;
  if (condition) {
    console.log("  PASS  " + label);
  } else {
    failures++;
    console.log("  FAIL  " + label + (detail ? "\n         got: " + detail : ""));
  }
}
const hasErr = (r, s) => r.errors.some((e) => e.includes(s));
const hasWarn = (r, s) => r.warnings.some((e) => e.includes(s));

async function main() {
  // ─────────────── 1. the Phase 3 stub must pass clean ───────────────
  console.log("\n1. valid stub extension (the Phase 3 build)");
  const good = await validate([
    {
      path: "manifest.json",
      content: JSON.stringify({
        manifest_version: 3,
        name: "ExtGen Stub",
        version: "1.0.0",
        description: "Counts open tabs.",
        action: { default_popup: "popup/popup.html", default_title: "ExtGen Stub" },
        permissions: ["tabs"],
      }, null, 2),
    },
    {
      path: "popup/popup.html",
      content: [
        "<!doctype html>",
        '<html lang="en">',
        '<head><meta charset="utf-8"><title>ExtGen Stub</title></head>',
        "<body>",
        '<strong id="count">-</strong>',
        "open tabs",
        '<script src="popup.js"></script>',
        "</body></html>",
      ].join("\n"),
    },
    {
      path: "popup/popup.js",
      content: [
        'document.addEventListener("DOMContentLoaded", async () => {',
        "  const tabs = await chrome.tabs.query({});",
        '  document.getElementById("count").textContent = String(tabs.length);',
        "});",
      ].join("\n"),
    },
  ]);
  check("ok is true", good.ok === true, JSON.stringify(good.errors));
  check("no errors", good.error_count === 0, JSON.stringify(good.errors));
  check("no warnings", good.warning_count === 0, JSON.stringify(good.warnings));
  check("sibling script path resolves relative to popup/", !hasWarn(good, "popup/popup.js is never referenced"));
  check("report says it is valid", /valid Manifest V3/.test(good.report), good.report);

  // ─────────────── 2. manifest problems ───────────────
  console.log("\n2. manifest problems");
  check("missing manifest", hasErr(await validate([{ path: "popup.html", content: "<!doctype html>" }]), "manifest.json is missing"));
  check("unparseable manifest", hasErr(await validate([{ path: "manifest.json", content: "{ oops," }]), "not valid JSON"));
  check("wrapper folder layout", hasErr(await validate([{ path: "my-ext/manifest.json", content: "{}" }]), "manifest.json is missing"));
  check("empty file set", hasErr(await validate([]), "no files were generated"));
  check("path traversal", hasErr(await validate([{ path: "../evil.js", content: "" }]), "illegal file path"));

  // ─────────────── 3. MV2 leftovers ───────────────
  console.log("\n3. MV2 patterns a model is likely to reproduce");
  const mv2 = await validate([
    {
      path: "manifest.json",
      content: JSON.stringify({
        manifest_version: 2,
        name: "Old",
        version: "1.0",
        browser_action: { default_popup: "p.html" },
        background: { scripts: ["bg.js"], persistent: false },
        content_security_policy: "script-src 'self'",
        web_accessible_resources: ["inject.css"],
        permissions: ["storage", "https://api.example.com/*"],
      }),
    },
    { path: "p.html", content: "<!doctype html>" },
    { path: "bg.js", content: "chrome.browserAction.onClicked.addListener(() => {});" },
  ]);
  check("manifest_version 2", hasErr(mv2, "manifest_version must be the integer 3"));
  check("browser_action", hasErr(mv2, "browser_action was removed"));
  check("background.scripts", hasErr(mv2, "background.scripts was removed"));
  check("background.persistent", hasErr(mv2, "background.persistent does not exist"));
  check("CSP as a string", hasErr(mv2, "content_security_policy must be an object"));
  check("bare-string web_accessible_resources", hasErr(mv2, "must be objects with resources and matches"));
  check("match pattern in permissions", hasErr(mv2, "belongs in host_permissions"));
  check("chrome.browserAction in code", hasErr(mv2, "chrome.browserAction and chrome.pageAction were removed"));

  // ─────────────── 4. CSP violations ───────────────
  console.log("\n4. CSP violations");
  const csp = await validate([
    {
      path: "manifest.json",
      content: JSON.stringify({
        manifest_version: 3, name: "CSP", version: "1.0.0",
        action: { default_popup: "popup.html" },
      }),
    },
    {
      path: "popup.html",
      content: [
        "<!doctype html>",
        '<button onclick="run()">go</button>',
        "<script>document.title = 1;</script>",
        '<script src="https://cdn.jsdelivr.net/npm/lib.js"></script>',
        '<script src="missing.js"></script>',
      ].join("\n"),
    },
  ]);
  check("inline handler attribute", hasErr(csp, "inline event handler attribute"));
  check("inline script body", hasErr(csp, "inline script content is blocked"));
  check("remote script", hasErr(csp, "loads a remote resource"));
  check("dangling local script ref", hasErr(csp, "references script missing.js"));

  // ─────────────── 5. service worker constraints ───────────────
  console.log("\n5. service worker constraints");
  const sw = await validate([
    {
      path: "manifest.json",
      content: JSON.stringify({
        manifest_version: 3, name: "SW", version: "1.0.0",
        background: { service_worker: "background.js" },
        permissions: ["storage"],
      }),
    },
    {
      path: "background.js",
      content: [
        'import { helper } from "./lib.js";',
        "localStorage.setItem('k', '1');",
        "document.querySelector('body');",
        "window.setTimeout(() => {}, 100);",
        "setInterval(() => {}, 1000);",
        "chrome.storage.local.set({ a: 1 });",
        "eval('1+1');",
      ].join("\n"),
    },
    { path: "lib.js", content: "export const helper = 1;" },
  ]);
  check("localStorage in SW", hasErr(sw, "localStorage does not exist"));
  check("document in SW", hasErr(sw, "there is no DOM in a service worker"));
  check("window in SW", hasErr(sw, "there is no window"));
  check("ESM without type module", hasErr(sw, "needs type module on background"));
  check("eval", hasErr(sw, "eval() is blocked"));
  check("setInterval in SW warns", hasWarn(sw, "do not survive worker termination"));

  // ─────────────── 6. refs and permission coverage ───────────────
  console.log("\n6. dangling references and permission coverage");
  const refs = await validate([
    {
      path: "manifest.json",
      content: JSON.stringify({
        manifest_version: 3, name: "Refs", version: "1.0.0",
        action: { default_popup: "popup.html" },
        icons: { 128: "icons/128.png" },
        content_scripts: [{ js: ["content.js"] }],
        permissions: ["storage", "bookmarks"],
      }),
    },
    { path: "popup.html", content: '<!doctype html><script src="popup.js"></script>' },
    { path: "popup.js", content: "chrome.alarms.create('x', {});" },
    { path: "content.js", content: "chrome.runtime.sendMessage({});" },
  ]);
  check("missing icon png (agents cannot emit binaries)", hasErr(refs, "icons.128 references icons/128.png"));
  check("content_scripts without matches", hasErr(refs, "content_scripts[0] has no matches array"));
  check("undeclared chrome.alarms", hasErr(refs, "code calls chrome.alarms but alarms is not declared"));
  check("unused bookmarks permission warns", hasWarn(refs, "declares the bookmarks permission"));

  // ─────────────── 7. async onMessage trap ───────────────
  console.log("\n7. the async onMessage trap");
  const msg = await validate([
    {
      path: "manifest.json",
      content: JSON.stringify({
        manifest_version: 3, name: "Msg", version: "1.0.0",
        background: { service_worker: "sw.js" },
      }),
    },
    { path: "sw.js", content: "chrome.runtime.onMessage.addListener(async (m, s, r) => { r(1); });" },
  ]);
  check("async onMessage listener", hasErr(msg, "closes the message port"));

  // ─────────────── 8. version strings ───────────────
  console.log("\n8. version string forms");
  const vcase = (v) => validate([{ path: "manifest.json", content: JSON.stringify({ manifest_version: 3, name: "V", version: v }) }]);
  check("1.0.0 accepted", !hasErr(await vcase("1.0.0"), "manifest.version must be"));
  check("1 accepted", !hasErr(await vcase("1"), "manifest.version must be"));
  check("1.0.0.1 accepted", !hasErr(await vcase("1.0.0.1"), "manifest.version must be"));
  check("1.0.0-beta rejected", hasErr(await vcase("1.0.0-beta"), "manifest.version must be"));
  check("v1.0 rejected", hasErr(await vcase("v1.0"), "manifest.version must be"));
  check("1.0.0.0.0 rejected", hasErr(await vcase("1.0.0.0.0"), "manifest.version must be"));

  // ─────────────── 9. transport quirks ───────────────
  console.log("\n9. transport quirks the n8n side can produce");
  const res9 = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ files: JSON.stringify([{ path: "manifest.json", content: "{}" }]) }),
  });
  const doubleEncoded = await res9.json();
  check("double-stringified files is still parsed", doubleEncoded.file_count === 1, JSON.stringify(doubleEncoded).slice(0, 160));

  const res10 = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ files: { not: "an array" } }),
  });
  const notArray = await res10.json();
  check("non-array files rejected", notArray.ok === false && hasErr(notArray, "must be an array"));

  const res11 = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  check("unauthenticated request rejected", res11.status === 401, "HTTP " + res11.status);

  console.log(`\n${checks} checks, ${failures} failed`);
  console.log(failures === 0 ? "ALL CHECKS PASSED against the live endpoint" : "FAILURES PRESENT");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("harness error: " + e.message);
  process.exit(2);
});
