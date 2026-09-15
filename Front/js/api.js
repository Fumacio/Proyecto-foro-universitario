const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

const api = {
  get: (url) => request(url),
  post: (url, body) => request(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => request(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url, options = {}) => request(url, { method: 'DELETE', ...options }),
};

function getUser() {
  const data = localStorage.getItem('user');
  return data ? JSON.parse(data) : null;
}

function isLoggedIn() {
  return !!localStorage.getItem('token');
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

function showLoginPrompt(action) {
  let overlay = document.getElementById('login-prompt-overlay');
  if (overlay) overlay.remove();

  const returnUrl = window.location.pathname + window.location.search;
  localStorage.setItem('returnUrl', returnUrl);

  overlay = document.createElement('div');
  overlay.id = 'login-prompt-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <h3 class="text-lg font-bold text-primary mb-2">Iniciar sesión requerido</h3>
      <p class="text-secondary text-sm mb-6">Para ${action} necesitás tener una cuenta.</p>
      <div class="flex gap-3 justify-end">
        <a href="/login.html" class="btn-primary px-4 py-2 rounded text-sm font-medium">Iniciar sesión</a>
        <a href="/register.html" class="btn-secondary px-4 py-2 rounded text-sm font-medium">Registrarse</a>
        <button onclick="closeLoginPrompt()" class="text-muted hover:text-secondary px-4 py-2 rounded text-sm">Cancelar</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLoginPrompt();
  });
  document.body.appendChild(overlay);
}

function closeLoginPrompt() {
  const overlay = document.getElementById('login-prompt-overlay');
  if (overlay) overlay.remove();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderAvatar(url, username, size = 9) {
  if (url) {
    return `<img src="${url}" alt="" class="w-${size} h-${size} rounded-full object-cover">`;
  }
  return `<div class="w-${size} h-${size} rounded-full flex items-center justify-center text-sm font-bold" style="background-color: var(--orange-light); color: var(--orange)">${escapeHtml(username.charAt(0).toUpperCase())}</div>`;
}

function renderPagination(containerId, totalPages, activePage, onPageClick) {
  const container = document.getElementById(containerId);
  if (!container || totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  let html = '<div class="flex items-center justify-center gap-2 mt-6">';

  if (activePage > 1) {
    html += `<button onclick="${onPageClick}(${activePage - 1})" class="btn-secondary px-3 py-1.5 rounded text-sm">&#8592; Anterior</button>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === activePage) {
      html += `<span class="btn-primary px-3 py-1.5 rounded text-sm cursor-default">${i}</span>`;
    } else if (i === 1 || i === totalPages || Math.abs(i - activePage) <= 2) {
      html += `<button onclick="${onPageClick}(${i})" class="btn-secondary px-3 py-1.5 rounded text-sm">${i}</button>`;
    } else if (Math.abs(i - activePage) === 3) {
      html += `<span class="text-muted px-1">...</span>`;
    }
  }

  if (activePage < totalPages) {
    html += `<button onclick="${onPageClick}(${activePage + 1})" class="btn-secondary px-3 py-1.5 rounded text-sm">Siguiente &#8594;</button>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

function renderPostCard(post) {
  return `
    <a href="/post.html?id=${post.id}" class="block card rounded-lg p-4 hover:shadow-md transition-shadow">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 mt-1">
          ${renderAvatar(post.avatar_url, post.username)}
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-primary">${escapeHtml(post.title)}</h3>
          <p class="text-secondary text-sm mt-1 line-clamp-2">${escapeHtml(post.content.substring(0, 150))}${post.content.length > 150 ? '...' : ''}</p>
          <div class="flex items-center gap-4 mt-2 text-xs text-muted">
            <span>por ${escapeHtml(post.username)}</span>
            <span>${new Date(post.created_at).toLocaleDateString('es-AR')}</span>
            ${post.category_name ? `<a href="/posts.html?category_id=${post.category_id}" class="link-theme hover:underline">${escapeHtml(post.category_name)}</a>` : ''}
            ${post.comment_count !== undefined ? `<span>${post.comment_count} comentarios</span>` : ''}
            ${post.tags && post.tags.length > 0 ? `<span class="flex items-center gap-1">${post.tags.map(t => `<span class="inline-block px-1.5 py-0.5 rounded text-[10px]" style="background-color: ${t.color}15; color: ${t.color}">${escapeHtml(t.name)}</span>`).join('')}</span>` : ''}
          </div>
        </div>
        <div class="text-right ml-4 flex-shrink-0">
          <div class="vote-group">
            <span class="vote-btn" style="color: var(--green); font-size: 10px;">&#9650;</span>
            <span class="vote-count ${post.vote_count > 0 ? 'vote-positive' : post.vote_count < 0 ? 'vote-negative' : 'vote-neutral'}">${post.vote_count}</span>
            <span class="vote-btn" style="color: var(--red); font-size: 10px;">&#9660;</span>
          </div>
        </div>
      </div>
    </a>
  `;
}
