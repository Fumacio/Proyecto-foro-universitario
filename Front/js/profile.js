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
    const isOwn = user.id === Number(userId);

    const data = await api.get(`/users/${userId}`);

    const avatarHtml = data.avatar_url
      ? `<img src="${data.avatar_url}" alt="Avatar" class="w-16 h-16 rounded-full object-cover">`
      : `<div class="w-16 h-16 rounded-full flex items-center justify-center" style="background-color: var(--orange-light)">
           <span class="text-2xl font-bold" style="color: var(--orange)">${escapeHtml(data.username.charAt(0).toUpperCase())}</span>
         </div>`;

    container.innerHTML = `
      <div class="card rounded-lg p-6">
        <div class="flex items-center gap-4 mb-6">
          ${avatarHtml}
          <div>
            <h1 class="text-xl font-bold text-primary">${escapeHtml(data.username)}</h1>
            <span class="text-xs badge-${data.role} px-2 py-0.5 rounded-full">${escapeHtml(data.role)}</span>
          </div>
        </div>

        <div class="space-y-3 text-sm">
          <div class="flex justify-between border-b border-theme pb-2">
            <span class="text-secondary">Email</span>
            <span class="text-primary">${escapeHtml(data.email)}</span>
          </div>
          <div class="flex justify-between border-b border-theme pb-2">
            <span class="text-secondary">Miembro desde</span>
            <span class="text-primary">${new Date(data.created_at).toLocaleDateString('es-AR')}</span>
          </div>
        </div>

        ${isOwn ? `
          <div class="mt-4 pt-4 border-t border-theme flex gap-3">
            <button onclick="showEditProfile()" class="btn-secondary px-4 py-2 rounded text-sm">Editar perfil</button>
            <label class="btn-secondary px-4 py-2 rounded text-sm cursor-pointer">
              Cambiar avatar
              <input type="file" accept="image/*" class="hidden" onchange="uploadAvatar(event)">
            </label>
          </div>
        ` : ''}
      </div>

      <div id="edit-profile-form" class="hidden card rounded-lg p-6 mt-4">
        <h2 class="text-lg font-semibold text-primary mb-4">Editar perfil</h2>
        <form onsubmit="submitEditProfile(event)" class="space-y-3">
          <div>
            <label class="text-secondary text-xs mb-1 block">Username</label>
            <input type="text" name="username" value="${escapeHtml(data.username)}" required
                   class="w-full input-field rounded px-3 py-2 text-sm">
          </div>
          <div>
            <label class="text-secondary text-xs mb-1 block">Email</label>
            <input type="email" name="email" value="${escapeHtml(data.email)}" required
                   class="w-full input-field rounded px-3 py-2 text-sm">
          </div>
          <div class="border-t border-theme pt-3 mt-3">
            <p class="text-muted text-xs mb-2">Dejar en blanco para no cambiar la contraseña</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-secondary text-xs mb-1 block">Contraseña actual</label>
                <input type="password" name="current_password"
                       class="w-full input-field rounded px-3 py-2 text-sm">
              </div>
              <div>
                <label class="text-secondary text-xs mb-1 block">Nueva contraseña</label>
                <input type="password" name="new_password"
                       class="w-full input-field rounded px-3 py-2 text-sm">
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="btn-primary px-4 py-1.5 rounded text-sm">Guardar cambios</button>
            <button type="button" onclick="hideEditProfile()" class="text-muted hover:text-secondary text-sm">Cancelar</button>
          </div>
        </form>
      </div>
    `;
  } catch {
    container.innerHTML = '<p style="color: var(--red)">Error al cargar el perfil</p>';
  }
}

function showEditProfile() {
  document.getElementById('edit-profile-form').classList.remove('hidden');
}

function hideEditProfile() {
  document.getElementById('edit-profile-form').classList.add('hidden');
}

async function submitEditProfile(e) {
  e.preventDefault();
  const form = e.target;

  const body = {
    username: form.username.value.trim(),
    email: form.email.value.trim()
  };

  if (form.new_password.value) {
    body.current_password = form.current_password.value;
    body.new_password = form.new_password.value;
  }

  try {
    const result = await api.put('/auth/profile', body);
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    hideEditProfile();
    loadProfile();
  } catch (err) {
    alert(err.error || 'Error al actualizar perfil');
  }
}

async function uploadAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('La imagen no puede superar 5MB');
    return;
  }

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/users/avatar', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw data;

    const user = getUser();
    user.avatar_url = data.avatar_url;
    localStorage.setItem('user', JSON.stringify(user));

    if (typeof renderNav === 'function') renderNav();
    loadProfile();
  } catch (err) {
    alert(err.error || 'Error al subir avatar');
  }
}

loadProfile();
