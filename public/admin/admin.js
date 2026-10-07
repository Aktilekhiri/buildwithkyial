/* ============================================================
   Admin panel: portfolio, reviews, messages, profile.
   ============================================================ */
import { CATEGORIES, esc, mediaUrl, safeUrl } from '/js/render.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let content = { settings: {}, projects: [], reviews: [] };
let leads = [];

/* ---------- API ---------- */
async function api(path, options = {}) {
  const opts = { credentials: 'same-origin', headers: { Accept: 'application/json' }, ...options };
  if (options.json !== undefined) {
    opts.body = JSON.stringify(options.json);
    opts.headers['Content-Type'] = 'application/json';
    delete opts.json;
  }
  const res = await fetch('/api/' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('auth/')) { showLogin('Your session ended. Please sign in again.'); throw new Error('Signed out'); }
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}

let toastTimer;
function toast(text, isError) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.toggle('is-error', Boolean(isError));
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 3200);
}

function setMsg(el, text, kind) {
  el.textContent = text || '';
  el.className = 'msg' + (kind ? ' is-' + kind : '');
}

/* ---------- Images: resize and compress in the browser before upload ---------- */
async function compressImage(file, maxW, maxH) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bitmap.width, maxH / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const toBlob = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));
  let blob = await toBlob('image/webp', 0.84);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.85);
  return blob;
}

async function uploadImage(file, maxW, maxH) {
  const blob = await compressImage(file, maxW, maxH);
  const res = await fetch('/api/admin/media', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': blob.type },
    body: blob
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed.');
  return data.id;
}

function previewInto(el, id, emptyText) {
  el.innerHTML = id ? '<img src="' + esc(mediaUrl(id)) + '" alt="">' : '<span>' + esc(emptyText) + '</span>';
}

/* ---------- Views ---------- */
function showLogin(message) {
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  setMsg($('#login-msg'), message || '', message ? 'error' : '');
  $('#login-form [name=password]').focus();
}

async function showApp() {
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  await reload();
}

async function reload() {
  const [c, l] = await Promise.all([api('admin/content'), api('admin/leads')]);
  content = c;
  leads = l;
  renderAll();
}

function renderAll() {
  renderProjects();
  renderReviews();
  renderLeads();
  renderSettings();
  const pending = content.reviews.filter((r) => r.status === 'pending').length;
  const unread = leads.filter((l) => !l.read).length;
  $('#badge-reviews').hidden = !pending;
  $('#badge-reviews').textContent = pending;
  $('#badge-leads').hidden = !unread;
  $('#badge-leads').textContent = unread;
}

/* ---------- Tabs ---------- */
$$('.tab').forEach((tab) => tab.addEventListener('click', () => {
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
  $$('.panel').forEach((p) => { p.hidden = p.id !== 'panel-' + tab.dataset.tab; });
  history.replaceState(null, '', '#' + tab.dataset.tab);
}));

/* ---------- Portfolio ---------- */
function renderProjects() {
  const list = $('#projects-list');
  if (!content.projects.length) {
    list.innerHTML = '<div class="empty">No projects yet. Select “Add project” to publish your first case study.</div>';
    return;
  }
  list.innerHTML = content.projects.map((p, i) =>
    '<div class="row" data-id="' + esc(p.id) + '">' +
      '<div class="thumb">' + (p.image ? '<img src="' + esc(mediaUrl(p.image)) + '" alt="">' : 'No image') + '</div>' +
      '<div><div class="row__title">' + esc(p.title) + (p.hidden ? '<span class="pill">Hidden</span>' : '') + '</div>' +
      '<div class="row__meta">' + esc([p.category, p.client, p.year].filter(Boolean).join(', ') || 'No category') + '</div></div>' +
      '<div class="row__actions">' +
        '<button class="icon-btn" data-act="up" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="icon-btn" data-act="down" aria-label="Move down"' + (i === content.projects.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="btn btn--ghost btn--sm" data-act="edit">Edit</button>' +
        '<button class="btn btn--danger btn--sm" data-act="delete">Delete</button>' +
      '</div>' +
    '</div>'
  ).join('');
}

$('#projects-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('.row').dataset.id;
  const index = content.projects.findIndex((p) => p.id === id);
  const project = content.projects[index];
  const act = btn.dataset.act;

  if (act === 'edit') return openProject(project);
  if (act === 'delete') {
    if (!confirm('Delete “' + project.title + '”? This cannot be undone.')) return;
    try { await api('admin/projects/' + id, { method: 'DELETE' }); content.projects.splice(index, 1); renderAll(); toast('Project deleted'); }
    catch (err) { toast(err.message, true); }
    return;
  }
  if (act === 'up' || act === 'down') {
    const to = act === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= content.projects.length) return;
    const items = content.projects.slice();
    [items[index], items[to]] = [items[to], items[index]];
    content.projects = items;
    renderProjects();
    try { await api('admin/projects-order', { method: 'PUT', json: { ids: items.map((p) => p.id) } }); }
    catch (err) { toast(err.message, true); }
  }
});

const projectDialog = $('#project-dialog');
const projectForm = $('#project-form');

function fillCategories(selected) {
  const options = CATEGORIES.slice();
  if (selected && !options.includes(selected)) options.push(selected);
  $('#category-select').innerHTML = options.map((c) =>
    '<option' + (c === selected ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
}

function openProject(project) {
  const p = project || {};
  projectForm.reset();
  $('#pd-title').textContent = project ? 'Edit project' : 'Add project';
  fillCategories(p.category || CATEGORIES[0]);
  ['id', 'title', 'client', 'year', 'summary', 'result', 'description', 'url', 'image'].forEach((k) => {
    projectForm.elements[k].value = p[k] || '';
  });
  projectForm.elements.tags.value = (p.tags || []).join(', ');
  projectForm.elements.hidden.checked = Boolean(p.hidden);
  previewInto($('#image-preview'), p.image, 'No image yet');
  setMsg($('#project-msg'));
  projectDialog.showModal();
}

$('#add-project').addEventListener('click', () => openProject(null));

$('#image-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const msg = $('#project-msg');
  setMsg(msg, 'Uploading image…');
  try {
    const id = await uploadImage(file, 1600, 1600);
    projectForm.elements.image.value = id;
    previewInto($('#image-preview'), id);
    setMsg(msg, 'Image uploaded. Save the project to keep it.', 'ok');
  } catch (err) { setMsg(msg, err.message, 'error'); }
});
$('#image-remove').addEventListener('click', () => {
  projectForm.elements.image.value = '';
  previewInto($('#image-preview'), '', 'No image yet');
});

projectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = projectForm.elements;
  const msg = $('#project-msg');
  if (!f.title.value.trim()) { setMsg(msg, 'Add a project name.', 'error'); f.title.focus(); return; }
  if (f.url.value.trim() && !safeUrl(f.url.value.trim())) { setMsg(msg, 'The live site URL must start with https://', 'error'); f.url.focus(); return; }
  const data = {
    title: f.title.value, category: f.category.value, client: f.client.value, year: f.year.value,
    summary: f.summary.value, result: f.result.value, description: f.description.value,
    tags: f.tags.value, url: f.url.value.trim(), image: f.image.value, hidden: f.hidden.checked
  };
  const btn = projectForm.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    const id = f.id.value;
    const saved = await api(id ? 'admin/projects/' + id : 'admin/projects', { method: id ? 'PUT' : 'POST', json: data });
    if (id) content.projects = content.projects.map((p) => (p.id === id ? saved : p));
    else content.projects.unshift(saved);
    renderAll();
    projectDialog.close();
    toast(id ? 'Project updated' : 'Project added');
  } catch (err) { setMsg(msg, err.message, 'error'); }
  finally { btn.disabled = false; }
});

/* ---------- Reviews ---------- */
function reviewRow(r) {
  const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
  const date = new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return '<div class="row row--text" data-id="' + esc(r.id) + '">' +
    '<div><div class="row__title">' + esc(r.name) + ' <span class="stars" aria-label="' + r.rating + ' stars">' + stars + '</span></div>' +
    '<div class="row__meta">' + esc([r.role, date, r.source === 'admin' ? 'added by you' : 'sent from the site'].filter(Boolean).join(', ')) + '</div>' +
    '<p class="row__text">' + esc(r.text) + '</p></div>' +
    '<div class="row__actions">' +
      (r.status === 'pending'
        ? '<button class="btn btn--primary btn--sm" data-act="approve">Approve</button>'
        : '<button class="btn btn--ghost btn--sm" data-act="unpublish">Unpublish</button>') +
      '<button class="btn btn--ghost btn--sm" data-act="edit">Edit</button>' +
      '<button class="btn btn--danger btn--sm" data-act="delete">Delete</button>' +
    '</div></div>';
}

function renderReviews() {
  const pending = content.reviews.filter((r) => r.status === 'pending');
  const approved = content.reviews.filter((r) => r.status === 'approved');
  $('#reviews-pending').innerHTML = pending.length ? pending.map(reviewRow).join('') : '<div class="empty">No new reviews to check.</div>';
  $('#reviews-approved').innerHTML = approved.length ? approved.map(reviewRow).join('') : '<div class="empty">Nothing published yet.</div>';
}

$('#panel-reviews').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || !btn.closest('.row')) return;
  const id = btn.closest('.row').dataset.id;
  const review = content.reviews.find((r) => r.id === id);
  const act = btn.dataset.act;
  try {
    if (act === 'edit') return openReview(review);
    if (act === 'delete') {
      if (!confirm('Delete the review from ' + review.name + '?')) return;
      await api('admin/reviews/' + id, { method: 'DELETE' });
      content.reviews = content.reviews.filter((r) => r.id !== id);
      toast('Review deleted');
    } else {
      const status = act === 'approve' ? 'approved' : 'pending';
      const saved = await api('admin/reviews/' + id, { method: 'PUT', json: { status } });
      content.reviews = content.reviews.map((r) => (r.id === id ? saved : r));
      toast(status === 'approved' ? 'Review published' : 'Review hidden');
    }
    renderAll();
  } catch (err) { toast(err.message, true); }
});

const reviewDialog = $('#review-dialog');
const reviewForm = $('#review-form');

function openReview(review) {
  const r = review || {};
  reviewForm.reset();
  $('#rd-title').textContent = review ? 'Edit review' : 'Add a review';
  reviewForm.elements.id.value = r.id || '';
  reviewForm.elements.name.value = r.name || '';
  reviewForm.elements.role.value = r.role || '';
  reviewForm.elements.rating.value = String(r.rating || 5);
  reviewForm.elements.text.value = r.text || '';
  reviewForm.elements.approved.checked = review ? r.status === 'approved' : true;
  setMsg($('#review-msg'));
  reviewDialog.showModal();
}
$('#add-review').addEventListener('click', () => openReview(null));

reviewForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = reviewForm.elements;
  const data = { name: f.name.value, role: f.role.value, rating: Number(f.rating.value), text: f.text.value, status: f.approved.checked ? 'approved' : 'pending' };
  try {
    const id = f.id.value;
    const saved = await api(id ? 'admin/reviews/' + id : 'admin/reviews', { method: id ? 'PUT' : 'POST', json: data });
    if (id) content.reviews = content.reviews.map((r) => (r.id === id ? saved : r));
    else content.reviews.unshift(saved);
    renderAll();
    reviewDialog.close();
    toast('Review saved');
  } catch (err) { setMsg($('#review-msg'), err.message, 'error'); }
});

/* ---------- Messages ---------- */
function renderLeads() {
  const list = $('#leads-list');
  if (!leads.length) { list.innerHTML = '<div class="empty">No messages yet. They appear here when someone sends the contact form.</div>'; return; }
  list.innerHTML = leads.map((l) => {
    const date = new Date(l.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const site = safeUrl(l.website);
    return '<div class="row row--text' + (l.read ? '' : ' is-unread') + '" data-id="' + esc(l.id) + '">' +
      '<div><div class="row__title">' + esc(l.name) + ' <a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a></div>' +
      '<div class="row__meta">' + esc([l.projectType, l.budget, date].filter(Boolean).join(', ')) +
      (site ? ', <a href="' + esc(site) + '" target="_blank" rel="noopener">' + esc(site) + '</a>' : '') + '</div>' +
      '<p class="row__text">' + esc(l.message) + '</p></div>' +
      '<div class="row__actions">' +
        '<a class="btn btn--primary btn--sm" href="mailto:' + esc(l.email) + '?subject=' + encodeURIComponent('Re: your project') + '">Reply</a>' +
        '<button class="btn btn--ghost btn--sm" data-act="read">' + (l.read ? 'Mark unread' : 'Mark read') + '</button>' +
        '<button class="btn btn--danger btn--sm" data-act="delete">Delete</button>' +
      '</div></div>';
  }).join('');
}

$('#leads-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('.row').dataset.id;
  const lead = leads.find((l) => l.id === id);
  try {
    if (btn.dataset.act === 'delete') {
      if (!confirm('Delete the message from ' + lead.name + '?')) return;
      await api('admin/leads/' + id, { method: 'DELETE' });
      leads = leads.filter((l) => l.id !== id);
    } else {
      const saved = await api('admin/leads/' + id, { method: 'PUT', json: { read: !lead.read } });
      leads = leads.map((l) => (l.id === id ? saved : l));
    }
    renderAll();
  } catch (err) { toast(err.message, true); }
});

/* ---------- Profile and contacts ---------- */
const settingsForm = $('#settings-form');
let photoId = '';

function renderSettings() {
  const s = content.settings || {};
  const f = settingsForm.elements;
  f.available.checked = s.available !== false;
  ['availabilityText', 'email', 'phone', 'whatsapp', 'telegram', 'linkedin', 'github', 'upwork', 'instagram', 'calendly', 'web3formsKey']
    .forEach((k) => { f[k].value = s[k] || ''; });
  photoId = s.photo || '';
  previewInto($('#photo-preview'), photoId, 'No photo');
}

$('#photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const msg = $('#settings-msg');
  setMsg(msg, 'Uploading photo…');
  try {
    photoId = await uploadImage(file, 1000, 1250);
    previewInto($('#photo-preview'), photoId);
    setMsg(msg, 'Photo uploaded. Select “Save changes” to publish it.', 'ok');
  } catch (err) { setMsg(msg, err.message, 'error'); }
});
$('#photo-remove').addEventListener('click', () => {
  photoId = '';
  previewInto($('#photo-preview'), '', 'No photo');
  setMsg($('#settings-msg'), 'Select “Save changes” to remove the photo from the site.');
});

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = settingsForm.elements;
  const msg = $('#settings-msg');
  const data = { available: f.available.checked, photo: photoId };
  ['availabilityText', 'email', 'phone', 'whatsapp', 'telegram', 'linkedin', 'github', 'upwork', 'instagram', 'calendly', 'web3formsKey']
    .forEach((k) => { data[k] = f[k].value.trim(); });
  for (const k of ['linkedin', 'github', 'upwork', 'instagram', 'calendly']) {
    if (data[k] && !safeUrl(data[k])) { setMsg(msg, 'Links must start with https://', 'error'); f[k].focus(); return; }
  }
  try {
    content.settings = await api('admin/settings', { method: 'PUT', json: data });
    renderSettings();
    setMsg(msg, 'Saved. Changes are live within a minute.', 'ok');
  } catch (err) { setMsg(msg, err.message, 'error'); }
});

/* ---------- Dialog close buttons ---------- */
$$('dialog').forEach((d) => d.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) d.close();
}));

/* ---------- Sign in / out ---------- */
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#login-msg');
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  setMsg(msg, '');
  try {
    await api('auth/login', { method: 'POST', json: { password: e.target.elements.password.value } });
    e.target.reset();
    await showApp();
  } catch (err) { setMsg(msg, err.message, 'error'); }
  finally { btn.disabled = false; }
});

$('#logout').addEventListener('click', async () => {
  await api('auth/logout', { method: 'POST' }).catch(() => {});
  showLogin();
});

/* ---------- Start ---------- */
(async function start() {
  const initialTab = location.hash.slice(1);
  const tab = $('.tab[data-tab="' + initialTab + '"]');
  if (tab) tab.click();
  try {
    const me = await api('auth/me');
    if (me.authed) await showApp();
    else showLogin();
  } catch (err) {
    showLogin(err.message);
  }
})();
