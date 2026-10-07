/* ============================================================
   Worker entry point (used when the site runs as a Cloudflare
   Worker). Reuses the same handlers as the Pages version:
     /api/*  -> functions/api/[[path]].js
     /       -> functions/index.js (server-rendered home page)
     other   -> static files from /public
   ============================================================ */
import { onRequest as apiHandler } from '../functions/api/[[path]].js';
import { onRequestGet as homeHandler } from '../functions/index.js';

function withNoindex(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // www.buildwithkyial.com -> buildwithkyial.com
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    const context = { request, env, params: {}, waitUntil: (p) => ctx.waitUntil(p) };
    let response;

    if (url.pathname.startsWith('/api/')) {
      context.params.path = url.pathname.slice(5).split('/').filter(Boolean).map(decodeURIComponent);
      response = await apiHandler(context);
    } else if (url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
      response = await homeHandler(context);
    } else {
      response = await env.ASSETS.fetch(request);
    }

    // Preview addresses (*.workers.dev, *.pages.dev) stay out of Google
    if (url.hostname.endsWith('.workers.dev') || url.hostname.endsWith('.pages.dev')) {
      response = withNoindex(response);
    }
    return response;
  }
};
