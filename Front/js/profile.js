async function loadProfile() {
  const container = document.getElementById('profile');
  const user = getUser();

  if (!user) {
    container.innerHTML = `
      <div class="text-center py-8">
        <p class="text-secondary mb-4">No estás logueado</p>
        <a href="/login.html" class="link-theme hover:underline">Iniciar sesión</a>
      </div>
    `;
    return;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user_id') || user.id;

    const data = await api.get(`/users/${userId}`);

    container.innerHTML = `
      <div class="card rounded-lg p-6">
        <div class="flex items-center gap-4 mb-6">
          <div class="w-16 h-16 rounded-full flex items-center justify-center" style="background-color: var(--accent-light)">
            <span class="text-2xl font-bold" style="color: var(--accent)">${data.username.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h1 class="text-xl font-bold text-primary">${data.username}</h1>
            <span class="text-xs badge-${data.role} px-2 py-0.5 rounded-full">${data.role}</span>
          </div>
        </div>

        <div class="space-y-3 text-sm">
          <div class="flex justify-between border-b border-theme pb-2">
            <span class="text-secondary">Email</span>
            <span class="text-primary">${data.email}</span>
          </div>
          <div class="flex justify-between border-b border-theme pb-2">
            <span class="text-secondary">Miembro desde</span>
            <span class="text-primary">${new Date(data.created_at).toLocaleDateString('es-AR')}</span>
          </div>
        </div>
      </div>
    `;
  } catch {
    container.innerHTML = '<p style="color: var(--red)">Error al cargar el perfil</p>';
  }
}

loadProfile();
