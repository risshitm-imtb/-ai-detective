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

async function main() {
  const env = getEnv();
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: NoopWebSocket },
  });

  const email = process.argv[2] || 'admin@langnet.ai';
  const password = process.argv[3] || 'LangNetDetective2026!';

  console.log(`Checking organizer user: ${email}...`);

  const { data: list, error: listError } = await client.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list users:', listError.message);
    process.exit(1);
  }

  let user = list.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.log(`Creating auth user ${email}...`);
    const { data: created, error: createError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'organizer', name: 'Lang Net Lead' },
    });
    if (createError) {
      console.error('Failed to create auth user:', createError.message);
      process.exit(1);
    }
    user = created.user;
    console.log(`Auth user created: ${user.id}`);
  } else {
    console.log(`Auth user exists: ${user.id}`);
  }

  // Ensure record in organizers table
  const { data: org, error: orgError } = await client
    .from('organizers')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (orgError) {
    console.error('Failed to check organizers table:', orgError.message);
    process.exit(1);
  }

  if (!org) {
    console.log(`Adding ${user.id} to organizers table...`);
    const { error: insertError } = await client
      .from('organizers')
      .insert({ user_id: user.id });
    if (insertError) {
      console.error('Failed to insert organizer:', insertError.message);
      process.exit(1);
    }
    console.log('Organizer role granted successfully!');
  } else {
    console.log('User is already registered in organizers table.');
  }

  console.log(`Organizer account ready:`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main().catch(console.error);

