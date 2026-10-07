/* ============================================================
   Storage helpers (Cloudflare KV, binding name: SITE_KV)

   KV keys
     content        JSON: { settings, projects[], reviews[] }
     leads          JSON: [ contact form messages, newest first ]
     media:<id>     binary image, metadata { type }
     rl:<bucket>    rate-limit counters (expire automatically)
   ============================================================ */

export const SETTINGS_FIELDS = {
  available: 'bool',
  availabilityText: 120,
  email: 120,
  phone: 40,
  whatsapp: 40,
  telegram: 60,
  linkedin: 'url',
  github: 'url',
  upwork: 'url',
  instagram: 'url',
  calendly: 'url',
  web3formsKey: 80,
  photo: 64
};

const MAX_LEADS = 300;
const MAX_PENDING_REVIEWS = 50;

export function emptyContent() {
  return {
    settings: { available: true },
    projects: [],
    reviews: []
  };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

export function newId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/* ---------- Field cleaning ---------- */
export function str(value, max) {
  return String(value == null ? '' : value).replace(/\u0000/g, '').trim().slice(0, max);
}

export function url(value) {
  const v = str(value, 500);
  if (!v) return '';
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch (e) {
    return '';
  }
}

export function cleanSettings(input, previous = {}) {
  const out = { ...previous };
  for (const [key, rule] of Object.entries(SETTINGS_FIELDS)) {
    if (!(key in input)) continue;
    if (rule === 'bool') out[key] = Boolean(input[key]);
    else if (rule === 'url') out[key] = url(input[key]);
    else out[key] = str(input[key], rule);
  }
  return out;
}

export function cleanProject(input, previous = {}) {
  const title = str(input.title ?? previous.title, 120);
  if (!title) throw new HttpError(400, 'Project title is required.');
  const tags = Array.isArray(input.tags)
    ? input.tags
    : String(input.tags ?? (previous.tags || []).join(',')).split(',');
  return {
    id: previous.id || newId(),
    title,
    category: str(input.category ?? previous.category, 60),
    client: str(input.client ?? previous.client, 80),
    year: str(input.year ?? previous.year, 10),
    summary: str(input.summary ?? previous.summary, 240),
    description: str(input.description ?? previous.description, 4000),
    result: str(input.result ?? previous.result, 120),
    tags: tags.map((t) => str(t, 32)).filter(Boolean).slice(0, 12),
    url: url(input.url ?? previous.url),
    image: str(input.image ?? previous.image, 64),
    hidden: Boolean(input.hidden ?? previous.hidden),
    createdAt: previous.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function cleanReview(input, previous = {}) {
  const name = str(input.name ?? previous.name, 80);
  const text = str(input.text ?? previous.text, 1200);
  if (!name) throw new HttpError(400, 'Name is required.');
  if (text.length < 10) throw new HttpError(400, 'The review is too short.');
  const rating = Math.round(Number(input.rating ?? previous.rating ?? 5));
  const status = input.status ?? previous.status ?? 'pending';
  return {
    id: previous.id || newId(),
    name,
    role: str(input.role ?? previous.role, 100),
    rating: rating >= 1 && rating <= 5 ? rating : 5,
    text,
    status: status === 'approved' ? 'approved' : 'pending',
    source: previous.source || input.source || 'site',
    createdAt: previous.createdAt || new Date().toISOString()
  };
}

/* ---------- Content document ---------- */
export async function getContent(env) {
  if (!env.SITE_KV) return emptyContent();
  const data = await env.SITE_KV.get('content', 'json');
  const base = emptyContent();
  if (!data || typeof data !== 'object') return base;
  return {
    settings: { ...base.settings, ...(data.settings || {}) },
    projects: Array.isArray(data.projects) ? data.projects : [],
    reviews: Array.isArray(data.reviews) ? data.reviews : []
  };
}

export async function saveContent(env, content) {
  await env.SITE_KV.put('content', JSON.stringify(content));
}

/** What visitors may see: no hidden projects, only approved reviews. */
export function publicContent(content) {
  return {
    settings: content.settings,
    projects: content.projects.filter((p) => !p.hidden),
    reviews: content.reviews
      .filter((r) => r.status === 'approved')
      .map(({ id, name, role, rating, text }) => ({ id, name, role, rating, text }))
  };
}

export function countPending(content) {
  return content.reviews.filter((r) => r.status === 'pending').length;
}
export { MAX_PENDING_REVIEWS };

/* ---------- Leads ---------- */
export async function getLeads(env) {
  const data = await env.SITE_KV.get('leads', 'json');
  return Array.isArray(data) ? data : [];
}

export async function addLead(env, lead) {
  const leads = await getLeads(env);
  leads.unshift(lead);
  await env.SITE_KV.put('leads', JSON.stringify(leads.slice(0, MAX_LEADS)));
}

export async function saveLeads(env, leads) {
  await env.SITE_KV.put('leads', JSON.stringify(leads));
}

/* ---------- Media ---------- */
export async function deleteMedia(env, id) {
  if (id) await env.SITE_KV.delete('media:' + id);
}

/* ---------- Rate limiting ---------- */
export async function rateLimit(env, bucket, limit, ttlSeconds) {
  const key = 'rl:' + bucket;
  const count = parseInt((await env.SITE_KV.get(key)) || '0', 10);
  if (count >= limit) return false;
  await env.SITE_KV.put(key, String(count + 1), { expirationTtl: Math.max(60, ttlSeconds) });
  return true;
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}
