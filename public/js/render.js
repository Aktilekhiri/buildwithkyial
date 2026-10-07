/* ============================================================
   Shared HTML renderers.
   Used in the browser (js/main.js) and on the server
   (functions/index.js) so the portfolio and reviews are in the
   HTML that Google sees, not only after JavaScript runs.
   ============================================================ */

export const CATEGORIES = [
  'Landing page',
  'Business website',
  'Shopify store',
  'Next.js app',
  'UI/UX design',
  'SEO'
];

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only allow http(s) links, everything else becomes an empty string. */
export function safeUrl(url) {
  try {
    const u = new URL(String(url || ''));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch (e) {
    return '';
  }
}

export function mediaUrl(id) {
  return id ? '/api/media/' + encodeURIComponent(id) : '';
}

export function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(function (part) { return part.charAt(0).toUpperCase(); })
    .join('') || '?';
}

export function renderProject(p, index) {
  const img = p.image
    ? '<img src="' + esc(mediaUrl(p.image)) + '" alt="' + esc(p.title + ', ' + (p.category || 'website') + ' screenshot') +
      '" width="1600" height="1000"' + (index > 1 ? ' loading="lazy"' : '') + ' decoding="async">'
    : '<span class="work__placeholder" aria-hidden="true">' + esc(initials(p.title)) + '</span>';

  const year = p.year ? '<span>' + esc(p.year) + '</span>' : '';
  const result = p.result ? '<p class="work__result">' + esc(p.result) + '</p>' : '';

  return (
    '<article class="work" data-category="' + esc(p.category || '') + '" data-id="' + esc(p.id) + '">' +
      '<figure class="work__media">' + img + '</figure>' +
      '<div class="work__meta"><span>' + esc(p.category || '') + '</span>' + year + '</div>' +
      '<h3 class="work__title"><button type="button" class="work__open" data-project="' + esc(p.id) + '" aria-haspopup="dialog">' + esc(p.title) + '</button></h3>' +
      (p.summary ? '<p class="work__summary">' + esc(p.summary) + '</p>' : '') +
      result +
    '</article>'
  );
}

export function renderStars(rating) {
  const n = Math.max(1, Math.min(5, Number(rating) || 5));
  let out = '<div class="review__stars" role="img" aria-label="Rated ' + n + ' out of 5">';
  for (let i = 1; i <= 5; i++) out += i <= n ? '★' : '<span class="off">★</span>';
  return out + '</div>';
}

export function renderReview(r) {
  return (
    '<figure class="review">' +
      renderStars(r.rating) +
      '<blockquote class="review__text">' + esc(r.text) + '</blockquote>' +
      '<figcaption class="review__author">' +
        '<span class="review__avatar" aria-hidden="true">' + esc(initials(r.name)) + '</span>' +
        '<div><strong>' + esc(r.name) + '</strong>' + (r.role ? '<span>' + esc(r.role) + '</span>' : '') + '</div>' +
      '</figcaption>' +
    '</figure>'
  );
}
