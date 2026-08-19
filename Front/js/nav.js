function renderNav() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const user = getUser();

  let html = `
    <nav class="navbar">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" class="text-xl font-bold" style="color: #ffffff">Foro UTN <span style="color: var(--orange)">&#9733;</span> FRT</a>
        <div class="flex items-center gap-4">
  `;

  if (user) {
    html += `
      <a href="/profile.html" class="text-sm" style="color: #ffffff; opacity: 0.85">${user.username}</a>
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

document.addEventListener('DOMContentLoaded', renderNav);
