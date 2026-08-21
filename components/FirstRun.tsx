/** Shown on the dashboard only while the account has no builds yet.
 *  It sits under the composer rather than on its own route, so a new user can
 *  read what is about to happen and still start typing without navigating. */
export function FirstRun() {
  return (
    <section className="firstrun">
      <div className="firstrun-head">
        <span className="eyebrow">Welcome</span>
        <h2 className="firstrun-title">Your first extension, start to installed.</h2>
        <p className="firstrun-sub">
          Describe it above in a sentence or two. A build usually takes a minute or two, and you
          can watch every stage as it happens.
        </p>
      </div>

      <ol className="firstrun-steps">
        {[
          {
            n: '01',
            title: 'You describe it',
            body: 'Plain English. Say what it should do and where it lives — a popup, a script on the page, or both.',
          },
          {
            n: '02',
            title: 'A planner writes the manifest',
            body: 'It authors manifest.json and lists every file the extension needs, so nothing contradicts anything else.',
          },
          {
            n: '03',
            title: 'A coder writes each file',
            body: 'One file per turn, then a deterministic validator checks the whole set against the Manifest V3 rules.',
          },
          {
            n: '04',
            title: 'You load it in Chrome',
            body: 'Download the zip, unzip it, and load it unpacked. The source is yours — no build step, nothing tied to us.',
          },
        ].map((s) => (
          <li key={s.n} className="firstrun-step">
            <span className="firstrun-num">{s.n}</span>
            <div className="stack-sm" style={{ gap: 4 }}>
              <span className="firstrun-step-title">{s.title}</span>
              <span className="firstrun-step-body">{s.body}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="firstrun-install">
        <div className="stack-sm" style={{ gap: 8 }}>
          <span className="eyebrow">When it finishes</span>
          <p className="firstrun-step-body" style={{ maxWidth: 460 }}>
            You get a zip and a full file browser. Installing it takes three steps:
          </p>
        </div>
        <ol className="firstrun-install-steps">
          <li>Unzip the download.</li>
          <li>
            Open <span className="code-chip">chrome://extensions</span> and turn on{' '}
            <strong>Developer mode</strong>.
          </li>
          <li>
            Click <strong>Load unpacked</strong> and pick the folder.
          </li>
        </ol>
      </div>

      <p className="firstrun-foot">
        Not sure what to build? Pick one of the examples above — it fills the box for you.
      </p>
    </section>
  );
}
