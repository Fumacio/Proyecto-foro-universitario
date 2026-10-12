async function renderNav() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const user = getUser();

  if (user && user.username && !window.location.pathname.includes('banned.html')) {
    try {
      const data = await api.get('/auth/ban-status');
      if (data.banned) {
        window.location.href = '/banned.html';
        return;
      }
    } catch {}
  }

  const params = new URLSearchParams(window.location.search);
  const currentQuery = window.location.pathname === '/' || window.location.pathname.endsWith('index.html') ? params.get('q') || '' : '';

  const userArea = user && user.username
    ? `
      <a href="/posts.html?new=1" class="hidden sm:inline-flex btn-primary px-4 py-2 rounded-full text-sm font-semibold items-center gap-1" id="nav-new-post" title="Crear un post">
        <span aria-hidden="true">+</span> Crear
      </a>
      <div class="relative">
        <button type="button" id="user-menu-btn" class="user-menu-btn" aria-haspopup="true" aria-expanded="false">
          ${renderAvatar(user.avatar_url, user.username, 'sm')}
          <span class="hidden md:inline text-sm font-medium">${escapeHtml(user.username)}</span>
          <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M5 7l5 6 5-6z"/></svg>
        </button>
        <div id="user-menu" class="dropdown hidden" role="menu">
          <div class="dropdown-header">
            <div class="font-semibold text-primary">${escapeHtml(user.username)}</div>
            <span class="badge badge-${escapeHtml(user.role)}">${escapeHtml(user.role)}</span>
          </div>
          <a href="/profile.html" class="dropdown-item" role="menuitem">Mi perfil</a>
          ${user.role === 'admin' ? '<a href="/admin.html" class="dropdown-item" role="menuitem">Panel de admin</a>' : ''}
          <button type="button" onclick="logout()" class="dropdown-item dropdown-item-danger" role="menuitem">Cerrar sesión</button>
        </div>
      </div>
    `
    : `
      <a href="/login.html" class="btn-ghost px-3 sm:px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap">
        <span class="sm:hidden">Entrar</span><span class="hidden sm:inline">Iniciar sesión</span>
      </a>
      <a href="/register.html" class="hidden sm:inline-block btn-primary px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap">Registrarse</a>
    `;

  nav.innerHTML = `
    <nav class="navbar">
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
        <a href="/" class="brand" aria-label="Foro UTN FRT, inicio">
          <span class="brand-logo" aria-hidden="true">U</span>
          <span class="hidden sm:inline">Foro <span class="brand-accent">UTN</span> FRT</span>
        </a>
        <form action="/" method="get" class="nav-search" role="search">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8.5 3a5.5 5.5 0 014.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z"/></svg>
          <input type="search" name="q" value="${escapeHtml(currentQuery)}" placeholder="Buscar en el foro" aria-label="Buscar en el foro" maxlength="100">
        </form>
        <div class="flex items-center gap-2 ml-auto">${userArea}</div>
      </div>
    </nav>
  `;

  const menuBtn = document.getElementById('user-menu-btn');
  if (menuBtn) {
    const menu = document.getElementById('user-menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('hidden') === false;
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', () => {
      menu.classList.add('hidden');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // En la página de una categoría, "Crear" abre el formulario ahí mismo
  const newPostLink = document.getElementById('nav-new-post');
  if (newPostLink && typeof showNewPostForm === 'function' && new URLSearchParams(window.location.search).get('category_id')) {
    newPostLink.addEventListener('click', (e) => {
      e.preventDefault();
      showNewPostForm();
    });
  }
}

document.addEventListener('DOMContentLoaded', renderNav);
