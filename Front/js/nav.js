function renderNav() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const user = getUser();
  const params = new URLSearchParams(window.location.search);
  const searchQuery = params.get('q') || '';

  let html = `
    <nav class="navbar">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" class="text-xl font-bold" style="color: #ffffff">Foro UTN <span style="color: var(--orange)">&#9733;</span> FRT</a>
        <form onsubmit="handleSearch(event)" class="flex-1 max-w-md mx-6">
          <input type="text" id="search-input" placeholder="Buscar posts..."
                 class="w-full input-field rounded px-3 py-1.5 text-sm"
                 value="${escapeHtml(searchQuery)}">
        </form>
        <div class="flex items-center gap-4">
  `;

  if (user) {
    const avatarHtml = user.avatar_url
      ? `<img src="${user.avatar_url}" alt="" class="w-7 h-7 rounded-full object-cover">`
      : `<div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style="background-color: var(--orange-light); color: var(--orange)">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>`;

    html += `
      <a href="/profile.html" class="flex items-center gap-2 text-sm" style="color: #ffffff; opacity: 0.85">
        ${avatarHtml}
        ${user.username}
      </a>
      <span class="text-xs badge-${user.role} px-2 py-0.5 rounded-full">${user.role}</span>
      <button onclick="logout()" class="text-sm" style="color: var(--orange)">Salir</button>
    `;
  } else {
    html += `
      <a href="/login.html" class="text-sm" style="color: #ffffff; opacity: 0.85">Iniciar sesión</a>
      <a href="/register.html" class="px-3 py-1.5 rounded text-sm font-medium" style="background-color: var(--orange); color: #ffffff">Registrarse</a>
    `;
  }

  html += `</div></div></nav>`;
  nav.innerHTML = html;
}

function handleSearch(e) {
  e.preventDefault();
  const q = document.getElementById('search-input').value.trim();
  if (q) {
    window.location.href = `/?q=${encodeURIComponent(q)}`;
  } else {
    window.location.href = '/';
  }
}

document.addEventListener('DOMContentLoaded', renderNav);
