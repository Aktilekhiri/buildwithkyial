/* ============================================================
   JSON API for the site and the admin panel.

   Public
     GET    /api/content            settings, visible projects, approved reviews
     GET    /api/media/:id          uploaded image
     POST   /api/contact            contact form message
     POST   /api/reviews            new review (waits for approval)
     POST   /api/auth/login         { password }
     POST   /api/auth/logout
     GET    /api/auth/me

   Admin (signed-in only)
     GET    /api/admin/content
     PUT    /api/admin/settings
     POST   /api/admin/projects            PUT|DELETE /api/admin/projects/:id
     PUT    /api/admin/projects-order      { ids: [] }
     POST   /api/admin/reviews             PUT|DELETE /api/admin/reviews/:id
     GET    /api/admin/leads               PUT|DELETE /api/admin/leads/:id
     POST   /api/admin/media               raw image body, returns { id }
   ============================================================ */
import {
  json, HttpError, newId, str, url,
  getContent, saveContent, publicContent,
  cleanSettings, cleanProject, cleanReview, countPending, MAX_PENDING_REVIEWS,
  getLeads, addLead, saveLeads, deleteMedia, rateLimit, clientIp
} from '../_lib/store.js';
import { isAuthed, safeEqual, createSessionCookie, clearSessionCookie, sameOrigin } from '../_lib/auth.js';

const IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/avif', 'image/gif'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    throw new HttpError(400, 'The request body must be JSON.');
  }
}

export async function onRequest(context) {
  const { request, env, params, waitUntil } = context;
  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const route = parts.join('/');
  const method = request.method.toUpperCase();

  try {
    if (!env.SITE_KV) {
      if (route === 'content' && method === 'GET') return json(publicContent(await getContent(env)));
      throw new HttpError(503, 'Storage is not connected. Add a KV namespace binding named SITE_KV in Cloudflare Pages settings.');
    }

    /* ----- Public ----- */
    if (route === 'content' && method === 'GET') {
      return json(publicContent(await getContent(env)), 200, { 'Cache-Control': 'public, max-age=30' });
    }

    if (parts[0] === 'media' && parts[1] && method === 'GET') {
      return serveMedia(request, env, parts[1], waitUntil);
    }

    if (route === 'contact' && method === 'POST') {
      const body = await readJson(request);
      if (body.company_hp) return json({ ok: true }); // bot filled the hidden field
      const name = str(body.name, 100);
      const email = str(body.email, 160);
      const message = str(body.message, 5000);
      if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpError(400, 'Please add your name, a valid email and a message.');
      }
      if (!(await rateLimit(env, 'contact:' + clientIp(request), 5, 3600))) {
        throw new HttpError(429, 'Too many messages from this connection. Please try again in an hour.');
      }
      await addLead(env, {
        id: newId(),
        name,
        email,
        projectType: str(body.projectType, 60),
        budget: str(body.budget, 60),
        website: url(body.website),
        message,
        read: false,
        createdAt: new Date().toISOString()
      });
      return json({ ok: true }, 201);
    }

    if (route === 'reviews' && method === 'POST') {
      const body = await readJson(request);
      if (body.company_hp) return json({ ok: true });
      if (!body.consent) throw new HttpError(400, 'Please confirm that the review can be published.');
      if (!(await rateLimit(env, 'review:' + clientIp(request), 3, 3600))) {
        throw new HttpError(429, 'Too many reviews from this connection. Please try again later.');
      }
      const content = await getContent(env);
      if (countPending(content) >= MAX_PENDING_REVIEWS) {
        throw new HttpError(429, 'Reviews are paused for a moment. Please try again later.');
      }
      const review = cleanReview({ ...body, status: 'pending', source: 'site' });
      content.reviews.unshift(review);
      await saveContent(env, content);
      return json({ ok: true }, 201);
    }

    /* ----- Auth ----- */
    if (route === 'auth/login' && method === 'POST') {
      if (!env.ADMIN_PASSWORD) throw new HttpError(503, 'Admin password is not set. Add the ADMIN_PASSWORD secret in Cloudflare.');
      const ip = clientIp(request);
      if (!(await rateLimit(env, 'login:' + ip, 10, 900))) {
        throw new HttpError(429, 'Too many attempts. Wait 15 minutes and try again.');
      }
      const body = await readJson(request);
      if (!(await safeEqual(body.password || '', env.ADMIN_PASSWORD))) {
        throw new HttpError(401, 'Wrong password.');
      }
      return json({ ok: true }, 200, { 'Set-Cookie': await createSessionCookie(env) });
    }
    if (route === 'auth/logout' && method === 'POST') {
      return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
    }
    if (route === 'auth/me' && method === 'GET') {
      return json({ authed: await isAuthed(request, env) });
    }

    /* ----- Admin ----- */
    if (parts[0] === 'admin') {
      if (!(await isAuthed(request, env))) throw new HttpError(401, 'Please sign in again.');
      if (method !== 'GET' && !sameOrigin(request)) throw new HttpError(403, 'Request blocked.');
      return await adminRoute(request, env, parts.slice(1), method);
    }

    throw new HttpError(404, 'Not found.');
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    return json({ error: status === 500 ? 'Something went wrong on the server.' : err.message }, status);
  }
}

async function serveMedia(request, env, id, waitUntil) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const { value, metadata } = await env.SITE_KV.getWithMetadata('media:' + id, 'arrayBuffer');
  if (!value) return new Response('Not found', { status: 404 });
  const res = new Response(value, {
    headers: {
      'Content-Type': (metadata && metadata.type) || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  });
  if (waitUntil) waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

async function adminRoute(request, env, parts, method) {
  const [section, id] = parts;

  if (section === 'content' && method === 'GET') {
    const content = await getContent(env);
    return json(content);
  }

  /* Settings and profile */
  if (section === 'settings' && method === 'PUT') {
    const body = await readJson(request);
    const content = await getContent(env);
    const oldPhoto = content.settings.photo;
    content.settings = cleanSettings(body, content.settings);
    await saveContent(env, content);
    if (oldPhoto && oldPhoto !== content.settings.photo) await deleteMedia(env, oldPhoto);
    return json(content.settings);
  }

  /* Projects */
  if (section === 'projects') {
    const content = await getContent(env);
    if (method === 'POST' && !id) {
      const project = cleanProject(await readJson(request));
      content.projects.unshift(project);
      await saveContent(env, content);
      return json(project, 201);
    }
    const index = content.projects.findIndex((p) => p.id === id);
    if (index === -1) throw new HttpError(404, 'Project not found.');
    const previous = content.projects[index];
    if (method === 'PUT') {
      const project = cleanProject(await readJson(request), previous);
      content.projects[index] = project;
      await saveContent(env, content);
      if (previous.image && previous.image !== project.image) await deleteMedia(env, previous.image);
      return json(project);
    }
    if (method === 'DELETE') {
      content.projects.splice(index, 1);
      await saveContent(env, content);
      await deleteMedia(env, previous.image);
      return json({ ok: true });
    }
  }

  if (section === 'projects-order' && method === 'PUT') {
    const { ids } = await readJson(request);
    if (!Array.isArray(ids)) throw new HttpError(400, 'ids must be a list.');
    const content = await getContent(env);
    const byId = new Map(content.projects.map((p) => [p.id, p]));
    const ordered = ids.map((x) => byId.get(x)).filter(Boolean);
    const rest = content.projects.filter((p) => !ids.includes(p.id));
    content.projects = ordered.concat(rest);
    await saveContent(env, content);
    return json({ ok: true });
  }

  /* Reviews */
  if (section === 'reviews') {
    const content = await getContent(env);
    if (method === 'POST' && !id) {
      const review = cleanReview({ ...(await readJson(request)), source: 'admin' });
      content.reviews.unshift(review);
      await saveContent(env, content);
      return json(review, 201);
    }
    const index = content.reviews.findIndex((r) => r.id === id);
    if (index === -1) throw new HttpError(404, 'Review not found.');
    if (method === 'PUT') {
      content.reviews[index] = cleanReview(await readJson(request), content.reviews[index]);
      await saveContent(env, content);
      return json(content.reviews[index]);
    }
    if (method === 'DELETE') {
      content.reviews.splice(index, 1);
      await saveContent(env, content);
      return json({ ok: true });
    }
  }

  /* Leads (contact form inbox) */
  if (section === 'leads') {
    const leads = await getLeads(env);
    if (method === 'GET' && !id) return json(leads);
    const index = leads.findIndex((l) => l.id === id);
    if (index === -1) throw new HttpError(404, 'Message not found.');
    if (method === 'PUT') {
      const body = await readJson(request);
      leads[index].read = Boolean(body.read);
      await saveLeads(env, leads);
      return json(leads[index]);
    }
    if (method === 'DELETE') {
      leads.splice(index, 1);
      await saveLeads(env, leads);
      return json({ ok: true });
    }
  }

  /* Image upload */
  if (section === 'media' && method === 'POST' && !id) {
    const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPES.includes(type)) throw new HttpError(415, 'Upload a WebP, JPEG, PNG, AVIF or GIF image.');
    const data = await request.arrayBuffer();
    if (!data.byteLength) throw new HttpError(400, 'The image is empty.');
    if (data.byteLength > MAX_IMAGE_BYTES) throw new HttpError(413, 'The image is larger than 4 MB.');
    const mediaId = newId();
    await env.SITE_KV.put('media:' + mediaId, data, { metadata: { type, size: data.byteLength } });
    return json({ id: mediaId, url: '/api/media/' + mediaId }, 201);
  }

  throw new HttpError(404, 'Not found.');
}
