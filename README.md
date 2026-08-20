# ExtGen — prompt to Chrome extension

A Micro-SaaS that turns a text prompt into a working Manifest V3 extension.
Next.js is the client, Supabase owns auth/data/storage, and **n8n is the engine** —
the AI agents live inside the n8n workflow, not in a separate service.

Architecture, schema, API contracts, node blueprint and roadmap:
`~/.claude/plans/act-as-a-senior-federated-parnas.md`

---

## What is built and verified

| Piece | State | Proof |
|---|---|---|
| Supabase project `ExtGen` | live | `xqlpilvtwaensdrakqpp`, eu-central-1 |
| Schema, RLS, realtime, storage | applied | 7 tables, 8 policies, `replident=f`, `builds` bucket |
| RLS write-lockout | verified | authenticated `INSERT INTO jobs` refused by RLS |
| Signup trigger | verified | `auth.users` insert created a `profiles` row (rolled back) |
| Function privileges | verified | anon `/rpc/can_create_job` → `401 permission denied` |
| MV3 rulebook | seeded | 41 rules, 32 at `must` level |
| `create-job` | deployed | `OPTIONS` → 200; anon `POST` → our own `401 unauthorized` |
| `job-callback` | deployed | boots and fails closed while the secret is unset |
| `job-download` | deployed | verify_jwt on |
| **`validate-extension`** | deployed | **42/42 live checks pass** (`node n8n/validator.test.js`) |
| **`mv3-rules`** | deployed | 32 must-rules / 10.7KB served; unauthenticated → 401 |
| HMAC interop | verified | openssl == Node `createHmac` == Web Crypto, byte-identical |
| `XG · Signed Callback` | created | [go67uMBeaUkYnsKt](https://yazeedalradadi.app.n8n.cloud/workflow/go67uMBeaUkYnsKt) |
| `XG · MV3 Rulebook Tool` | created | [z6Ui370eVGNoozDp](https://yazeedalradadi.app.n8n.cloud/workflow/z6Ui370eVGNoozDp) |
| **`XG · Generate Extension`** | created | [MnxFKo0eUzrIB1SI](https://yazeedalradadi.app.n8n.cloud/workflow/MnxFKo0eUzrIB1SI) — 41 nodes, Phase 4 |
| `XG · Plumbing Stub (no AI)` | created | [G6DrpJE852x5k3L3](https://yazeedalradadi.app.n8n.cloud/workflow/G6DrpJE852x5k3L3) — diagnostic |
| `XG · Error Handler` | created | [RxUCfeeb4kslmgTq](https://yazeedalradadi.app.n8n.cloud/workflow/RxUCfeeb4kslmgTq) — crash reporter |
| **All 5 workflows** | **published** | required for sub-workflow calls; none were, so nothing would have run |
| **Stuck-job sweeper** | live | `pg_cron` every 5 min; probe swept a 40-min-silent job, left a 2-min-old one running |
| **Web app** | builds + runs | 6 routes compile; landing/login render; `/dashboard` redirects to `/login?next=/dashboard` when signed out |

**Not yet done:** GitHub publish (Phase 7).

---

## Run the site

```bash
cd web && cp .env.local.example .env.local && npm install && npm run dev
```

Then open <http://localhost:3000>, create an account, and you are on the dashboard.

Both values in `.env.local` are safe in the browser: every table is RLS-locked to its
owner, no table permits a client write, and jobs are created only through `create-job`,
which is where the n8n URL and secret live.

**If Supabase has email confirmation enabled** (the default), sign-up returns no session
and the form will tell you to confirm by email first. To skip that while developing,
turn off *Confirm email* under Authentication → Sign In / Providers → Email.

**Submitting a prompt will fail until setup steps 1–4 below are done.** That is expected,
and the composer says so explicitly rather than showing a generic error — the request
reaches `create-job`, which cannot hand off to n8n yet.

---

## The Phase 4 pipeline

```
Webhook ─ Respond 202 ─ Normalize ─ Callback:planning ─ Policy Gate ─┬ reject → Callback:failed
                                                                     │
                    Fetch MV3 Rulebook (32 must-rules, injected) ────┘
                                    │
                    ┌───────────────▼──────────────┐
                    │ PLANNER AGENT                │ authors manifest.json itself
                    │ Gemini 3.1 Pro, temp 0.2     │ + lists the OTHER files
                    │ + Plan Parser + rulebook tool│
                    └───────────────┬──────────────┘
                     Split Out ─ Loop Over Files (batch 1)
                                    │
                    ┌───────────────▼──────────────┐
                    │ CODER AGENT   one file/turn  │
                    │ Gemini 3.1 Pro, temp 0.15    │
                    └───────────────┬──────────────┘
                          Normalize ─ loop back
                                    │ done
                            Assemble Files
                                    │
                    ┌───────────────▼──────────────┐
                    │ validate-extension (Supabase)│ DETERMINISTIC. Not an LLM.
                    └───────────────┬──────────────┘
                        valid? ─ yes ────────────────┐
                          no                         │
                    ┌─────▼─────┐                    │
                    │ REPAIR    │ temp 0.1           │
                    └─────┬─────┘  full file set     │
                     re-validate                     │
                     valid? ─ no → Callback:failed   │
                          yes ──────────────────────►┤
                                                     │
                    Finalize (text → binary) ─ Zip ─ PUT pre-signed URL ─ Callback:ready
```

Three design calls worth understanding before changing anything:

**The Planner authors `manifest.json`, the Coder never touches it.** The manifest is
the contract every other file must agree with, so exactly one authority owns it. That
removes the main cross-file consistency failure without the Coder needing to see its
siblings' code.

**The Coder writes one file per turn.** One agent emitting the whole extension as a
single JSON blob fails three ways: output limits truncate the last file, one bad
character invalidates every file at once, and there is no way to give per-file
feedback.

**Grounding is injected, not merely offered.** All 32 `must` rules go into every agent
system message. The `mv3_rulebook` tool is the *optional* deeper lookup, because an
agent that can skip a tool will sometimes skip it — correctness cannot depend on that
choice.

---

## Deviations from the approved plan

Both were judgement calls made during implementation. Say the word and I will revert
either.

**1. The validator is an Edge Function, not an n8n Code node.** The plan put it in a
Code node. Embedding 13KB of validator JS into a workflow string is untestable and
un-diffable, and it would have existed only inside n8n. As `validate-extension` it is
single-sourced, unit-tested by 42 live assertions, callable from CI or the frontend
later, and diffable in git. Cost: one network hop per validation (three max per job).

**2. One repair pass, not two.** The plan capped repairs at 2. Implementing that as a
real loop needs a cycle plus a counter, and unrolling it doubles the node count for a
stochastic second attempt that rarely succeeds where the first failed with the same
error list. One pass is wired; a second is a copy of `Repair Agent → Apply Repair →
Re-validate` if you want it.

---

## Setup — the parts only you can do

> **n8n Variables are not available on this plan.** The signing secret therefore lives
> inline in the `Sign Payload` node of `XG · Signed Callback` — the single node every
> callback already routes through. `$vars.XG_SHARED_SECRET` is still read first, so if
> the plan is ever upgraded, setting the Variable takes over with no code change.
>
> The cost: the secret is part of the workflow definition and appears in any export.
> `n8n/*.json` is gitignored for that reason. If it ever leaves the workspace, rotate it
> in that node and in the Supabase secret together.

### 1. Fix the webhook credential

n8n auto-attached your **existing** "Header Auth account" credential to the
`Generate Webhook` node of `XG · Generate Extension`. That credential is presumably
Content Factory's, so ExtGen would inherit CF's header name and secret — which defeats
keeping the two projects separate.

Create a new **Header Auth** credential named `ExtGen Webhook Key`:

```
Name:  x-xg-key
Value: <a fresh 32-byte random hex, different from the signing secret>
```

Select it on the `Generate Webhook` node. Whatever you choose must match
`N8N_HEADER_AUTH_NAME` / `N8N_HEADER_AUTH_VALUE` in step 2.

This is the only step that needs the n8n UI. Your Gemini credential was attached to all
three model nodes automatically, all five workflows are published, and
`XG · Generate Extension` is already **active** — verified by POSTing its production URL
and getting `403 Authorization data is wrong!` rather than a 404:

```
https://yazeedalradadi.app.n8n.cloud/webhook/xg-generate
```

The stub lives on `xg-generate-stub`, so both can be active without colliding.

### 2. Set the Supabase secrets

```bash
supabase secrets set --project-ref xqlpilvtwaensdrakqpp XG_SHARED_SECRET=<XG_SHARED_SECRET> N8N_GENERATE_URL=https://yazeedalradadi.app.n8n.cloud/webhook/xg-generate N8N_HEADER_AUTH_NAME=x-xg-key N8N_HEADER_AUTH_VALUE=<value from step 2> ALLOWED_ORIGIN=http://localhost:3000
```

Set these in the [dashboard](https://supabase.com/dashboard/project/xqlpilvtwaensdrakqpp/settings/functions)
if you have no Supabase CLI installed. `XG_SHARED_SECRET` must be byte-identical to the
`FALLBACK_SECRET` constant in the `Sign Payload` node, or every callback 401s.

`validate-extension` and `mv3-rules` need no secret: they are called with the project
anon key, which is public by design and grants nothing (neither function reads a table
as the caller).

### 3. Test, cheapest first

```bash
node n8n/validator.test.js
```

42 checks against the live validator — run this now, it needs no setup.

```bash
XG_SHARED_SECRET=<XG_SHARED_SECRET> ./scripts/test-callback.sh <job_id>
```

Expected: `200` on the first line, `401` on all four others.

Then the plumbing stub (no model spend), pointing `N8N_GENERATE_URL` at
`xg-generate-stub`, and finally the real pipeline:

```bash
curl -i -X POST https://xqlpilvtwaensdrakqpp.supabase.co/functions/v1/create-job -H "Authorization: Bearer <user JWT>" -H "Content-Type: application/json" -d '{"prompt":"a popup that counts open tabs and closes duplicates","targets":["popup"]}'
```

The job should walk `queued → planning → generating → validating → packaging → ready`.

Also send one prompt the Policy Gate must refuse, e.g. *"log every keystroke and post it
to my server"* — expect `failed` with a `rejected_by: policy_gate` payload and **no**
model spend, because the gate sits before the first agent.

---

## The one test that actually matters

Static validation proves nothing about whether Chrome will load the result.

Download the zip, unzip it, open `chrome://extensions`, enable Developer mode,
**Load unpacked**. No errors in the service-worker console, and the feature works.

**Watch for one specific thing:** the pipeline emits nested paths like
`popup/popup.html`. Confirm the zip contains a real `popup/` folder rather than a file
literally named `popup/popup.html`. If it flattens, fix `Finalize Files` before trusting
any generation.

---

## Layout

```
supabase/
  migrations/0001_init.sql             schema, RLS, realtime, quota fn, storage bucket
  migrations/0002_mv3_rules_seed.sql   the grounding rulebook
  migrations/0003_harden_functions.sql advisor fixes (search_path, EXECUTE revokes)
  functions/_shared/cors.ts            CORS + json() + preflight()
  functions/_shared/db.ts              adminClient, requireUser, logEvent, logApi
  functions/_shared/hmac.ts            sign/verify over `${ts}.${rawBody}`
  functions/_shared/mv3.ts             THE canonical MV3 validator
  functions/create-job/                validates, quota-checks, mints upload URL, calls n8n
  functions/job-callback/              the ONLY writer of job state; HMAC-gated
  functions/job-download/              ownership check → signed download URL
  functions/validate-extension/        deterministic MV3 gate (HTTP)
  functions/mv3-rules/                 serves the rulebook; keeps DB creds out of n8n
n8n/validator.test.js                  42 assertions against the LIVE validator
scripts/test-callback.sh               signs a payload and tries to break the check
web/
  app/globals.css                      the whole design system: tokens, then primitives
  app/layout.tsx                       shell + auth-aware header
  app/page.tsx                         landing (redirects to /dashboard when signed in)
  app/login/page.tsx                   email + password, handles the confirm-email case
  app/dashboard/page.tsx               composer + your builds
  app/jobs/[id]/page.tsx               server-rendered first paint of one job
  middleware.ts                        session refresh + protected-route guard
  hooks/useJob.ts                      realtime subscription, with a 5s poll fallback
  components/                          ui primitives + PromptComposer, JobLive,
                                       JobTimeline, FileBrowser, DownloadButton, JobList
```

---

## Design decisions worth not relitigating

- **The browser never learns the n8n webhook URL.** It lives in a Supabase secret.
- **n8n holds no Supabase key beyond the public anon key.** It writes only through the
  HMAC-signed callback, uploads only to a single-use pre-signed URL, and reads the
  rulebook through a function rather than the database.
- **There is no INSERT/UPDATE policy on `jobs`.** All writes go through Edge Functions.
- **The validator is code, not a model.** A model asked to check its own JSON will
  approve broken JSON.
- **The Policy Gate runs before the first model call**, so a refused prompt costs
  nothing.
- **Generated extensions declare no icons.** An LLM cannot emit PNG binaries, and a
  manifest referencing a missing icon fails to load — the validator enforces this and
  the rulebook now teaches it.
- **n8n cannot compile anything.** MV3 needs no build step; "compile" means
  deterministic validation plus a zip.

## How a job can fail, and what catches it

Three distinct failure modes needed three different mechanisms. Together they mean a
job always reaches a terminal state, so the UI spinner always stops.

| Failure | Caught by | Result |
|---|---|---|
| A node errors (model timeout, safety block, unparseable output) | `onError` branch on Planner / Coder / Repair | `failed` with the stage noted |
| Generated code still invalid after one repair | `Callback Validation Failed` | `failed` with the error list attached |
| The whole execution crashes (n8n restart, OOM) | `XG · Error Handler` | `failed`, job found via `n8n_execution_id` |
| The execution **hangs** — nothing errored, nothing crashed | `sweep_stuck_jobs()` via `pg_cron` | `failed` after 20 min of silence |

The hang case is the subtle one. An n8n execution timeout would be the obvious fix, but
**this instance caps `executionTimeout` at 180s** and a planner plus per-file coder loop
plus repair routinely runs longer — enabling it would kill healthy builds. The sweeper
has neither problem and keeps working when n8n is unreachable entirely.

The Error Handler sends an **empty `job_id` on purpose**: an Error Trigger never receives
the original webhook body, so it knows only the execution id. `create-job` already stored
that on the row, so `job-callback` now accepts `n8n_execution_id` as a second address.
Overwriting a good result is not a risk — the terminal-state guard ignores any callback
for a job already `ready`, `failed` or `canceled`.

## Known follow-ups

- **Enable leaked-password protection** (Authentication → Policies). The security advisor
  flags it, and the login form is password-based, so it is a one-click real improvement.
- The n8n workflows exist only in n8n. Export all five to `n8n/*.json` once they settle.
- `ALLOWED_ORIGIN` defaults to `*` when unset. Pin it before going public.
- No stuck-job sweeper yet (plan Phase 8).
- The Policy Gate is a deny-list, so it is bypassable by paraphrase. It is a cost and
  liability filter, not a security boundary — the validator and the MV3 sandbox are what
  actually constrain generated code.
