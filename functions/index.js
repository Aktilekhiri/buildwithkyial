/* ============================================================
   Home page with content rendered on the server.
   Takes public/index.html and fills in the portfolio, reviews and
   social profile links from KV, so search engines and link
   previews see real content without running JavaScript.
   ============================================================ */
import { renderProject, renderReview, safeUrl } from '../public/js/render.js';
import { getContent, publicContent } from './_lib/store.js';

function sameAsLinks(settings) {
  const links = ['linkedin', 'github', 'upwork', 'instagram'].map((k) => safeUrl(settings[k])).filter(Boolean);
  if (settings.telegram) links.push('https://t.me/' + String(settings.telegram).replace(/^@/, ''));
  return links;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const page = await env.ASSETS.fetch(request);
  const type = page.headers.get('Content-Type') || '';
  if (!page.ok || !type.includes('text/html')) return page;

  let data;
  try {
    data = publicContent(await getContent(env));
  } catch (e) {
    return page; // storage problem: serve the static page, the browser will try again
  }

  const workHtml = data.projects.map(renderProject).join('');
  const reviewsHtml = data.reviews.map(renderReview).join('');
  const initial = JSON.stringify(data).replace(/</g, '\\u003c');
  const sameAs = sameAsLinks(data.settings);

  const ld = sameAs.length
    ? '<script type="application/ld+json">' +
      JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', '@id': 'https://buildwithkyial.com/#person', sameAs }).replace(/</g, '\\u003c') +
      '</script>'
    : '';

  const rewritten = new HTMLRewriter()
    .on('#work-grid', { element(el) { el.setInnerContent(workHtml, { html: true }); } })
    .on('#work-empty', { element(el) { if (!data.projects.length) el.removeAttribute('hidden'); } })
    .on('#reviews-list', { element(el) { el.setInnerContent(reviewsHtml, { html: true }); } })
    .on('#reviews-empty', { element(el) { if (!data.reviews.length) el.removeAttribute('hidden'); } })
    .on('#initial-content', { element(el) { el.setInnerContent(initial, { html: true }); } })
    .on('head', { element(el) { if (ld) el.append(ld, { html: true }); } })
    .transform(page);

  const headers = new Headers(rewritten.headers);
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.delete('ETag');
  return new Response(rewritten.body, { status: rewritten.status, headers });
}
