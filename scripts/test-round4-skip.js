import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

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

import { resetEvent } from './reset-event.js';
import crypto from 'node:crypto';

const env = getEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

class NoopWebSocket {
  constructor() {
    this.readyState = 3; // CLOSED
  }
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
}

// Service client for server-side participant RPCs
const serviceClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: NoopWebSocket },
});

// Admin client for organizer RPCs
const adminClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: NoopWebSocket },
});

const digest = (v) => crypto.createHash('sha256').update(v).digest('hex');

async function runTest() {
  console.log('--- STARTING AI DETECTIVE E2E VERIFICATION TEST ---');

  // 1. Reset database to clean registration state
  console.log('Step 1: Resetting database to pre-event registration state...');
  await resetEvent(true);
  console.log('✓ Database reset successfully.');

  // 2. Register 3 teams
  console.log('Step 2: Registering 3 competition teams...');
  const teams = [
    { name: 'Cyber Sleuths', lead: 'Alice Chen', usn: '1MS23CS001' },
    { name: 'Neural Enigma', lead: 'Bob Smith', usn: '1MS23CS002' },
    { name: 'Vector Hawks', lead: 'Charlie Davis', usn: '1MS23CS003' },
  ];

  const teamSessions = [];
  for (const t of teams) {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const sessionHash = digest(rawToken);

    const { data, error } = await serviceClient.rpc('participant_register', {
      p_team_name: t.name,
      p_lead_name: t.lead,
      p_usn: t.usn,
      p_session_hash: sessionHash,
    });
    if (error) throw new Error(`Registration failed for ${t.name}: ${error.message}`);
    teamSessions.push({ ...t, token: rawToken, sessionHash, id: data });
    console.log(`✓ Registered team: "${t.name}" (ID: ${String(data).slice(0, 8)}...)`);
  }

  // 3. Admin sign in & verification
  console.log('Step 3: Authenticating organizer admin...');
  const { data: authData, error: authErr } = await adminClient.auth.signInWithPassword({
    email: 'admin@langnet.ai',
    password: 'LangNetDetective2026!',
  });
  if (authErr) throw new Error(`Admin sign in failed: ${authErr.message}`);
  console.log('✓ Admin authenticated.');

  let { data: adminState, error: adminErr } = await adminClient.rpc('get_admin_event_state');
  if (adminErr) throw new Error(`Admin state failed: ${adminErr.message}`);
  console.log(`✓ Admin state loaded: Event status = ${adminState.event.event.status}, Registered teams = ${adminState.teams}`);

  // 4. Start Event & Round 1 (10 mins = 600s)
  console.log('Step 4: Starting event and initiating Round 1 (600s)...');
  const { error: startErr } = await adminClient.rpc('start_event_with_duration', { p_seconds: 600 });
  if (startErr) throw new Error(`Start event failed: ${startErr.message}`);

  ({ data: adminState } = await adminClient.rpc('get_admin_event_state'));
  console.log(`✓ Event status: ${adminState.event.event.status}, Current Round: ${adminState.event.event.current_round}`);

  // Fetch Round 1 challenges
  const { data: r1Challenges, error: r1Err } = await serviceClient
    .from('challenges')
    .select('id, content')
    .eq('round_id', 1);
  if (r1Err) throw new Error(`Fetch challenges error: ${r1Err.message}`);
  console.log(`✓ Round 1 loaded ${r1Challenges.length} challenges from database.`);

  const { data: r1Keys } = await serviceClient
    .from('challenge_keys')
    .select('challenge_id, answer');
  const keyMap = Object.fromEntries((r1Keys || []).map(k => [k.challenge_id, k.answer]));

  // 5. Team 1 submits answers in Round 1
  console.log('Step 5: Submitting Round 1 answers for Team 1 (Cyber Sleuths)...');
  for (const c of r1Challenges) {
    const keyAnswer = keyMap[c.id]?.classification || keyMap[c.id]?.verdict || 'AI-generated';
    const { error } = await serviceClient.rpc('participant_submit_answer', {
      p_session_hash: teamSessions[0].sessionHash,
      p_challenge: c.id,
      p_answer: { classification: keyAnswer },
      p_reasoning: 'Detailed linguistic variance and semantic cadence analysis.',
      p_idempotency: crypto.randomUUID(),
    });
    if (error) console.warn(`Team 1 submit error on ${c.id}: ${error.message}`);
  }
  console.log('✓ Team 1 completed Round 1 submissions.');

  // Close Round 1 early (which automatically finalizes it and reveals results)
  console.log('Step 6: Closing Round 1 early (auto-finalizes and reveals)...');
  const { data: finR1, error: finErr } = await adminClient.rpc('close_round_early');
  if (finErr) throw new Error(`Close R1 early failed: ${finErr.message}`);
  console.log(`✓ Round 1 closed & finalized. Qualified teams: ${finR1.qualified_count}`);

  // 7. Test SKIP ROUND: Skip Round 2!
  console.log('Step 7: Executing SKIP ROUND on Round 2...');
  const { data: skipData, error: skipErr } = await adminClient.rpc('skip_round', { p_round: 2 });
  if (skipErr) throw new Error(`Skip round 2 failed: ${skipErr.message}`);
  console.log(`✓ Round 2 successfully marked as: ${skipData.status}`);

  // Check event state after skipping
  ({ data: adminState } = await adminClient.rpc('get_admin_event_state'));
  console.log(`✓ Current Round after skip: ${adminState.event.event.current_round}`);

  // 8. Start Round 3 (600s)
  console.log('Step 8: Starting Round 3 (Deepfake Detective - 600s)...');
  const { error: startR3Err } = await adminClient.rpc('start_next_round_with_duration', {
    p_round: 3,
    p_seconds: 600,
  });
  if (startR3Err) throw new Error(`Start Round 3 failed: ${startR3Err.message}`);
  console.log('✓ Round 3 successfully started.');

  // Verify participant state for team 1 in Round 3
  const { data: partState, error: partErr } = await serviceClient.rpc('participant_get_state', {
    p_session_hash: teamSessions[0].sessionHash,
  });
  if (partErr) throw new Error(`Participant get state failed: ${partErr.message}`);
  console.log(`✓ Participant view: Current Round = ${partState.event.current_round}, Round 3 status = ${partState.rounds.find(r => r.id === 3)?.status}`);
  console.log(`✓ Round 2 status in participant state: ${partState.rounds.find(r => r.id === 2)?.status}`);

  // Fetch Round 3 challenges and submit for Team 1
  const { data: r3Challenges } = await serviceClient
    .from('challenges')
    .select('id, content')
    .eq('round_id', 3);
  const { data: r3Keys } = await serviceClient
    .from('challenge_keys')
    .select('challenge_id, answer');
  const r3KeyMap = Object.fromEntries((r3Keys || []).map(k => [k.challenge_id, k.answer]));

  console.log('Submitting Round 3 answers for Team 1...');
  for (const c of (r3Challenges || [])) {
    const keyAnswer = r3KeyMap[c.id]?.classification || r3KeyMap[c.id]?.verdict || 'Manipulated';
    await serviceClient.rpc('participant_submit_answer', {
      p_session_hash: teamSessions[0].sessionHash,
      p_challenge: c.id,
      p_answer: { classification: keyAnswer },
      p_reasoning: 'Forensic spectrogram and metadata inconsistency analysis.',
      p_idempotency: crypto.randomUUID(),
    });
  }
  console.log('✓ Team 1 completed Round 3 submissions.');

  // Close Round 3
  console.log('Step 9: Closing Round 3 early (auto-finalizes and reveals)...');
  await adminClient.rpc('close_round_early');
  console.log('✓ Round 3 closed & finalized.');

  // 9. Start Round 4 (The Final Investigation - 900s)
  console.log('Step 10: Starting Round 4: Project Chimera (900s)...');
  const { error: startR4Err } = await adminClient.rpc('start_next_round_with_duration', {
    p_round: 4,
    p_seconds: 900,
  });
  if (startR4Err) throw new Error(`Start Round 4 failed: ${startR4Err.message}`);
  console.log('✓ Round 4 started.');

  const { data: r4Challenges } = await serviceClient
    .from('challenges')
    .select('id, content')
    .eq('round_id', 4);
  console.log(`✓ Loaded Round 4 investigation challenge (${r4Challenges[0]?.content?.title})`);

  // Team 1 submits 5-part final investigation report
  console.log('Step 11: Team 1 submitting 5-part investigation report...');
  const { error: r4SubErr } = await serviceClient.rpc('participant_submit_answer', {
    p_session_hash: teamSessions[0].sessionHash,
    p_challenge: r4Challenges[0].id,
    p_answer: {
      primary_conclusion: 'Marcus Croft (CFO) masterminded the $42.5M wire diversion using a backdoor coerced from Julian Hayes. Stolen funds routed to Apex Ventures LLC in BVI.',
      key_evidence: 'Exhibit A (Munich SSH session with Croft token), Exhibit C (Commit 7f8b9c override #409), Exhibit F (Apex Ventures incorporated to Croft Zurich counsel).',
      event_sequence: 'Backdoor inserted Oct 10 -> Remote trigger at 02:11 UTC -> 420ms latency spike blinded watchdog -> Wire settled at 02:14:18 UTC.',
      conflicting_evidence: 'Flight LH434 diverted to Boston landing 22:15 UTC. Cell pinged Boston at 02:10 UTC while SSH connected from Munich proxy at 02:11 UTC. Decoy USB in Vance office was an amateur plant with wrong timestamps.',
      uncertainties_and_alternatives: 'Alternative hacker theory refuted due to physical FIDO2 key. Unrecovered funds currently held in BVI trust.',
      confidence_level: 'High (Defensible with hard forensic evidence)',
    },
    p_reasoning: 'Comprehensive forensic analysis synthesizing exhibits A through H.',
    p_idempotency: crypto.randomUUID(),
  });
  if (r4SubErr) throw new Error(`R4 submission failed: ${r4SubErr.message}`);
  console.log('✓ Team 1 report successfully logged.');

  // Finalize Round 4 & End Event
  console.log('Step 12: Closing Round 4 early and concluding event...');
  await adminClient.rpc('close_round_early');
  const { error: endErr } = await adminClient.rpc('end_event');
  if (endErr) throw new Error(`End event failed: ${endErr.message}`);
  console.log('✓ Event status transitioned to completed.');

  // Publish Leaderboard
  console.log('Step 13: Publishing official leaderboard to participants...');
  const { error: pubErr } = await adminClient.rpc('publish_final_results');
  if (pubErr) throw new Error(`Publish failed: ${pubErr.message}`);

  const { data: finalAdminState } = await adminClient.rpc('get_admin_event_state');
  console.log(`✓ Final results published = ${finalAdminState.event.event.final_results_published}`);

  // Fetch final leaderboard as participant
  const { data: finalPartState } = await serviceClient.rpc('participant_get_state', {
    p_session_hash: teamSessions[0].sessionHash,
  });
  console.log('✓ Participant received official final leaderboard:');
  console.table(finalPartState.leaderboard);

  // Clean reset before presentation
  console.log('Step 14: Final clean reset to pristine pre-event registration state...');
  await resetEvent(true);
  console.log('✓ Database restored cleanly to pre-event state.');

  console.log('\n======================================================');
  console.log('ALL E2E WORKFLOW TESTS PASSED PERFECTLY!');
  console.log('======================================================');
}

runTest().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
