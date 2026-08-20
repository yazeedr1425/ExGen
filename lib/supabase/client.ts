'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Browser client. Realtime subscriptions and Edge Function calls run through
 *  this, so it must carry the user session — createBrowserClient reads the same
 *  cookies the server client writes. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
