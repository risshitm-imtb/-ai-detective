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

async function runTest() {
  console.log('====================================================');
  console.log('AI DETECTIVE FULL END-TO-END VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  // TEST 1: Participant Service - Initial State Check
  console.log('[TEST 1] Participant State (No Session)...');
  const stateNoSession = await mockParticipantRequest('GET', '/api/participant/state');
  if (stateNoSession.status === 200 && stateNoSession.json?.registered === false) {
    console.log('  ✓ PASS: Participant state returned registered: false without session cookie.');
  } else {
    throw new Error(`FAIL: Unexpected response: ${JSON.stringify(stateNoSession)}`);
  }

  // TEST 2: Team Registration (3 Fields)
  const uniqueId = Math.floor(Math.random() * 89999 + 10000);
  const testUSN = `1RV22CS${uniqueId}`;
  const testTeamName = `Apex Sleuths ${uniqueId}`;
  const testLead = `Lead Investigator ${uniqueId}`;

  console.log(`\n[TEST 2] Registering Team: "${testTeamName}", USN: "${testUSN}"...`);
  const regResponse = await mockParticipantRequest('POST', '/api/participant/register', {
    teamName: testTeamName,
    leadName: testLead,
    usn: testUSN,
  });

  if (regResponse.status === 201 && regResponse.json?.registered === true) {
    console.log(`  ✓ PASS: Registration succeeded (Team ID: ${regResponse.json.team.id})`);
  } else {
    throw new Error(`FAIL: Registration failed: ${JSON.stringify(regResponse)}`);
  }

  const sessionCookieHeader = regResponse.headers['set-cookie'];
  if (!sessionCookieHeader) throw new Error('FAIL: Set-Cookie header missing from registration response.');
  const sessionCookie = sessionCookieHeader.split(';')[0];
  console.log('  ✓ PASS: Secure session cookie received.');

  // TEST 3: Duplicate USN Rejection
  console.log('\n[TEST 3] Attempting Duplicate Registration with same USN...');
  const dupResponse = await mockParticipantRequest('POST', '/api/participant/register', {
    teamName: `Another Team ${uniqueId}`,
    leadName: 'Another Lead',
    usn: testUSN,
  });

  if (dupResponse.status === 409) {
    console.log(`  ✓ PASS: Duplicate USN rejected with HTTP 409 (${dupResponse.json?.error})`);
  } else {
    throw new Error(`FAIL: Duplicate USN not rejected with 409: ${JSON.stringify(dupResponse)}`);
  }

  // TEST 4: Session Persistence & Reconnect
  console.log('\n[TEST 4] Restoring Lobby State with Session Cookie...');
  const restoredState = await mockParticipantRequest('GET', '/api/participant/state', null, sessionCookie);
  if (restoredState.status === 200 && restoredState.json?.registered === true) {
    const team = restoredState.json.state.team;
    if (team.name === testTeamName && team.lead_name === testLead) {
      console.log(`  ✓ PASS: Session restored cleanly for team "${team.name}" (Lead: "${team.lead_name}")`);
    } else {
      throw new Error(`FAIL: Restored team data mismatch: ${JSON.stringify(team)}`);
    }
  } else {
    throw new Error(`FAIL: Failed to restore session: ${JSON.stringify(restoredState)}`);
  }

  // TEST 5: Organizer Authentication
  console.log('\n[TEST 5] Verifying Organizer Authentication with Supabase...');
  const authClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    realtime: { transport: NoopWebSocket },
  });

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: 'admin@langnet.ai',
    password: 'LangNetDetective2026!',
  });

  if (authError || !authData?.session) {
    throw new Error(`FAIL: Organizer sign-in failed: ${authError?.message}`);
  }
  console.log(`  ✓ PASS: Organizer signed in as ${authData.user.email} (UID: ${authData.user.id})`);

  // TEST 6: Organizer Authorization Role Check
  console.log('\n[TEST 6] Checking is_organizer RPC role...');
  const { data: isOrg, error: roleError } = await authClient.rpc('is_organizer');
  if (roleError || !isOrg) {
    throw new Error(`FAIL: is_organizer returned false or errored: ${roleError?.message}`);
  }
  console.log('  ✓ PASS: is_organizer returned TRUE.');

  // TEST 7: Organizer Event State Access
  console.log('\n[TEST 7] Fetching Admin Event State...');
  const { data: adminState, error: adminStateError } = await authClient.rpc('get_admin_event_state');
  if (adminStateError || !adminState) {
    throw new Error(`FAIL: get_admin_event_state failed: ${adminStateError?.message}`);
  }
  console.log(`  ✓ PASS: Admin state retrieved. Registered teams: ${adminState.teams}, Published challenges: ${adminState.published_challenges}`);

  // TEST 8: Verify All 4 Rounds Have Verified Published Challenges
  console.log('\n[TEST 8] Verifying Published Challenges for all 4 Rounds...');
  const adminClient = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: NoopWebSocket },
  });

  const { data: challenges, error: chalError } = await adminClient
    .from('challenges')
    .select('id, round_id, sort_order, published')
    .eq('published', true);

  if (chalError) throw new Error(`FAIL: Could not query challenges: ${chalError.message}`);

  for (let r = 1; r <= 4; r++) {
    const found = challenges.filter((c) => c.round_id === r);
    if (found.length === 0) {
      throw new Error(`FAIL: Round ${r} has no published challenges!`);
    }
    console.log(`  ✓ Round ${r}: ${found.length} published challenge(s) verified.`);
  }

  console.log('\n====================================================');
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (8/8)');
  console.log('====================================================');
}

runTest().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err.message);
  process.exit(1);
});

