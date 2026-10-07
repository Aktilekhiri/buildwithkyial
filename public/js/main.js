/* ============================================================
   Build with Kyial: front-end behavior
   Navigation, hero build animation, content from the admin panel
   (portfolio, reviews, contacts), dialogs and forms.
   ============================================================ */
import { CATEGORIES, esc, safeUrl, mediaUrl, renderProject, renderReview } from './render.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Header and mobile menu ---------- */
const header = $('#header');
const onScrollHeader = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScrollHeader, { passive: true });
onScrollHeader();

const burger = $('#burger');
const nav = $('#nav');
function toggleMenu(force) {
  const open = typeof force === 'boolean' ? force : !nav.classList.contains('is-open');
  nav.classList.toggle('is-open', open);
  burger.classList.toggle('is-open', open);
  document.body.classList.toggle('no-scroll', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
if (burger && nav) {
  burger.addEventListener('click', () => toggleMenu());
  $$('a', nav).forEach((a) => a.addEventListener('click', () => toggleMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) toggleMenu(false); });
}

/* ---------- Active nav link while scrolling ---------- */
const navLinks = $$('.nav__link');
const spyTargets = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window && spyTargets.length) {
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  spyTargets.forEach((s) => spy.observe(s));
}

/* ---------- Hero: the browser window builds a site ---------- */
(function heroBuild() {
  const build = $('.build');
  if (!build) return;
  const typed = $('.build__typed', build);
  const blocks = $$('.b', build);
  const url = typed ? typed.dataset.url : '';

  const finish = () => {
    if (typed) typed.textContent = url;
    blocks.forEach((b) => b.classList.add('is-in'));
    build.classList.add('is-designed', 'is-done');
  };
  if (reduceMotion) { finish(); return; }

  let i = 0;
  const typeNext = () => {
    if (!typed) return;
    typed.textContent = url.slice(0, ++i);
    if (i < url.length) setTimeout(typeNext, 55 + Math.random() * 40);
  };
  setTimeout(typeNext, 450);
  blocks.forEach((b, n) => setTimeout(() => b.classList.add('is-in'), 600 + n * 70));
  const designAt = 600 + blocks.length * 70 + 450;
  setTimeout(() => build.classList.add('is-designed'), designAt);
  setTimeout(() => build.classList.add('is-done'), designAt + 650);
})();

/* ---------- Content from the admin panel ---------- */
const ICONS = {
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2c-1.6 0-3.2-.4-4.6-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.6-1.4.1-.2 0-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3c.3-1.2-.9-2.2-2-1.7L2.6 9.2c-1.2.5-1.2 2.2.1 2.6l4.4 1.4 1.6 5.1c.3 1 1.6 1.3 2.3.5l2.3-2.4 4.3 3.2c.9.6 2.1.2 2.4-.9l3.9-14.4zM8 13.3l10.7-6.9c.3-.2.6.2.3.4l-8.6 8.1-.3 3.1-2.1-4.7z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 110-4.2 2.1 2.1 0 010 4.2zM7.1 20.5H3.6V9h3.5v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .5z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>',
  upwork: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.6 13.3c-1.1 0-2.1-.5-3-1.2l.2-1v-.1c.2-1.1.8-2.9 2.8-2.9a2.6 2.6 0 010 5.2zm0-7.8c-2.6 0-4.5 1.7-5.4 4.4-1.2-1.8-2.2-4-2.8-5.9H7.7v7.2a2.5 2.5 0 01-5 0V4H0v7.2a5.1 5.1 0 0010.2 0V10c.5 1.1 1.2 2.2 1.9 3.2l-1.6 7.7h2.7l1.2-5.6c1 .7 2.2 1.1 3.6 1.1a5.4 5.4 0 000-10.9z"/></svg>'
};

const CONTACTS = [
  { key: 'email', label: 'Email', href: (v) => 'mailto:' + v, text: (v) => v },
  { key: 'phone', label: 'Phone', href: (v) => 'tel:' + v.replace(/[^\d+]/g, ''), text: (v) => v },
  { key: 'whatsapp', label: 'WhatsApp', href: (v) => 'https://wa.me/' + v.replace(/\D/g, ''), text: () => 'Message on WhatsApp', external: true },
  { key: 'telegram', label: 'Telegram', href: (v) => 'https://t.me/' + v.replace(/^@/, ''), text: (v) => '@' + v.replace(/^@/, ''), external: true },
  { key: 'linkedin', label: 'LinkedIn', href: (v) => safeUrl(v), text: () => 'View profile', external: true }
];
const SOCIALS = ['linkedin', 'github', 'upwork', 'instagram', 'whatsapp', 'telegram'];

function socialHref(key, v) {
  if (key === 'whatsapp') return 'https://wa.me/' + v.replace(/\D/g, '');
  if (key === 'telegram') return 'https://t.me/' + v.replace(/^@/, '');
  return safeUrl(v);
}

let state = { settings: {}, projects: [], reviews: [] };

function readInitial() {
  try {
    const el = $('#initial-content');
    const data = el ? JSON.parse(el.textContent) : null;
    return data && typeof data === 'object' ? data : null;
  } catch (e) { return null; }
}

async function loadContent() {
  const initial = readInitial();
  if (initial) return initial;
  try {
    const res = await fetch('/api/content', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (e) {
    return { settings: {}, projects: [], reviews: [] };
  }
}

function applySettings(s) {
  // Availability line in the hero
  const status = $('#availability');
  if (status) {
    status.classList.toggle('is-busy', s.available === false);
    const text = $('[data-availability-text]', status);
    if (text && s.availabilityText) text.textContent = s.availabilityText;
  }

  // Calendly or another booking link
  const calendly = safeUrl(s.calendly);
  const calendlyBtn = $('#calendly-link');
  if (calendly) {
    if (calendlyBtn) { calendlyBtn.href = calendly; calendlyBtn.hidden = false; }
    $$('[data-book-call]').forEach((a) => { a.href = calendly; a.target = '_blank'; a.rel = 'noopener'; });
  }

  // Contact list
  const list = $('#contact-list');
  if (list) {
    list.innerHTML = CONTACTS.filter((c) => s[c.key]).map((c) => {
      const v = String(s[c.key]).trim();
      const href = c.href(v);
      if (!href) return '';
      return '<li><span class="contact__icon" aria-hidden="true">' + ICONS[c.key] + '</span><div><small>' + c.label +
        '</small><a href="' + esc(href) + '"' + (c.external ? ' target="_blank" rel="noopener"' : '') + '>' + esc(c.text(v)) + '</a></div></li>';
    }).join('');
  }

  // Footer social icons
  const socials = $('#socials');
  if (socials) {
    socials.innerHTML = SOCIALS.filter((k) => s[k]).map((k) => {
      const href = socialHref(k, String(s[k]).trim());
      if (!href) return '';
      const name = k === 'github' ? 'GitHub' : k === 'linkedin' ? 'LinkedIn' : k.charAt(0).toUpperCase() + k.slice(1);
      return '<li><a href="' + esc(href) + '" target="_blank" rel="noopener" aria-label="' + name + '">' + ICONS[k] + '</a></li>';
    }).join('');
  }

  // Portrait in the About section
  const photo = $('#about-photo');
  if (photo && s.photo && !photo.querySelector('img')) {
    const img = new Image();
    img.alt = 'Kyial Ibraeva, freelance web developer';
    img.width = 800; img.height = 1000;
    img.loading = 'lazy';
    img.src = mediaUrl(s.photo);
    img.onload = () => { const m = $('.about__monogram', photo); if (m) m.remove(); };
    photo.prepend(img);
  }
}

/* ---------- Portfolio ---------- */
const grid = $('#work-grid');
const filters = $('#work-filters');

function renderWork(projects) {
  if (!grid) return;
  grid.innerHTML = projects.map(renderProject).join('');
  $('#work-empty').hidden = projects.length > 0;

  const used = CATEGORIES.filter((c) => projects.some((p) => p.category === c));
  const extra = [...new Set(projects.map((p) => p.category).filter((c) => c && !CATEGORIES.includes(c)))];
  const cats = used.concat(extra);
  if (filters) {
    filters.hidden = cats.length < 2;
    filters.innerHTML = ['All'].concat(cats).map((c, i) =>
      '<button type="button" class="filter" data-filter="' + esc(c) + '" aria-pressed="' + (i === 0) + '">' + esc(c) + '</button>'
    ).join('');
  }
}

if (filters) {
  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    const cat = btn.dataset.filter;
    $$('.filter', filters).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    $$('.work', grid).forEach((card) => {
      const show = cat === 'All' || card.dataset.category === cat;
      card.classList.toggle('is-hidden', !show);
      card.classList.remove('is-entering');
      if (show && !reduceMotion) { void card.offsetWidth; card.classList.add('is-entering'); }
    });
  });
}

/* ---------- Dialogs ---------- */
function openDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  document.body.classList.add('no-scroll');
}
function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}
$$('dialog.modal').forEach((d) => {
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-close]')) closeDialog(d);
  });
  d.addEventListener('close', () => document.body.classList.remove('no-scroll'));
});

const projectModal = $('#project-modal');
if (grid) {
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-project]');
    if (!btn) return;
    const p = state.projects.find((x) => x.id === btn.dataset.project);
    if (!p) return;
    const link = safeUrl(p.url);
    const tags = (p.tags || []).filter(Boolean);
    $('#project-modal-body').innerHTML =
      (p.image ? '<figure class="pm__media"><img src="' + esc(mediaUrl(p.image)) + '" alt="' + esc(p.title) + ' screenshot"></figure>' : '') +
      '<p class="pm__meta">' + esc([p.category, p.client, p.year].filter(Boolean).join(', ')) + '</p>' +
      '<h2 id="pm-title">' + esc(p.title) + '</h2>' +
      (p.result ? '<p class="work__result">' + esc(p.result) + '</p>' : '') +
      '<p class="pm__desc">' + esc(p.description || p.summary || '') + '</p>' +
      (tags.length ? '<ul class="pm__tags" aria-label="Built with">' + tags.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') +
      (link ? '<a class="btn btn--primary" href="' + esc(link) + '" target="_blank" rel="noopener">Visit the live site</a>' : '');
    openDialog(projectModal);
  });
}

/* ---------- Reviews ---------- */
function renderReviews(reviews) {
  const list = $('#reviews-list');
  if (!list) return;
  list.innerHTML = reviews.map(renderReview).join('');
  $('#reviews-empty').hidden = reviews.length > 0;
}

const reviewModal = $('#review-modal');
$$('[data-open-review]').forEach((b) => b.addEventListener('click', () => openDialog(reviewModal)));

/* ---------- Forms ---------- */
function validate(form, fields) {
  let ok = true;
  let first = null;
  fields.forEach((name) => {
    const input = form.elements[name];
    if (!input) return;
    let valid = input.type === 'checkbox' ? input.checked : input.value.trim() !== '';
    if (valid && input.type === 'email') valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
    if (valid && input.type === 'url' && input.value.trim()) valid = /^https?:\/\/\S+\.\S+/.test(input.value.trim());
    input.toggleAttribute('aria-invalid', !valid);
    if (!valid) { ok = false; first = first || input; }
  });
  if (first) first.focus();
  return ok;
}

function setStatus(el, text, kind) {
  el.textContent = text;
  el.classList.toggle('is-ok', kind === 'ok');
  el.classList.toggle('is-error', kind === 'error');
}

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed (' + res.status + ')');
  return body;
}

$$('.form input, .form textarea, .form select').forEach((el) =>
  el.addEventListener('input', () => el.removeAttribute('aria-invalid')));

const contactForm = $('#contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#contact-status');
    const fields = ['name', 'email', 'message'];
    if (contactForm.elements.website.value.trim()) fields.push('website');
    if (!validate(contactForm, fields)) {
      setStatus(status, 'Please fill in the highlighted fields.', 'error');
      return;
    }
    const data = Object.fromEntries(new FormData(contactForm).entries());
    const btn = $('.form__submit', contactForm);
    btn.disabled = true;
    setStatus(status, 'Sending…');

    let saved = false;
    let mailed = false;
    try { await postJSON('/api/contact', data); saved = true; } catch (err) { /* handled below */ }

    // Email notification through Web3Forms (access key is set in the admin panel)
    const key = state.settings.web3formsKey;
    if (key && !data.company_hp) {
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: key,
            subject: 'New project inquiry from ' + data.name,
            from_name: 'buildwithkyial.com',
            replyto: data.email,
            name: data.name,
            email: data.email,
            'Project type': data.projectType,
            Budget: data.budget,
            'Current website': data.website || '-',
            message: data.message
          })
        });
        mailed = res.ok;
      } catch (err) { /* handled below */ }
    }

    btn.disabled = false;
    if (saved || mailed) {
      contactForm.reset();
      setStatus(status, "Message sent. I'll reply within one business day.", 'ok');
    } else {
      const email = state.settings.email;
      setStatus(status, 'The message did not send. Check your connection and try again' + (email ? ', or email ' + email + '.' : '.'), 'error');
    }
  });
}

const reviewForm = $('#review-form');
if (reviewForm) {
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#review-status');
    if (!validate(reviewForm, ['name', 'text', 'consent'])) {
      setStatus(status, 'Please fill in your name, your review and the consent box.', 'error');
      return;
    }
    const data = Object.fromEntries(new FormData(reviewForm).entries());
    data.consent = true;
    const btn = $('.form__submit', reviewForm);
    btn.disabled = true;
    setStatus(status, 'Submitting…');
    try {
      await postJSON('/api/reviews', data);
      reviewForm.reset();
      setStatus(status, 'Review submitted. It will appear on the site once it is approved. Thank you!', 'ok');
    } catch (err) {
      setStatus(status, err.message || 'The review did not submit. Try again in a minute.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------- Start ---------- */
const year = $('#year');
if (year) year.textContent = String(new Date().getFullYear());

loadContent().then((data) => {
  state = {
    settings: data.settings || {},
    projects: Array.isArray(data.projects) ? data.projects : [],
    reviews: Array.isArray(data.reviews) ? data.reviews : []
  };
  applySettings(state.settings);
  renderWork(state.projects);
  renderReviews(state.reviews);
});
