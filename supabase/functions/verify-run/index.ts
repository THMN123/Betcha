// Supabase Edge Function: verifies a player's run by replaying their inputs server-side.
// Deploy:  supabase functions deploy verify-run
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { handleVerifyRun } from './handler.ts';

Deno.serve((req) =>
  handleVerifyRun(req, {
    supabaseUrl: Deno.env.get('SUPABASE_URL')!,
    anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  })
);
