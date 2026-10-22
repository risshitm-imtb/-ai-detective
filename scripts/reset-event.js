import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

class NoopWebSocket {}

function getEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local file not found');
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return env;
}

export async function resetEvent(cleanTeams = false) {
  const env = getEnv();
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: NoopWebSocket },
  });

  console.log('Resetting event state to pre-event "registration"...');

  // 1. Reset event_config
  const { error: eventError } = await client
    .from('event_config')
    .update({
      status: 'registration',
      current_round: null,
      event_started_at: null,
      event_ended_at: null,
      final_results_published: false,
      updated_at: new Date().toISOString(),
    })
    .eq('singleton', true);

  if (eventError) console.error('Error resetting event_config:', eventError.message);

  // 2. Reset rounds
  const { error: roundError } = await client
    .from('rounds')
    .update({
      status: 'locked',
      starts_at: null,
      deadline_at: null,
      closed_at: null,
      paused_remaining_seconds: null,
    })
    .gte('id', 1);

  await client.from('rounds').update({ duration_seconds: 600, qualification_percent: 0 }).in('id', [1, 2, 3]);
  await client.from('rounds').update({ duration_seconds: 900, qualification_percent: 0 }).eq('id', 4);

  if (roundError) console.error('Error resetting rounds:', roundError.message);

  // 3. Clear transient competition records
  await client.from('qualifications').delete().neq('round_id', 0);
  await client.from('scores').delete().neq('round_id', 0);
  await client.from('submissions').delete().neq('round_id', 0);

  if (cleanTeams) {
    console.log('Cleaning test teams, sessions, and rate-limit logs...');
    await client.from('participant_registration_attempts').delete().neq('rate_key', 'none');
    await client.from('participant_sessions').delete().neq('token_hash', 'none');
    await client.from('teams').delete().neq('name', 'none');
  }

  console.log('✓ Event successfully reset to registration state.');
}

if (process.argv[1]?.endsWith('reset-event.js')) {
  const clean = process.argv.includes('--clean-teams');
  resetEvent(clean).catch(console.error);
}

