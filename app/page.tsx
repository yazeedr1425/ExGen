import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  return (
    <main className="shell">
      <div className="stack" style={{ maxWidth: 640, margin: '0 auto', paddingTop: 'var(--s6)' }}>
        <h1 style={{ fontSize: '2.1rem' }}>
          Describe a Chrome extension.<br />
          Get one that actually loads.
        </h1>
        <p className="muted">
          A planner writes the manifest, a coder writes each file, and a deterministic
          validator checks the result against the Manifest V3 rules before you ever
          download it. If it fails, it says so — it never hands you a broken build and
          calls it done.
        </p>

        <div className="row">
          <Link href="/login" className="btn btn-primary btn-lg">
            Get started
          </Link>
        </div>

        <Card>
          <div className="stack-sm">
            <h3>What you get</h3>
            <ul className="small muted" style={{ margin: 0, paddingLeft: '1.2em' }}>
              <li>A zip you can load unpacked in Chrome immediately</li>
              <li>Every generated file readable in the browser before you download</li>
              <li>Only the permissions the code actually uses</li>
              <li>Live progress while it builds, and a real error when it fails</li>
            </ul>
          </div>
        </Card>
      </div>
    </main>
  );
}
