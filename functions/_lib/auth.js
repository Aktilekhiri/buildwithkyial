/* ============================================================
   Admin authentication
   One password (ADMIN_PASSWORD secret). After login the browser
   gets a signed, HttpOnly cookie that is valid for 7 days.
   Changing ADMIN_PASSWORD signs everybody out.
   ============================================================ */

const COOKIE = 'kb_admin';
const SESSION_DAYS = 7;
const enc = new TextEncoder();

function b64url(bytes) {
  let bin = '';
  new Uint8Array(bytes).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function secretFor(env) {
  return env.SESSION_SECRET || 'kb-session:' + (env.ADMIN_PASSWORD || '');
}

async function hmacKey(env) {
  return crypto.subtle.importKey('raw', enc.encode(secretFor(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** Compares two strings without leaking how many characters matched. */
export async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b)))
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function createSessionCookie(env) {
  const payload = b64url(enc.encode(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 864e5 })));
  const sig = b64url(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(payload)));
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function isAuthed(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!match) return false;
  const [payload, sig] = match[1].split('.');
  if (!payload || !sig) return false;
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64url(sig), enc.encode(payload));
    if (!valid) return false;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch (e) {
    return false;
  }
}

/** Blocks admin changes sent from other websites. */
export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // same-origin fetch from older browsers; the SameSite cookie still protects us
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch (e) {
    return false;
  }
}
