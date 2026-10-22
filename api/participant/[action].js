import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const COOKIE_BASE = 'langnet_participant';
const SESSION_SECONDS = 180 * 24 * 60 * 60;

const digest = (value) => createHash('sha256').update(value).digest('hex');
const isSecureRequest = (req) => {
  const forwardedProtocol = req.headers['x-forwarded-proto']?.split(',')[0]?.trim();
  if (forwardedProtocol) return forwardedProtocol === 'https';
  const host = (req.headers.host || '').split(':')[0];
  return Boolean(req.socket?.encrypted) || (process.env.NODE_ENV === 'production' && !['localhost', '127.0.0.1', '::1'].includes(host));
};

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') {
    if (JSON.stringify(req.body).length > 20_000) throw new Error('Request body is too large.');
    return req.body;
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) throw new Error('Request body is too large.');
  }
  return raw ? JSON.parse(raw) : {};
}

function cookieName(req) {
  return isSecureRequest(req) ? `__Host-${COOKIE_BASE}` : COOKIE_BASE;
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
  }
  return null;
}

function cookieOptions(req, value) {
  const secure = isSecureRequest(req);
  return `${cookieName(req)}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) {
    if (req.method === 'POST') throw new Error('Request origin is not allowed.');
    return;
  }
  const originUrl = new URL(origin);
  const forwardedProtocol = req.headers['x-forwarded-proto']?.split(',')[0]?.trim();
  const requestProtocol = forwardedProtocol || (req.socket?.encrypted ? 'https' : 'http');
  if (originUrl.host !== req.headers.host || originUrl.protocol !== `${requestProtocol}:`) {
    throw new Error('Request origin is not allowed.');
  }
}

function hasJsonContentType(req) {
  return /^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '');
}

class NoopWebSocket {}

function backend() {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) throw new Error('CONFIG_MISSING_SUPABASE_URL');
  if (!serviceKey) throw new Error('CONFIG_MISSING_SERVICE_ROLE_KEY');
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('invalid protocol');
  } catch {
    throw new Error('CONFIG_INVALID_SUPABASE_URL');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: NoopWebSocket },
  });
}

function serviceError(error) {
  if (error?.message === 'CONFIG_MISSING_SUPABASE_URL') {
    return { status: 503, message: 'Participant service is missing VITE_SUPABASE_URL in its server environment.' };
  }
  if (error?.message === 'CONFIG_MISSING_SERVICE_ROLE_KEY') {
    return { status: 503, message: 'Participant service is missing SUPABASE_SERVICE_ROLE_KEY. Add it as a server-only environment variable and restart the server.' };
  }
  if (error?.message === 'CONFIG_INVALID_SUPABASE_URL') {
    return { status: 503, message: 'Participant service has an invalid VITE_SUPABASE_URL. Check the server environment configuration.' };
  }
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    return { status: 503, message: 'Participant registration RPCs are not available. Apply migration 202610220001_guest_team_registration.sql to this Supabase project.' };
  }
  if (error?.code === '42501' && !/session expired|session.*invalid|not qualified/i.test(error?.message || '')) {
    return { status: 503, message: 'Supabase rejected the participant server permissions. Verify the server-only service key and guest registration migration.' };
  }
  if (error?.status === 401 || error?.status === 403) {
    return { status: 503, message: 'Supabase rejected the participant server credentials. Verify the server-only key belongs to the configured project.' };
  }
  if (error instanceof TypeError && /fetch|network|socket/i.test(error.message)) {
    return { status: 503, message: 'Participant service cannot reach Supabase. Check the server network and VITE_SUPABASE_URL.' };
  }
  return { status: 503, message: 'Participant service could not complete its Supabase request. Check server configuration and database availability.' };
}

function statusFor(error) {
  if (error?.code === '23505') return 409;
  if (error?.code === '42501') {
    if (/session expired or invalid/i.test(error?.message || '')) return 401;
    if (/not qualified/i.test(error?.message || '')) return 403;
    return 503;
  }
  if (error?.code === 'P0001') return 400;
  if (error?.code === 'PGRST202' || error?.code === '42883') return 503;
  if (error?.status >= 500 || error?.status === 0 || error?.status === 401 || error?.status === 403) return 503;
  if (error instanceof TypeError && /fetch|network|socket/i.test(error.message)) return 503;
  return 400;
}

function safeMessage(error) {
  if (error?.code === '23505') {
    const details = [error?.constraint, error?.details, error?.message].filter(Boolean).join(' ');
    if (/teams_name_ci_unique/i.test(details)) return 'That team name is already registered. Choose another team name.';
    if (/teams_usn_normalized_unique/i.test(details)) return 'That USN already has a team registration.';
    if (/submissions_team_id_idempotency_key_key/i.test(details)) return 'This submission request was already used. Refresh the lobby and try again.';
    return 'This request conflicts with an existing record. Review the details and try again.';
  }
  if (error?.code === '42501' && /session expired or invalid/i.test(error?.message || '')) return 'Your participant session has expired. Please contact the event organizer.';
  if (error?.code === '42501' && /not qualified/i.test(error?.message || '')) return 'This team did not qualify for the current round.';
  if (error?.code === '42501') return 'Supabase rejected participant server permissions. Verify the server-only service key and guest registration migration.';
  if (error?.status === 401 || error?.status === 403) return 'Supabase rejected the participant server credentials. Verify the server-only key belongs to the configured project.';
  if (error?.status >= 500 || error?.status === 0 || (error instanceof TypeError && /fetch|network|socket/i.test(error.message))) {
    return 'Participant service cannot complete its Supabase request. Check the server network and database availability.';
  }
  if (error?.code === 'PGRST202' || error?.code === '42883') return 'Participant registration is not configured yet. Apply the guest registration migration, then try again.';
  if (/session expired or invalid/i.test(error?.message || '')) return 'Your participant session has expired. Please contact the event organizer.';
  if (/not qualified/i.test(error?.message || '')) return 'This team did not qualify for the current round.';
  const allowed = [
    'Team name must be 2 to 40 characters.',
    'Team Lead Name must be 2 to 50 characters.',
    'Enter a valid USN (3 to 32 non-space characters).',
    'USN may contain letters, numbers, hyphens, and slashes only.',
    'Team registration is closed.',
    'This round is closed or not active.',
    'This team is not qualified for this round.',
    'Invalid submission.',
  ];
  return allowed.includes(error?.message) ? error.message : 'The request could not be completed. Please try again.';
}

function getRateKey(req, pepper) {
  const forwarded = req.headers['x-forwarded-for'];
  const address = (typeof forwarded === 'string' ? forwarded.split(',')[0] : '') || req.socket?.remoteAddress || 'unknown';
  return digest(`${pepper}:${address.trim()}`);
}

export default async function participantApi(req, res) {
  try {
    assertSameOrigin(req);
    const action = req.query?.action || new URL(req.url, 'http://localhost').pathname.split('/').filter(Boolean).at(-1);
    const client = backend();
    const cookieKey = cookieName(req);
    const rawToken = readCookie(req, cookieKey);

    if (action === 'register' && req.method === 'POST') {
      if (!hasJsonContentType(req)) return send(res, 415, { error: 'Use the supported team registration form.' });
      if (rawToken) {
        const { error: existingSessionError } = await client.rpc('participant_get_state', { p_session_hash: digest(rawToken) });
        if (!existingSessionError) return send(res, 409, { error: 'This browser already has a team registration. Refresh to return to its lobby.' });
      }
      const body = await readJson(req);
      const teamName = typeof body.teamName === 'string' ? body.teamName.trim() : '';
      const leadName = typeof body.leadName === 'string' ? body.leadName.trim() : '';
      const usn = typeof body.usn === 'string' ? body.usn.trim() : '';
      if (!teamName || !leadName || !usn) return send(res, 400, { error: 'Enter a Team Name, Team Lead Name, and USN.' });
      const { data: rateAllowed, error: rateError } = await client.rpc('participant_check_registration_rate', {
        p_rate_key: getRateKey(req, process.env.SUPABASE_SERVICE_ROLE_KEY),
      });
      if (rateError) return send(res, statusFor(rateError), { error: safeMessage(rateError) });
      if (!rateAllowed) return send(res, 429, { error: 'Too many registration attempts. Please try again in an hour.' });
      const token = randomBytes(32).toString('base64url');
      const sessionHash = digest(token);
      const { data: team, error } = await client.rpc('participant_register', {
        p_team_name: teamName,
        p_lead_name: leadName,
        p_usn: usn,
        p_session_hash: sessionHash,
      });
      if (error) return send(res, statusFor(error), { error: safeMessage(error) });
      const { data: state, error: stateError } = await client.rpc('participant_get_state', { p_session_hash: sessionHash });
      if (stateError) return send(res, 500, { error: 'Registration was saved, but the lobby could not be loaded. Refresh this page to continue.' }, { 'Set-Cookie': cookieOptions(req, token) });
      return send(res, 201, { registered: true, team, state }, { 'Set-Cookie': cookieOptions(req, token) });
    }

    if (action === 'state' && req.method === 'GET') {
      if (!rawToken) return send(res, 200, { registered: false });
      const { data, error } = await client.rpc('participant_get_state', { p_session_hash: digest(rawToken) });
      if (error?.code === '42501' && /session expired or invalid/i.test(error?.message || '')) return send(res, 401, { registered: false, error: safeMessage(error) }, { 'Set-Cookie': `${cookieKey}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${cookieKey.startsWith('__Host-') ? '; Secure' : ''}` });
      if (error) return send(res, statusFor(error), { error: safeMessage(error) });
      return send(res, 200, { registered: true, state: data });
    }

    if (action === 'submit' && req.method === 'POST') {
      if (!hasJsonContentType(req)) return send(res, 415, { error: 'Use the supported submission form.' });
      if (!rawToken) return send(res, 401, { error: 'Register your team before submitting evidence.' });
      const body = await readJson(req);
      const challenge = String(body.challengeId || '');
      const idempotencyKey = body.idempotencyKey;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(challenge)
          || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(idempotencyKey || ''))) {
        return send(res, 400, { error: 'The submission details are incomplete. Please try again.' });
      }
      const { error } = await client.rpc('participant_submit_answer', {
        p_session_hash: digest(rawToken),
        p_challenge: challenge,
        p_answer: body.answer ?? null,
        p_reasoning: String(body.reasoning || ''),
        p_idempotency: idempotencyKey,
      });
      if (error) return send(res, statusFor(error), { error: safeMessage(error) });
      return send(res, 200, { submitted: true });
    }

    return send(res, 404, { error: 'Participant API route not found.' });
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : error.message === 'Request origin is not allowed.' ? 403 : error.message === 'Request body is too large.' ? 413 : 500;
    if (status === 500) {
      const diagnostic = serviceError(error);
      return send(res, diagnostic.status, { error: diagnostic.message });
    }
    return send(res, status, { error: error.message });
  }
}
