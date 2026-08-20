import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Server client for Server Components and Route Handlers.
 *
 *  The setAll try/catch is not laziness: Server Components cannot set cookies,
 *  and @supabase/ssr calls setAll during a token refresh. Swallowing it there is
 *  correct because middleware.ts performs the same refresh on every request and
 *  *can* write the cookies. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware handles the refresh.
          }
        },
      },
    },
  );
}
