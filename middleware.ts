import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Refreshes the Supabase session on every request and mirrors the rotated cookies
// onto the response. Without this, an expired access token would make Server
// Components see a logged-out user even though the refresh token is still good.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() — not getSession() — because it validates the token with the auth
  // server instead of trusting whatever the cookie claims.
  const { data } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Nothing is gated behind an account any more: a visitor gets an anonymous
  // session the first time they submit a prompt. /login stays available for
  // anyone who wants a real account, and still bounces if already signed in.
  if (path === '/login' && data.user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
