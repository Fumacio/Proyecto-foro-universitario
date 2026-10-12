const CAREERS = [
  ['Ingenieria en Sistemas', 'Ingeniería en Sistemas'],
  ['Ingenieria Civil', 'Ingeniería Civil'],
  ['Ingenieria Electrica', 'Ingeniería Eléctrica'],
  ['Ingenieria Mecanica', 'Ingeniería Mecánica'],
  ['Ingenieria Quimica', 'Ingeniería Química'],
  ['Licenciatura en Administracion', 'Licenciatura en Administración'],
  ['Contador Publico', 'Contador Público'],
  ['Otra', 'Otra']
];
const GENDERS = ['Masculino', 'Femenino', 'No binario', 'Otro'];

function careerLabel(value) {
  const found = CAREERS.find(([v]) => v === value);
  return found ? found[1] : value;
}

function infoRow(label, value) {
  if (!value) return '';
  return `
    <div class="flex justify-between gap-4 py-2 border-b border-theme last:border-0">
      <span class="text-muted">${label}</span>
      <span class="text-primary text-right">${escapeHtml(value)}</span>
    </div>
  `;
}

function options(list, selected) {
  return list.map(([value, label]) =>
    `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
  ).join('');
}

async function loadProfile() {
  const container = document.getElementById('profile');
  const user = getUser();

  if (!user) {
    localStorage.setItem('returnUrl', window.location.pathname + window.location.search);
    container.innerHTML = `
      <div class="card p-8 text-center">
        <p class="text-secondary mb-4">Iniciá sesión para ver perfiles.</p>
        <a href="/login.html" class="btn-primary px-5 py-2 rounded-full text-sm font-semibold">Iniciar sesión</a>
      </div>
    `;
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const userId = Number(params.get('user_id')) || user.id;
  const isOwn = user.id === userId;

  try {
    const [data, stats, activity] = await Promise.all([
      api.get(`/users/${userId}`),
      api.get(`/users/${userId}/stats`),
      api.get(`/users/${userId}/activity`)
    ]);

    document.title = `${data.username} · Foro UTN FRT`;
    const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');

    container.innerHTML = `
      <section class="card overflow-hidden">
        <div class="profile-banner"></div>
        <div class="px-6 pb-6">
          <div class="flex items-end justify-between gap-4 -mt-10 flex-wrap">
            <div class="profile-avatar-wrap">${renderAvatar(data.avatar_url, data.username, 'lg')}</div>
            ${isOwn ? `
              <div class="flex gap-2 flex-wrap">
                <label class="btn-secondary px-4 py-2 rounded-full text-sm font-medium cursor-pointer">
                  Cambiar foto
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="sr-only" onchange="uploadAvatar(event)">
                </label>
                <button type="button" onclick="toggleSection('edit-profile-form')" class="btn-primary px-4 py-2 rounded-full text-sm font-semibold">Editar perfil</button>
              </div>
            ` : ''}
          </div>

          <div class="mt-3">
            <h1 class="text-2xl font-bold text-primary">${escapeHtml(data.username)}</h1>
            <div class="flex items-center gap-2 mt-1 text-sm text-muted flex-wrap">
              <span class="badge badge-${escapeHtml(data.role)}">${escapeHtml(data.role)}</span>
              ${fullName ? `<span>${escapeHtml(fullName)}</span><span aria-hidden="true">·</span>` : ''}
              <span>Miembro desde ${formatDate(data.created_at)}</span>
            </div>
            ${data.bio ? `<p class="text-secondary text-sm mt-3 whitespace-pre-wrap">${escapeHtml(data.bio)}</p>` : ''}
          </div>

          <div class="grid grid-cols-3 gap-3 mt-5">
            <div class="stat-card rounded-xl" style="background: var(--bg-input)"><div class="stat-value">${stats.posts}</div><div class="stat-label">Posts</div></div>
            <div class="stat-card rounded-xl" style="background: var(--bg-input)"><div class="stat-value">${stats.comments}</div><div class="stat-label">Comentarios</div></div>
            <div class="stat-card rounded-xl" style="background: var(--bg-input)"><div class="stat-value ${voteClass(stats.karma)}">${stats.karma}</div><div class="stat-label">Karma</div></div>
          </div>

          <div class="text-sm mt-5">
            ${isOwn || data.email ? infoRow('Email', data.email) : ''}
            ${infoRow('Carrera', careerLabel(data.career))}
            ${infoRow('Comisión', data.commission)}
            ${infoRow('Edad', data.age ? `${data.age} años` : '')}
            ${infoRow('Género', data.gender)}
          </div>
        </div>
      </section>

      ${isOwn ? renderEditForms(data) : ''}

      <section class="card p-6 mt-4">
        <h2 class="text-lg font-semibold text-primary mb-3">Actividad reciente</h2>
        ${activity.posts.length === 0 && activity.comments.length === 0 ? '<p class="text-muted text-sm">Todavía no publicó nada.</p>' : ''}
        ${activity.posts.length > 0 ? `
          <h3 class="side-title mt-2">Posts</h3>
          <div class="space-y-1 mb-4">
            ${activity.posts.map((p) => `
              <a href="/post.html?id=${p.id}" class="activity-row">
                <span class="text-primary font-medium">${escapeHtml(p.title)}</span>
                <span class="text-muted text-xs">en ${escapeHtml(p.category_name)} · ${timeAgo(p.created_at)}</span>
              </a>
            `).join('')}
          </div>
        ` : ''}
        ${activity.comments.length > 0 ? `
          <h3 class="side-title mt-2">Comentarios</h3>
          <div class="space-y-1">
            ${activity.comments.map((c) => `
              <a href="/post.html?id=${c.post_id}#comment-${c.id}" class="activity-row">
                <span class="text-secondary line-clamp-1">“${escapeHtml(c.content)}”</span>
                <span class="text-muted text-xs">en ${escapeHtml(c.post_title)} · ${timeAgo(c.created_at)}</span>
              </a>
            `).join('')}
          </div>
        ` : ''}
      </section>
    `;
  } catch (err) {
    container.innerHTML = err.status === 404
      ? renderEmptyState('Este usuario no existe')
      : renderEmptyState('No se pudo cargar el perfil', errorMessage(err, ''));
  }
}

function renderEditForms(data) {
  const input = 'class="w-full input-field rounded-lg px-3 py-2 text-sm"';
  return `
    <section id="edit-profile-form" class="hidden card p-6 mt-4">
      <h2 class="text-lg font-semibold text-primary mb-4">Editar perfil</h2>
      <form onsubmit="submitEditProfile(event)" class="space-y-3">
        <div class="grid sm:grid-cols-2 gap-3">
          <div><label class="field-label" for="pf-username">Username</label>
            <input id="pf-username" type="text" name="username" value="${escapeHtml(data.username)}" required minlength="3" maxlength="30" ${input}></div>
          <div><label class="field-label" for="pf-email">Email</label>
            <input id="pf-email" type="email" name="email" value="${escapeHtml(data.email || '')}" required maxlength="100" ${input}></div>
          <div><label class="field-label" for="pf-first">Nombre</label>
            <input id="pf-first" type="text" name="first_name" value="${escapeHtml(data.first_name || '')}" maxlength="50" ${input}></div>
          <div><label class="field-label" for="pf-last">Apellido</label>
            <input id="pf-last" type="text" name="last_name" value="${escapeHtml(data.last_name || '')}" maxlength="50" ${input}></div>
          <div><label class="field-label" for="pf-age">Edad</label>
            <input id="pf-age" type="number" name="age" min="13" max="120" value="${data.age || ''}" ${input}></div>
          <div><label class="field-label" for="pf-commission">Comisión</label>
            <input id="pf-commission" type="text" name="commission" value="${escapeHtml(data.commission || '')}" maxlength="30" ${input}></div>
          <div><label class="field-label" for="pf-career">Carrera</label>
            <select id="pf-career" name="career" ${input}><option value="">Seleccionar carrera</option>${options(CAREERS, data.career)}</select></div>
          <div><label class="field-label" for="pf-gender">Género</label>
            <select id="pf-gender" name="gender" ${input}><option value="">Prefiero no decir</option>${options(GENDERS.map((g) => [g, g]), data.gender)}</select></div>
        </div>
        <div><label class="field-label" for="pf-bio">Biografía</label>
          <textarea id="pf-bio" name="bio" rows="3" maxlength="500" placeholder="Contá algo sobre vos…" ${input}>${escapeHtml(data.bio || '')}</textarea></div>

        <div class="border-t border-theme pt-4 mt-2">
          <p class="text-muted text-xs mb-3">Cambiar contraseña (dejalo en blanco para no cambiarla). Se cierran tus otras sesiones.</p>
          <div class="grid sm:grid-cols-2 gap-3">
            <div><label class="field-label" for="pf-current">Contraseña actual</label>
              <input id="pf-current" type="password" name="current_password" autocomplete="current-password" ${input}></div>
            <div><label class="field-label" for="pf-new">Nueva contraseña</label>
              <input id="pf-new" type="password" name="new_password" minlength="6" maxlength="72" autocomplete="new-password" ${input}></div>
          </div>
        </div>
        <div class="flex gap-2 justify-end">
          <button type="button" onclick="toggleSection('edit-profile-form')" class="btn-ghost px-4 py-2 rounded-full text-sm">Cancelar</button>
          <button type="submit" class="btn-primary px-5 py-2 rounded-full text-sm font-semibold">Guardar cambios</button>
        </div>
      </form>
    </section>

    <section class="card p-6 mt-4" style="border-color: color-mix(in srgb, var(--red) 40%, var(--border))">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 class="font-semibold" style="color: var(--red)">Eliminar cuenta</h2>
          <p class="text-secondary text-sm">Se borran tu perfil, tus posts y tus comentarios. No se puede deshacer.</p>
        </div>
        <button type="button" onclick="toggleSection('delete-account-form')" class="px-4 py-2 rounded-full text-sm font-medium" style="background-color: var(--red-light); color: var(--red)">Eliminar mi cuenta</button>
      </div>
      <form id="delete-account-form" onsubmit="submitDeleteAccount(event)" class="hidden mt-4 space-y-3">
        <label class="field-label" for="pf-delete-pass">Ingresá tu contraseña para confirmar</label>
        <input id="pf-delete-pass" type="password" name="password" required autocomplete="current-password" ${input}>
        <div class="flex justify-end">
          <button type="submit" class="btn-danger px-5 py-2 rounded-full text-sm font-semibold">Eliminar definitivamente</button>
        </div>
      </form>
    </section>
  `;
}

function toggleSection(id) {
  const el = document.getElementById(id);
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    toast('Perfil actualizado', 'success');
    renderNav();
    loadProfile();
  } catch (err) {
    toast(errorMessage(err, 'Error al actualizar el perfil'), 'error');
  }
}

async function submitDeleteAccount(e) {
  e.preventDefault();
  const password = e.target.password.value;

  if (!(await confirmDialog('¿Seguro? Tu cuenta y todo lo que publicaste se borran para siempre.', { confirmText: 'Sí, eliminar', danger: true }))) return;

  try {
    await api.delete('/auth/account', { password });
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  } catch (err) {
    toast(errorMessage(err, 'Error al eliminar la cuenta'), 'error');
  }
}

async function uploadAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    toast('La imagen no puede superar 5MB', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const data = await api.upload('/users/avatar', formData);
    const user = getUser();
    user.avatar_url = data.avatar_url;
    localStorage.setItem('user', JSON.stringify(user));
    toast('Foto actualizada', 'success');
    renderNav();
    loadProfile();
  } catch (err) {
    toast(errorMessage(err, 'Error al subir la foto'), 'error');
  }
}

loadProfile();
