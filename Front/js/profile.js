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
    const stats = await api.get(`/users/${userId}/stats`);

    const avatarHtml = data.avatar_url
      ? `<img src="${data.avatar_url}" alt="Avatar" class="w-16 h-16 rounded-full object-cover">`
      : `<div class="w-16 h-16 rounded-full flex items-center justify-center" style="background-color: var(--orange-light)">
           <span class="text-2xl font-bold" style="color: var(--orange)">${escapeHtml(data.username.charAt(0).toUpperCase())}</span>
         </div>`;

    const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');

    container.innerHTML = `
      <div class="card rounded-lg p-6">
        <div class="flex items-center gap-4 mb-6">
          ${avatarHtml}
          <div>
            <h1 class="text-xl font-bold text-primary">${escapeHtml(data.username)}</h1>
            <span class="text-xs badge-${data.role} px-2 py-0.5 rounded-full">${escapeHtml(data.role)}</span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-6 p-3 rounded-lg" style="background-color: var(--bg-input)">
          <div class="text-center">
            <div class="text-lg font-bold text-primary">${stats.posts}</div>
            <div class="text-xs text-secondary">Posts</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-primary">${stats.comments}</div>
            <div class="text-xs text-secondary">Comentarios</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold ${stats.karma > 0 ? 'vote-positive' : stats.karma < 0 ? 'vote-negative' : 'text-muted'}">${stats.karma}</div>
            <div class="text-xs text-secondary">Karma</div>
          </div>
        </div>

        ${data.bio ? `<p class="text-secondary text-sm mb-6 whitespace-pre-wrap">${escapeHtml(data.bio)}</p>` : ''}

        <div class="space-y-3 text-sm">
          ${data.email ? `
            <div class="flex justify-between border-b border-theme pb-2">
              <span class="text-secondary">Email</span>
              <span class="text-primary">${escapeHtml(data.email)}</span>
            </div>
          ` : ''}
          ${fullName ? `
            <div class="flex justify-between border-b border-theme pb-2">
              <span class="text-secondary">Nombre</span>
              <span class="text-primary">${escapeHtml(fullName)}</span>
            </div>
          ` : ''}
          ${data.age ? `
            <div class="flex justify-between border-b border-theme pb-2">
              <span class="text-secondary">Edad</span>
              <span class="text-primary">${data.age} años</span>
            </div>
          ` : ''}
          ${data.career ? `
            <div class="flex justify-between border-b border-theme pb-2">
              <span class="text-secondary">Carrera</span>
              <span class="text-primary">${escapeHtml(data.career)}</span>
            </div>
          ` : ''}
          ${data.commission ? `
            <div class="flex justify-between border-b border-theme pb-2">
              <span class="text-secondary">Comisión</span>
              <span class="text-primary">${escapeHtml(data.commission)}</span>
            </div>
          ` : ''}
          ${data.gender ? `
            <div class="flex justify-between border-b border-theme pb-2">
              <span class="text-secondary">Género</span>
              <span class="text-primary">${escapeHtml(data.gender)}</span>
            </div>
          ` : ''}
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

      ${isOwn ? `
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
              <input type="email" name="email" value="${escapeHtml(data.email || '')}" required
                     class="w-full input-field rounded px-3 py-2 text-sm">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-secondary text-xs mb-1 block">Nombre</label>
                <input type="text" name="first_name" value="${escapeHtml(data.first_name || '')}"
                       class="w-full input-field rounded px-3 py-2 text-sm">
              </div>
              <div>
                <label class="text-secondary text-xs mb-1 block">Apellido</label>
                <input type="text" name="last_name" value="${escapeHtml(data.last_name || '')}"
                       class="w-full input-field rounded px-3 py-2 text-sm">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-secondary text-xs mb-1 block">Edad</label>
                <input type="number" name="age" min="14" max="99" value="${data.age || ''}"
                       class="w-full input-field rounded px-3 py-2 text-sm">
              </div>
              <div>
                <label class="text-secondary text-xs mb-1 block">Comisión</label>
                <input type="text" name="commission" value="${escapeHtml(data.commission || '')}"
                       class="w-full input-field rounded px-3 py-2 text-sm">
              </div>
            </div>
            <div>
              <label class="text-secondary text-xs mb-1 block">Carrera</label>
              <select name="career" class="w-full input-field rounded px-3 py-2 text-sm">
                <option value="">Seleccionar carrera</option>
                ${['Ingenieria en Sistemas', 'Ingenieria Civil', 'Ingenieria Electrica', 'Ingenieria Mecanica', 'Ingenieria Quimica', 'Licenciatura en Administracion', 'Contador Publico', 'Otra'].map(c =>
                  `<option value="${c}" ${data.career === c ? 'selected' : ''}>${c}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="text-secondary text-xs mb-1 block">Género</label>
              <select name="gender" class="w-full input-field rounded px-3 py-2 text-sm">
                <option value="">Prefiero no decir</option>
                ${['Masculino', 'Femenino', 'No binario', 'Otro'].map(g =>
                  `<option value="${g}" ${data.gender === g ? 'selected' : ''}>${g}</option>`
                ).join('')}
              </select>
            </div>
            <div>
              <label class="text-secondary text-xs mb-1 block">Biografía</label>
              <textarea name="bio" rows="3" maxlength="500" placeholder="Contá algo sobre vos..."
                        class="w-full input-field rounded px-3 py-2 text-sm">${escapeHtml(data.bio || '')}</textarea>
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
      ` : ''}
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
    email: form.email.value.trim(),
    first_name: form.first_name.value.trim() || null,
    last_name: form.last_name.value.trim() || null,
    age: form.age.value ? Number(form.age.value) : null,
    commission: form.commission.value.trim() || null,
    career: form.career.value || null,
    gender: form.gender.value || null,
    bio: form.bio.value.trim() || null
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
