/* ============================================================
   Runs before every request.
   - www.buildwithkyial.com  ->  buildwithkyial.com (301)
   - *.pages.dev preview URLs are hidden from search engines so
     Google only indexes the real domain.
   ============================================================ */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    return Response.redirect(url.toString(), 301);
  }

  const response = await context.next();

  if (url.hostname.endsWith('.pages.dev')) {
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return response;
}
