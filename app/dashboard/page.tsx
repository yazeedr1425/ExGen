import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/AppHeader';
import { PromptComposer } from '@/components/PromptComposer';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const email = auth.user.email ?? '';
  const name = email.split('@')[0] || 'there';

  return (
    <>
      <AppHeader email={email} />

      <main className="workspace">
        <p className="greeting">
          <span className="greeting-mark">Hello, {name}</span>
        </p>

        <h1 className="workspace-title">
          Describe Your <strong>Extension Idea</strong>
        </h1>
        <p className="workspace-sub">
          Tell us what you want your Chrome extension to do. Extgen writes the complete code,
          from the manifest to the UI.
        </p>

        <PromptComposer />
      </main>
    </>
  );
}
