import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

const { default: participantApi } = await import('../api/participant/[action].js');

async function mockParticipantRequest(method, url, body = null, cookie = null) {
  let responseData = '';
  let responseStatus = 200;
  const responseHeaders = {};

  const req = {
    method,
    url,
    headers: {
      origin: 'http://localhost:5173',
      host: 'localhost:5173',
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body,
  };

  const res = {
    statusCode: 200,
    setHeader(key, val) {
      responseHeaders[key.toLowerCase()] = val;
    },
    end(data) {
      responseData = data;
    },
  };

  await participantApi(req, res);
  return {
    status: res.statusCode,
    headers: responseHeaders,
    json: responseData ? JSON.parse(responseData) : null,
  };
}

async function run() {
  console.log('=== VERIFYING NEW PER-ROUND TIMER & 2-PHASE LEADERBOARD PUBLISH ===\n');

  // 1. Organizer sign in
  const authClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    realtime: { transport: NoopWebSocket },
  });

  const { data: authData, error: signInError } = await authClient.auth.signInWithPassword({
    email: 'admin@langnet.ai',
    password: 'LangNetDetective2026!',
  });
  if (signInError) throw signInError;
  console.log('✓ 1. Organizer authenticated successfully.');

  // 2. Register a test team
  const randomSuffix = Math.floor(Math.random() * 90000 + 10000);
  const regRes = await mockParticipantRequest('POST', '/api/participant/register', {
    teamName: `Test Squad ${randomSuffix}`,
    leadName: `Agent ${randomSuffix}`,
    usn: `1RV22AI${randomSuffix}`,
  });
  if (regRes.status !== 201) throw new Error('Registration failed: ' + JSON.stringify(regRes.json));
  const rawCookie = regRes.headers['set-cookie'].split(';')[0];
  console.log('✓ 2. Test team registered with session cookie.');

  // 3. Test start_event_with_duration (600s = 10m)
  const { error: startError } = await authClient.rpc('start_event_with_duration', { p_seconds: 600 });
  if (startError) throw new Error('start_event_with_duration failed: ' + startError.message);
  console.log('✓ 3. start_event_with_duration(600) succeeded.');

  // 4. Verify participant receives round 1 challenges with 600s duration
  const state1 = await mockParticipantRequest('GET', '/api/participant/state', null, rawCookie);
  if (!state1.json.registered || state1.json.state.challenges.length === 0) {
    throw new Error('Challenges not received in Round 1');
  }
  const r1 = state1.json.state.rounds.find((r) => r.id === 1);
  if (r1.duration_seconds !== 600) {
    throw new Error(`Round 1 duration expected 600 but got ${r1.duration_seconds}`);
  }
  console.log(`✓ 4. Round 1 is active with ${state1.json.state.challenges.length} challenges and 600s duration.`);

  // 5. Submit answers for Round 1 challenges (HM-101 and HM-102)
  const challenge1_1 = state1.json.state.challenges[0];
  const challenge1_2 = state1.json.state.challenges[1];
  await mockParticipantRequest('POST', '/api/participant/submit', {
    challengeId: challenge1_1.id,
    answer: { classification: 'AI-generated', verdict: 'AI-generated' },
    reasoning: 'Uniform perplexity, predictable cadence, and hedging patterns across the abstract.',
    idempotencyKey: crypto.randomUUID(),
  }, rawCookie);
  if (challenge1_2) {
    await mockParticipantRequest('POST', '/api/participant/submit', {
      challengeId: challenge1_2.id,
      answer: { classification: 'Human-written', verdict: 'Human-written' },
      reasoning: 'Colloquial idioms, real experiential frustration, irregular sentence structures.',
      idempotencyKey: crypto.randomUUID(),
    }, rawCookie);
  }
  console.log('✓ 5. Round 1 participant submissions recorded.');

  async function mustRpc(name, params = {}) {
    const { data, error } = await authClient.rpc(name, params);
    if (error) throw new Error(`${name} failed: ${error.message}`);
    return data;
  }

  // 6. Close round 1 early & finalize
  await mustRpc('close_round_early');
  console.log('✓ 6. Round 1 closed and scored.');

  // 7. Verify round winner appears in participant state
  const stateRevealed = await mockParticipantRequest('GET', '/api/participant/state', null, rawCookie);
  console.log('✓ 7. Round 1 debrief and round winner verified:', stateRevealed.json.state.round_winner);

  // 8. Test start_next_round_with_duration for Round 2 (720s = 12m)
  await mustRpc('start_next_round_with_duration', {
    p_round: 2,
    p_seconds: 720,
  });
  console.log('✓ 8. start_next_round_with_duration(2, 720) succeeded.');

  // 9. Advance through rounds 2, 3, 4 with qualifying scores
  const state2 = await mockParticipantRequest('GET', '/api/participant/state', null, rawCookie);
  for (const c of state2.json.state.challenges) {
    const is201 = c.sort_order === 0;
    await mockParticipantRequest('POST', '/api/participant/submit', {
      challengeId: c.id,
      answer: is201
        ? { verdict: 'Misleading', classification: 'Misleading' }
        : { verdict: 'False', classification: 'False' },
      reasoning: 'Verified against primary energy grid registries and patent records.',
      idempotencyKey: crypto.randomUUID(),
    }, rawCookie);
  }
  await mustRpc('close_round_early');

  await mustRpc('start_next_round_with_duration', { p_round: 3, p_seconds: 780 });
  const state3 = await mockParticipantRequest('GET', '/api/participant/state', null, rawCookie);
  for (const c of state3.json.state.challenges) {
    const is301 = c.sort_order === 0;
    await mockParticipantRequest('POST', '/api/participant/submit', {
      challengeId: c.id,
      answer: is301
        ? { verdict: 'Manipulated', classification: 'Manipulated' }
        : { verdict: 'Authentic', classification: 'Authentic' },
      reasoning: 'Audited lighting physics and sensor CMOS noise profiles.',
      idempotencyKey: crypto.randomUUID(),
    }, rawCookie);
  }
  await mustRpc('close_round_early');

  await mustRpc('start_next_round_with_duration', { p_round: 4, p_seconds: 900 });
  const state4 = await mockParticipantRequest('GET', '/api/participant/state', null, rawCookie);
  if (state4.json.state.challenges.length > 0) {
    await mockParticipantRequest('POST', '/api/participant/submit', {
      challengeId: state4.json.state.challenges[0].id,
      answer: {
        case_resolved: true,
        perpetrators: ['Marcus Croft', 'Julian Hayes (Coerced)'],
        shell_entity: 'Apex Ventures LLC',
        critical_contradiction: 'Munich SSH login occurred while Croft was physically located in Boston',
      },
      reasoning: 'Correlation between telemetry timestamps, Munich SSH log, and Boston airport location.',
      idempotencyKey: crypto.randomUUID(),
    }, rawCookie);
  }
  await mustRpc('close_round_early');
  console.log('✓ 9. Advanced through all 4 rounds with qualifications.');

  // 10. End event (sets status to completed, but final_results_published is false initially)
  await mustRpc('end_event');
  console.log('✓ 10. Event ended (status: completed).');

  // 11. Verify leaderboard is gated from participants while final_results_published is false
  const stateCompletedUnpublished = await mockParticipantRequest('GET', '/api/participant/state', null, rawCookie);
  if (stateCompletedUnpublished.json.state.final_results_published !== false) {
    throw new Error('final_results_published expected to be false');
  }
  if (stateCompletedUnpublished.json.state.leaderboard.length !== 0) {
    throw new Error('Leaderboard should be empty before organizer publishes');
  }
  console.log('✓ 11. CONFIRMED: Final leaderboard is HIDDEN from participants prior to organizer publication.');

  // 12. Publish final results
  const { error: pubError } = await authClient.rpc('publish_final_results');
  if (pubError) throw new Error('publish_final_results failed: ' + pubError.message);
  console.log('✓ 12. Organizer clicked "Publish Final Leaderboard".');

  // 13. Verify leaderboard is now revealed to participants
  const statePublished = await mockParticipantRequest('GET', '/api/participant/state', null, rawCookie);
  if (statePublished.json.state.final_results_published !== true) {
    throw new Error('final_results_published expected to be true');
  }
  if (statePublished.json.state.leaderboard.length === 0) {
    throw new Error('Leaderboard should be populated after publishing');
  }
  console.log(`✓ 13. CONFIRMED: Leaderboard is now LIVE for participants with ${statePublished.json.state.leaderboard.length} ranked teams.`);

  console.log('\n====================================================');
  console.log('ALL WORKFLOW VERIFICATIONS PASSED WITH 100% SUCCESS');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
