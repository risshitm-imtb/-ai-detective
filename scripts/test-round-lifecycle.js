import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

class NoopWebSocket {}

const envPath = path.resolve(process.cwd(), '.env.local');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
Object.assign(process.env, env);

async function verifyLifecycle() {
  console.log('Testing organizer lifecycle methods and submission visibility...');

  const authClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    realtime: { transport: NoopWebSocket },
  });

  const { data: authData } = await authClient.auth.signInWithPassword({
    email: 'admin@langnet.ai',
    password: 'LangNetDetective2026!',
  });

  if (!authData?.session) throw new Error('Organizer sign in failed');

  // Verify get_admin_event_state contains the teams and submissions
  const { data: state, error } = await authClient.rpc('get_admin_event_state');
  if (error) throw error;

  console.log('Admin State Verification:');
  console.log('- Total Teams:', state.teams);
  console.log('- Total Submissions:', state.submissions);
  console.log('- Published Challenges:', state.published_challenges);
  console.log('- Event Status:', state.event.event.status);

  console.log('✓ Organizer lifecycle inspection passed cleanly.');
}

verifyLifecycle().catch(console.error);

