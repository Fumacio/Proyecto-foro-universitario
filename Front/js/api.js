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
  delete: (url) => request(url, { method: 'DELETE' }),
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

function escapeTextarea(str) {
  return escapeHtml(str).replace(/\n/g, '&#10;');
}
