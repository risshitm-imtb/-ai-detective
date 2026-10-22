import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { resetEvent } from './reset-event.js';

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

const env = getEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

class NoopWebSocket {
  constructor() {
    this.readyState = 3;
  }
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
}

const serviceClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: NoopWebSocket },
});

const adminClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: NoopWebSocket },
});

const digest = (v) => crypto.createHash('sha256').update(v).digest('hex');

async function testCloseRoundEarlyFlow() {
  console.log('=== STARTING TEST: CLOSE ROUND EARLY & PROGRESSION ===');

  // Step 1: Clean reset
  console.log('1. Resetting database to pre-event state...');
  await resetEvent(true);
  console.log('   ✓ Database reset.');

  // Step 2: Sign in organizer
  console.log('2. Signing in organizer (admin@langnet.ai)...');
  const { data: authData, error: authErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@langnet.ai',
    password: 'LangNetDetective2026!',
  });
  if (authErr) throw new Error(`Admin login failed: ${authErr.message}`);
  console.log('   ✓ Organizer authenticated.');

  // Step 3: Register participant teams
  console.log('3. Registering 2 participant teams...');
  const teams = [
    { name: 'Team Alpha', lead: 'Alice', usn: '1MS23CS010' },
    { name: 'Team Beta', lead: 'Bob', usn: '1MS23CS020' },
  ];
  const participantTokens = [];

  for (const t of teams) {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = digest(rawToken);
    const { data: teamId, error: regErr } = await serviceClient.rpc('participant_register', {
      p_team_name: t.name,
      p_lead_name: t.lead,
      p_usn: t.usn,
      p_session_hash: tokenHash,
    });
    if (regErr) throw new Error(`Registration failed for ${t.name}: ${regErr.message}`);
    participantTokens.push({ name: t.name, rawToken, tokenHash, teamId });
    console.log(`   ✓ Registered ${t.name} (id: ${teamId})`);
  }

  // Step 4: Start Event & Round 1 (duration: 600s)
  console.log('4. Organizer starts event with Round 1 duration 600s...');
  const { error: startEventErr } = await adminClient.rpc('start_event_with_duration', { p_seconds: 600 });
  if (startEventErr) throw startEventErr;
  console.log('   ✓ Event and Round 1 started.');

  // Step 6: Verify participant sees Round 1 active and gets challenges
  console.log('6. Verifying participant state for Round 1...');
  const { data: p1State, error: p1Err } = await serviceClient.rpc('participant_get_state', {
    p_session_hash: participantTokens[0].tokenHash,
  });
  if (p1Err) throw p1Err;
  console.log(`   ✓ Team Alpha sees Round ${p1State.event.current_round}, ${p1State.challenges.length} challenges available.`);
  if (p1State.challenges.length === 0) throw new Error('Expected Round 1 challenges to be present.');

  // Step 7: Team Alpha submits just ONE answer (partial completion)
  console.log('7. Team Alpha submits 1 answer in Round 1 (testing partial completion)...');
  const ch1 = p1State.challenges[0];
  const { error: subErr } = await serviceClient.rpc('participant_submit_answer', {
    p_session_hash: participantTokens[0].tokenHash,
    p_challenge: ch1.id,
    p_answer: { classification: 'Human-written' },
    p_reasoning: 'Natural human rhythm.',
    p_idempotency: crypto.randomUUID(),
  });
  if (subErr) throw subErr;
  console.log('   ✓ Team Alpha submitted 1 answer.');

  // Step 8: Organizer clicks "Close Round Early"
  console.log('8. Organizer clicks CLOSE ROUND EARLY for Round 1...');
  const { error: closeR1Err } = await adminClient.rpc('close_round_early');
  if (closeR1Err) throw closeR1Err;
  console.log('   ✓ Round 1 closed early.');

  // Step 9: Verify Round 1 results & winner
  console.log('9. Checking admin state after Close Round Early...');
  const { data: adminStateR1, error: admErr1 } = await adminClient.rpc('get_admin_event_state');
  if (admErr1) throw admErr1;
  const round1State = adminStateR1.event?.rounds?.find((r) => r.id === 1);
  console.log(`   ✓ Round 1 status: ${round1State.status} (expected: revealed)`);
  if (round1State.status !== 'revealed') throw new Error(`Round 1 status should be 'revealed', got '${round1State.status}'`);
  console.log(`   ✓ Round 1 Winner: ${adminStateR1.round_winner?.team_name || 'None'}`);

  // Step 10: Participant checks state while Round 1 is revealed
  console.log('10. Participant checks state after Round 1 closure...');
  const { data: pStateR1Revealed } = await serviceClient.rpc('participant_get_state', {
    p_session_hash: participantTokens[0].tokenHash,
  });
  const r1Score = pStateR1Revealed.scores?.find((s) => s.round_id === 1);
  console.log(`   ✓ Participant score recorded: ${r1Score?.points ?? 0} points.`);
  console.log(`   ✓ Participant round_winner field: ${pStateR1Revealed.round_winner?.team_name}`);

  // Step 11: Organizer sets Round 2 timer and clicks "Start Round 2"
  console.log('11. Organizer sets Round 2 timer to 720s and clicks START ROUND 2...');
  const { error: startR2Err } = await adminClient.rpc('start_next_round_with_duration', {
    p_round: 2,
    p_seconds: 720,
  });
  if (startR2Err) throw startR2Err;
  console.log('   ✓ Round 2 started successfully without qualification error!');

  // Step 12: Participant polls state - must immediately receive Round 2 without re-registering
  console.log('12. Participant polls state for Round 2...');
  const { data: pStateR2, error: pR2Err } = await serviceClient.rpc('participant_get_state', {
    p_session_hash: participantTokens[0].tokenHash,
  });
  if (pR2Err) throw pR2Err;
  console.log(`   ✓ Participant current_round: ${pStateR2.event.current_round} (expected: 2)`);
  console.log(`   ✓ Round 2 challenges available: ${pStateR2.challenges.length}`);
  if (pStateR2.event.current_round !== 2) throw new Error('Expected current_round to be 2');
  if (pStateR2.challenges.length === 0) throw new Error('Expected Round 2 challenges to be available');

  // Step 13: Progress through Round 2 -> Close Early -> Start Round 3
  console.log('13. Close Round 2 early and start Round 3 (780s)...');
  const { error: closeR2Err } = await adminClient.rpc('close_round_early');
  if (closeR2Err) throw closeR2Err;
  const { error: startR3Err } = await adminClient.rpc('start_next_round_with_duration', {
    p_round: 3,
    p_seconds: 780,
  });
  if (startR3Err) throw startR3Err;
  console.log('   ✓ Round 3 started successfully!');

  // Step 14: Close Round 3 early and start Round 4 (900s)
  console.log('14. Close Round 3 early and start Round 4 (900s)...');
  const { error: closeR3Err } = await adminClient.rpc('close_round_early');
  if (closeR3Err) throw closeR3Err;
  const { error: startR4Err } = await adminClient.rpc('start_next_round_with_duration', {
    p_round: 4,
    p_seconds: 900,
  });
  if (startR4Err) throw startR4Err;
  console.log('   ✓ Round 4 started successfully!');

  // Step 15: Close Round 4 early and conclude event
  console.log('15. Close Round 4 early, conclude event, and publish final leaderboard...');
  const { error: closeR4Err } = await adminClient.rpc('close_round_early');
  if (closeR4Err) throw closeR4Err;
  const { error: concErr } = await adminClient.rpc('end_event');
  if (concErr) throw concErr;
  const { error: pubErr } = await adminClient.rpc('publish_final_results');
  if (pubErr) throw pubErr;
  console.log('   ✓ Event concluded and final leaderboard published.');

  // Step 16: Verify final participant view has leaderboard
  const { data: finalPState } = await serviceClient.rpc('participant_get_state', {
    p_session_hash: participantTokens[0].tokenHash,
  });
  console.log(`   ✓ Participant sees final event status: ${finalPState.event.status}`);
  console.log(`   ✓ Leaderboard entries: ${finalPState.leaderboard?.length || 0}`);

  // Step 17: Clean reset for live competition readiness
  console.log('17. Resetting database cleanly so it is 100% ready for actual competition registration...');
  await resetEvent(true);
  console.log('   ✓ Database cleanly reset.');

  console.log('\n=== ALL CLOSE ROUND EARLY & PROGRESSION TESTS PASSED! ===');
}

testCloseRoundEarlyFlow().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
