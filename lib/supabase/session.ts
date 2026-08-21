import type { SupabaseClient, User } from '@supabase/supabase-js';

/** Returns the current user, creating an anonymous one if there is none.
 *
 *  The app is usable without signing up: the first time a visitor actually does
 *  something that needs an owner — submitting a prompt — they get an anonymous
 *  Supabase user. It is a real row in auth.users with a real JWT, so job
 *  ownership, the profiles trigger and the Edge Functions all keep working
 *  unchanged; it simply has no email attached.
 *
 *  Requires "Anonymous sign-ins" to be enabled on the Supabase project. */
export async function ensureSession(supabase: SupabaseClient): Promise<User> {
  const { data } = await supabase.auth.getUser();
  if (data.user) return data.user;

  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error || !created.user) {
    throw new Error(
      error?.message === 'Anonymous sign-ins are disabled'
        ? 'Guest access is turned off for this project. Enable anonymous sign-ins in Supabase, or sign in with an email.'
        : error?.message ?? 'Could not start a guest session.',
    );
  }
  return created.user;
}

/** True when the signed-in user is a guest rather than a real account. */
export function isGuest(user: { is_anonymous?: boolean; email?: string | null } | null): boolean {
  if (!user) return true;
  return user.is_anonymous === true || !user.email;
}
