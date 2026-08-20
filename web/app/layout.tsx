import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'ExtGen — prompt to Chrome extension',
  description: 'Describe an extension in plain English and get a working Manifest V3 build.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href={data.user ? '/dashboard' : '/'} className="brand">
              Ext<span className="brand-mark">Gen</span>
            </Link>
            <span className="spacer" />
            {data.user && (
              <>
                <span className="small muted truncate" style={{ maxWidth: 220 }}>
                  {data.user.email}
                </span>
                <form action="/auth/signout" method="post">
                  <button className="btn btn-ghost" type="submit">
                    Sign out
                  </button>
                </form>
              </>
            )}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
