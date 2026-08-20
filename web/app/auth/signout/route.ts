import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST-only: a GET sign-out can be triggered by any <img> or link prefetch on a
// page the user visits, which would log them out without them asking.
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
