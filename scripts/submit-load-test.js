import http from 'k6/http';
import { check } from 'k6';
import { sleep } from 'k6';

const url = __ENV.SUPABASE_URL;
const anonKey = __ENV.SUPABASE_ANON_KEY;
const challengeId = __ENV.ACTIVE_CHALLENGE_ID;
const tokens = JSON.parse(__ENV.USER_JWTS || '[]');
const answer = JSON.parse(__ENV.SUBMISSION_ANSWER || 'null');

if (!url || !anonKey || !challengeId || tokens.length < 180) {
  throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, ACTIVE_CHALLENGE_ID, and USER_JWTS (180 staging JWTs; first 60 must be team captains).');
}

export const options = {
  scenarios: {
    participant_state: { executor: 'constant-vus', vus: 180, duration: '45s', exec: 'readState' },
    team_submissions: { executor: 'constant-arrival-rate', rate: 60, timeUnit: '1s', duration: '45s', preAllocatedVUs: 60, maxVUs: 60, exec: 'submit' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function readState() {
  const token = tokens[(__VU - 1) % tokens.length];
  const response = http.post(`${url}/rest/v1/rpc/get_event_state`, '{}', {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    tags: { operation: 'get_event_state' },
  });
  check(response, { 'event state available': (r) => r.status === 200 });
  sleep(1);
}

export function submit() {
  const token = tokens[(__VU - 1) % 60];
  const response = http.post(`${url}/rest/v1/rpc/submit_answer`, JSON.stringify({
    p_challenge: challengeId,
    p_answer: answer,
    p_reasoning: 'Synthetic staging load test submission.',
    p_idempotency: uuid(),
  }), {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    tags: { operation: 'submit_answer' },
  });
  check(response, {
    'submission accepted or safely deduplicated': (r) => r.status === 200,
  });
}
