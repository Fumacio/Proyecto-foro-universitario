const API_BASE = '/api';

// Errores del middleware de auth → la sesión ya no sirve (secret rotado, token viejo, expirado)
function isSessionExpiredError(status, message) {
  if (status !== 401) return false;
  return /token|sesión expirada|sesion expirada|usuario no encontrado/i.test(message || '');
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  } catch {
    throw { status: 0, error: 'No se pudo conectar con el servidor' };
  }
  const data = await res.json().catch(() => ({}));

  // Sesión inválida → limpiar y volver al login (evita quedarse "logueado" con token muerto)
  if (token && isSessionExpiredError(res.status, data.error)) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.setItem('authMsg', data.error || 'Tu sesión expiró. Iniciá sesión nuevamente.');
    if (!window.location.pathname.includes('login')) {
      localStorage.setItem('returnUrl', window.location.pathname + window.location.search);
      window.location.href = '/login.html';
    }
    throw { status: res.status, ...data };
  }

  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

const api = {
  get: (url) => request(url),
  post: (url, body) => request(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => request(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url, body) => request(url, { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) }),
  upload: (url, formData) => request(url, { method: 'POST', body: formData })
};

/** Primer mensaje útil de un error de la API (incluye el detalle de validación si lo hay) */
function errorMessage(err, fallback) {
  if (err && Array.isArray(err.details) && err.details.length > 0) return err.details[0].message;
  return (err && err.error) || fallback;
}

function getUser() {
  try {
    const data = localStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function isLoggedIn() {
  return !!localStorage.getItem('token');
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

/** Escapa texto para insertarlo en HTML, también dentro de atributos ("...") */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Solo deja pasar URLs relativas del propio sitio (las imágenes que sirve /uploads) */
function safeUrl(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? escapeHtml(url) : '';
}

/** Solo colores hex (los tags los define un admin, pero igual van dentro de un style="") */
function safeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#F99B4A';
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'recién';
  const units = [
    ['año', 'años', 31536000], ['mes', 'meses', 2592000], ['día', 'días', 86400],
    ['h', 'h', 3600], ['min', 'min', 60]
  ];
  for (const [one, many, size] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `hace ${n} ${n === 1 ? one : many}`;
  }
  return date.toLocaleDateString('es-AR');
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function pluralize(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/* ---------- Toasts (reemplazan a alert()) ---------- */

function toast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-hide');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/* ---------- Modales ---------- */

function openModal(innerHtml, { id = 'modal-overlay', maxWidth = 440 } = {}) {
  closeModal(id);
  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="max-width: ${maxWidth}px">${innerHtml}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(id);
  });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      closeModal(id);
      document.removeEventListener('keydown', onKey);
    }
  });
  document.body.appendChild(overlay);
  const focusable = overlay.querySelector('input, textarea, select, button');
  if (focusable) focusable.focus();
  return overlay;
}

function closeModal(id = 'modal-overlay') {
  const overlay = document.getElementById(id);
  if (overlay) overlay.remove();
}

function showLoginPrompt(action) {
  localStorage.setItem('returnUrl', window.location.pathname + window.location.search);
  openModal(`
    <h3 class="text-lg font-bold text-primary mb-2">Necesitás una cuenta</h3>
    <p class="text-secondary text-sm mb-6">Para ${escapeHtml(action)} tenés que iniciar sesión.</p>
    <div class="flex gap-2 justify-end">
      <button onclick="closeModal()" class="btn-ghost px-4 py-2 rounded-full text-sm">Cancelar</button>
      <a href="/register.html" class="btn-secondary px-4 py-2 rounded-full text-sm font-medium">Registrarme</a>
      <a href="/login.html" class="btn-primary px-4 py-2 rounded-full text-sm font-medium">Iniciar sesión</a>
    </div>
  `, { id: 'login-prompt-overlay' });
}

function closeLoginPrompt() {
  closeModal('login-prompt-overlay');
}

/** Diálogo de confirmación con estilo propio. Devuelve una promesa con true/false. */
function confirmDialog(message, { confirmText = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = openModal(`
      <p class="text-primary mb-6">${escapeHtml(message)}</p>
      <div class="flex gap-2 justify-end">
        <button data-answer="no" class="btn-ghost px-4 py-2 rounded-full text-sm">Cancelar</button>
        <button data-answer="yes" class="${danger ? 'btn-danger' : 'btn-primary'} px-4 py-2 rounded-full text-sm font-medium">${escapeHtml(confirmText)}</button>
      </div>
    `, { id: 'confirm-overlay', maxWidth: 400 });
    overlay.addEventListener('click', (e) => {
      const answer = e.target.dataset && e.target.dataset.answer;
      if (e.target === overlay || answer) {
        closeModal('confirm-overlay');
        resolve(answer === 'yes');
      }
    });
  });
}

/* ---------- Piezas de UI compartidas ---------- */

function renderAvatar(url, username, size = 'md') {
  const cls = `avatar avatar-${size}`;
  if (safeUrl(url)) {
    return `<img src="${safeUrl(url)}" alt="" class="${cls}" loading="lazy">`;
  }
  const initial = escapeHtml((username || '?').charAt(0).toUpperCase());
  return `<span class="${cls} avatar-fallback" aria-hidden="true">${initial}</span>`;
}

function renderTag(tag) {
  const color = safeColor(tag.color);
  return `<span class="tag-chip" style="--tag: ${color}">${escapeHtml(tag.name)}</span>`;
}

function voteClass(count) {
  return count > 0 ? 'vote-positive' : count < 0 ? 'vote-negative' : 'vote-neutral';
}

/** Columna/grupo de votos. type = 'post' | 'comment' */
function renderVotes(type, id, count, myVote, { horizontal = false } = {}) {
  return `
    <div class="vote-group ${horizontal ? 'vote-horizontal' : 'vote-vertical'}" data-vote-type="${type}" data-vote-id="${id}" data-my-vote="${myVote || 0}">
      <button type="button" class="vote-btn vote-btn-up ${myVote === 1 ? 'active' : ''}" data-value="1" aria-label="Votar a favor" title="Votar a favor">
        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M10 3l7 8h-4.5v6h-5v-6H3z"/></svg>
      </button>
      <span class="vote-count ${voteClass(count)}">${count}</span>
      <button type="button" class="vote-btn vote-btn-down ${myVote === -1 ? 'active' : ''}" data-value="-1" aria-label="Votar en contra" title="Votar en contra">
        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M10 17l-7-8h4.5V3h5v6H17z"/></svg>
      </button>
    </div>
  `;
}

// Un solo listener para todos los botones de voto de la página
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.vote-btn');
  if (!btn) return;
  const group = btn.closest('.vote-group');
  if (!group) return;
  e.preventDefault();
  e.stopPropagation();

  if (!isLoggedIn()) {
    showLoginPrompt('votar');
    return;
  }

  const type = group.dataset.voteType;
  const id = group.dataset.voteId;
  const value = Number(btn.dataset.value);
  const url = type === 'post' ? `/posts/${id}/vote` : `/comments/${id}/vote`;

  group.classList.add('vote-busy');
  try {
    const data = await api.put(url, { value });
    const countEl = group.querySelector('.vote-count');
    countEl.textContent = data.vote_count;
    countEl.className = `vote-count ${voteClass(data.vote_count)}`;
    group.dataset.myVote = data.my_vote;
    group.querySelector('.vote-btn-up').classList.toggle('active', data.my_vote === 1);
    group.querySelector('.vote-btn-down').classList.toggle('active', data.my_vote === -1);
  } catch (err) {
    toast(errorMessage(err, 'Error al votar'), 'error');
  } finally {
    group.classList.remove('vote-busy');
  }
});

function renderPostCard(post) {
  const excerpt = post.content.length > 220 ? post.content.substring(0, 220).trimEnd() + '…' : post.content;
  const thumb = safeUrl(post.image_url);
  return `
    <article class="post-card card">
      ${renderVotes('post', post.id, post.vote_count, post.my_vote)}
      <div class="post-card-body">
        <div class="post-meta">
          ${post.category_name ? `<a href="/posts.html?category_id=${post.category_id}" class="post-meta-category">${escapeHtml(post.category_name)}</a><span aria-hidden="true">·</span>` : ''}
          <span>por <a href="/profile.html?user_id=${post.user_id}" class="post-meta-user">${escapeHtml(post.username)}</a></span>
          <span aria-hidden="true">·</span>
          <time datetime="${escapeHtml(post.created_at)}" title="${escapeHtml(new Date(post.created_at).toLocaleString('es-AR'))}">${timeAgo(post.created_at)}</time>
        </div>
        <h3 class="post-card-title"><a href="/post.html?id=${post.id}" class="post-link">${escapeHtml(post.title)}</a></h3>
        <p class="post-card-excerpt">${escapeHtml(excerpt)}</p>
        <div class="post-card-footer">
          <span class="post-stat">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 4.5A2.5 2.5 0 015.5 2h9A2.5 2.5 0 0117 4.5v7a2.5 2.5 0 01-2.5 2.5H9l-4 3.5V14h0A2.5 2.5 0 013 11.5z"/></svg>
            ${pluralize(post.comment_count || 0, 'comentario', 'comentarios')}
          </span>
          ${(post.tags || []).map(renderTag).join('')}
        </div>
      </div>
      ${thumb ? `<img src="${thumb}" alt="" class="post-card-thumb" loading="lazy">` : ''}
    </article>
  `;
}

function renderEmptyState(title, subtitle = '') {
  return `
    <div class="empty-state card">
      <div class="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>
      </div>
      <p class="font-semibold text-primary">${escapeHtml(title)}</p>
      ${subtitle ? `<p class="text-secondary text-sm mt-1">${escapeHtml(subtitle)}</p>` : ''}
    </div>
  `;
}

function renderSkeletonCards(n = 3) {
  return Array.from({ length: n }, () => `
    <div class="post-card card skeleton-card" aria-hidden="true">
      <div class="skeleton" style="width: 40px; height: 72px"></div>
      <div class="flex-1 space-y-2">
        <div class="skeleton" style="width: 40%; height: 12px"></div>
        <div class="skeleton" style="width: 75%; height: 18px"></div>
        <div class="skeleton" style="width: 90%; height: 12px"></div>
      </div>
    </div>
  `).join('');
}

/** Paginación. onPageClick recibe el número de página. */
function renderPagination(containerId, totalPages, activePage, onPageClick) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!totalPages || totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const btn = (page, label, extra = '') =>
    `<button type="button" data-page="${page}" class="page-btn ${extra}">${label}</button>`;

  let html = '<nav class="pagination" aria-label="Paginación">';
  if (activePage > 1) html += btn(activePage - 1, '← Anterior');

  for (let i = 1; i <= totalPages; i++) {
    if (i === activePage) {
      html += `<span class="page-btn page-active" aria-current="page">${i}</span>`;
    } else if (i === 1 || i === totalPages || Math.abs(i - activePage) <= 2) {
      html += btn(i, i);
    } else if (Math.abs(i - activePage) === 3) {
      html += '<span class="text-muted px-1">…</span>';
    }
  }

  if (activePage < totalPages) html += btn(activePage + 1, 'Siguiente →');
  html += '</nav>';
  container.innerHTML = html;

  container.querySelectorAll('[data-page]').forEach((el) => {
    el.addEventListener('click', () => {
      onPageClick(Number(el.dataset.page));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}
