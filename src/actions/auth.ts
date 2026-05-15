'use server'

import { createClient } from '@/lib/supabase/server'

export async function signOutAction(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
