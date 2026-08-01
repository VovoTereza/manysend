import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function createOAuthState(payload) {
  const body = encode({ ...payload, exp: Date.now() + 10 * 60 * 1000 });
  const signature = createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function readOAuthState(state) {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature) throw new Error('invalid_state');
  const expected = createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('base64url');
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    throw new Error('invalid_state');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Date.now()) throw new Error('expired_state');
  return payload;
}

export function metaConfig() {
  const required = ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`missing_configuration:${missing.join(',')}`);
  return {
    appId: process.env.META_APP_ID.trim(),
    appSecret: process.env.META_APP_SECRET.trim(),
    redirectUri: process.env.META_REDIRECT_URI.trim(),
    version: (process.env.META_GRAPH_VERSION || 'v23.0').trim()
  };
}

export function noStoreJson(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  });
}

export async function authenticatedUser(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: key }
  });
  return response.ok ? response.json() : null;
}

export function encryptToken(token) {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error('missing_configuration:TOKEN_ENCRYPTION_KEY');
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export async function upsertSocialAccounts(accounts) {
  const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('missing_configuration:SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${url}/rest/v1/social_accounts?on_conflict=platform,external_account_id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(accounts)
  });
  if (!response.ok) throw new Error(`account_persistence_failed:${response.status}`);
  return response.json();
}
