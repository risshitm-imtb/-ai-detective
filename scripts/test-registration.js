import fs from 'node:fs';
import path from 'node:path';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
Object.assign(process.env, env);

const { default: participantApi } = await import('../api/participant/[action].js');

async function mockRequest(method, url, body = null, headers = {}) {
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
      ...headers,
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
  console.log('--- Testing 1: Unregistered state ---');
  const res1 = await mockRequest('GET', '/api/participant/state');
  console.log('Unregistered state status:', res1.status, res1.json);

  const testUSN = 'ENG26-TEST-' + Math.floor(Math.random() * 89999 + 10000);
  const testTeam = 'Cyber Sleuths ' + Math.floor(Math.random() * 8999 + 1000);

  console.log(`\n--- Testing 2: Register Team (${testTeam}, USN: ${testUSN}) ---`);
  const res2 = await mockRequest('POST', '/api/participant/register', {
    teamName: testTeam,
    leadName: 'Detective Sherlock',
    usn: testUSN,
  });
  console.log('Register status:', res2.status);
  console.log('Register response:', res2.json);
  const cookie = res2.headers['set-cookie'];
  console.log('Set-Cookie received:', Boolean(cookie));

  console.log('\n--- Testing 3: Duplicate Registration prevention ---');
  const resDup = await mockRequest('POST', '/api/participant/register', {
    teamName: testTeam + ' Duplicate',
    leadName: 'Another Lead',
    usn: testUSN, // Same USN!
  });
  console.log('Duplicate USN status (expected 409):', resDup.status, resDup.json);

  if (cookie) {
    const tokenCookie = cookie.split(';')[0];
    console.log(`\n--- Testing 4: Reconnecting with session cookie ---`);
    const res3 = await mockRequest('GET', '/api/participant/state', null, {
      cookie: tokenCookie,
    });
    console.log('Authenticated state status:', res3.status);
    console.log('Team name:', res3.json?.state?.team?.name);
    console.log('Lead name:', res3.json?.state?.team?.lead_name);
    console.log('Event status:', res3.json?.state?.event?.status);
  }

  console.log('\n--- Verification completed successfully ---');
}

run().catch(console.error);

