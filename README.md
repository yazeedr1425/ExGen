# ExtGen — prompt to Chrome extension

Turn a plain-English prompt into a working Manifest V3 Chrome extension.
Next.js is the client, Supabase owns auth/data/storage, and **n8n is the engine** —
the AI agents live inside the n8n workflow, not in a separate service.

> **Demo build.** This branch has had its security and error-handling layers
> deliberately removed to keep it simple to read and run. The callback endpoint
> is unauthenticated, tables have no row-level security, and a failing build is
> not retried. See [Security posture](#security-posture) before exposing it.

---

## How it works

```
Browser ──> create-job (Supabase) ──> n8n webhook ──(202)──> agents run
                                                                  │
                                          job-callback <── Signed Callback
                                                │
                                          Postgres ──> realtime ──> UI
```

1. **`create-job`** validates the prompt, creates the job row, mints a one-time
   pre-signed upload URL, and hands off to the n8n webhook.
2. **n8n** plans `manifest.json`, writes each file with a per-file coder agent,
   validates the result deterministically, repairs once if needed, zips it, and
   uploads it to Storage.
3. **`job-callback`** is the writer of job state; every stage update flows back
   through it and streams to the UI over Supabase realtime.
4. **`job-download`** hands the browser a short-lived signed URL for the zip.

### The n8n pipeline

```
Webhook ─ Respond 202 ─ Normalize ─ Callback:planning ─ Fetch MV3 rulebook
   │
   ├─ Planner agent      authors manifest.json + lists the other files
   ├─ Coder agent loop   one file per turn
   ├─ validate-extension deterministic MV3 gate (Supabase Edge Function, not an LLM)
   ├─ Repair agent       one pass, only if validation failed
   └─ Finalize ─ Zip ─ PUT pre-signed URL ─ Callback:ready
```

Three design calls worth understanding:

- **The Planner owns `manifest.json`; the Coder never touches it.** One authority
  owns the contract every other file must agree with.
- **The Coder writes one file per turn.** Emitting the whole extension as a single
  blob truncates the last file and lets one bad character invalidate everything.
- **Validation is code, not a model.** A model asked to check its own JSON will
  approve broken JSON.

---

## Run the web app

```bash
cd web && cp .env.local.example .env.local && npm install && npm run dev
```

Open <http://localhost:3000>, create an account, and you land on the dashboard.
Both values in `.env.local` are the Supabase URL and publishable (anon) key,
which are safe in the browser.

**If Supabase email confirmation is on** (the default), sign-up returns no session
and the form asks you to confirm by email. To skip it while developing, turn off
*Confirm email* under Authentication → Sign In / Providers → Email.

---

## Server configuration

Two Supabase Edge Function secrets drive the handoff (set on the project, not in
`.env`):

```bash
supabase secrets set --project-ref <ref> \
  N8N_GENERATE_URL=<your n8n webhook URL> \
  ALLOWED_ORIGIN=http://localhost:3000
```

- `N8N_GENERATE_URL` — the production webhook URL of the generate workflow.
- `ALLOWED_ORIGIN` — the browser origin allowed by CORS. Pin it before going
  public; it defaults to `*` when unset.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
into Edge Functions automatically. Never set the service_role key anywhere the
browser or n8n can read it.

`validate-extension` and `mv3-rules` need no secret: they are called with the
public anon key and read no table as the caller.

---

## The one test that matters

Static validation proves nothing about whether Chrome will load the result.

Download the zip, unzip it, open `chrome://extensions`, enable Developer mode,
**Load unpacked**, and pick the unzipped folder.

**Watch for one thing:** the pipeline emits nested paths like `popup/popup.html`.
Confirm the zip contains a real `popup/` folder rather than a file literally named
`popup/popup.html`. If it flattens, fix `Finalize Files` in n8n.

---

## Layout

```
supabase/
  migrations/          schema, then the deliberate teardown of RLS + the sweeper
  functions/_shared/   CORS, admin client, the canonical MV3 validator
  functions/create-job/         validates, mints upload URL, calls n8n
  functions/job-callback/       the writer of job state (unauthenticated, demo)
  functions/job-download/       signed download URL
  functions/validate-extension/ deterministic MV3 gate (HTTP)
  functions/mv3-rules/          serves the rulebook; keeps DB creds out of n8n
web/
  app/            landing, login, dashboard, and one job view
  components/     PromptComposer, JobLive, JobTimeline, FileBrowser, JobList, ui
  hooks/useJob.ts realtime subscription with a 5s poll fallback
  middleware.ts   session refresh + protected-route guard
```

The n8n workflows live only in n8n. Export them to `n8n/*.json` once they settle
(and strip any inline secrets first — that path is gitignored for that reason).

---

## Security posture

This build has been simplified for a demo. What was removed, and what it means:

| Removed | Consequence |
|---|---|
| HMAC on `job-callback` | Anyone who knows the URL can write job state |
| Row-level security | The anon key can read and write every table |
| Webhook header auth | Anyone who knows the n8n URL can run the paid pipeline |
| Ownership check on download | Any signed-in user can download any build |
| Quota, policy gate | No per-user limit; prompts reach the model unchecked |
| Agent error branches, sweeper | A failed or hung build is not reported or retried |

To restore any layer, re-apply the corresponding earlier migration and redeploy
the affected function.
