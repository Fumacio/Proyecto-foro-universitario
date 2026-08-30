let currentTab = 'dashboard';

const TAG_COLORS = [
  { name: 'Naranja', value: '#F99B4A' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Rojo', value: '#ef4444' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Púrpura', value: '#a855f7' },
  { name: 'Amarillo', value: '#eab308' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Gris', value: '#9ca3af' },
];

let selectedTagColor = TAG_COLORS[0].value;

function renderColorPicker() {
  return `
    <div>
      <label class="text-secondary text-xs mb-1 block">Color</label>
      <div class="flex gap-1.5 flex-wrap">
        ${TAG_COLORS.map(c => `
          <button type="button" onclick="selectTagColor('${c.value}')" title="${c.name}"
            class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
            style="background-color: ${c.value}; border-color: ${selectedTagColor === c.value ? '#ffffff' : 'transparent'}"
            data-color="${c.value}"></button>
        `).join('')}
      </div>
      <input type="hidden" name="color" value="${selectedTagColor}">
    </div>
  `;
}

function selectTagColor(value) {
  selectedTagColor = value;
  document.querySelector('input[name="color"]').value = value;
  document.querySelectorAll('[data-color]').forEach(btn => {
    btn.style.borderColor = btn.dataset.color === value ? '#ffffff' : 'transparent';
  });
}

async function loadAdmin() {
  const container = document.getElementById('admin-content');
  const user = getUser();

  if (!user || user.role !== 'admin') {
    container.innerHTML = `
      <div class="text-center py-8">
        <p class="text-secondary mb-4">No tenés permisos para acceder a esta página</p>
        <a href="/" class="link-theme hover:underline text-sm">Volver al inicio</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="flex gap-2 mb-6 flex-wrap">
      <button onclick="switchTab('dashboard')" class="tab-btn px-4 py-2 rounded text-sm font-medium" data-tab="dashboard">Dashboard</button>
      <button onclick="switchTab('users')" class="tab-btn px-4 py-2 rounded text-sm font-medium" data-tab="users">Usuarios</button>
      <button onclick="switchTab('categories')" class="tab-btn px-4 py-2 rounded text-sm font-medium" data-tab="categories">Categorías</button>
      <button onclick="switchTab('tags')" class="tab-btn px-4 py-2 rounded text-sm font-medium" data-tab="tags">Tags</button>
    </div>
    <div id="tab-content"></div>
  `;

  updateTabStyles();
  loadTab('dashboard');
}

function switchTab(tab) {
  currentTab = tab;
  updateTabStyles();
  loadTab(tab);
}

function updateTabStyles() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === currentTab) {
      btn.className = 'tab-btn px-4 py-2 rounded text-sm font-medium btn-primary';
    } else {
      btn.className = 'tab-btn px-4 py-2 rounded text-sm font-medium btn-secondary';
    }
  });
}

async function loadTab(tab) {
  const content = document.getElementById('tab-content');
  content.innerHTML = '<p class="text-muted">Cargando...</p>';

  try {
    if (tab === 'dashboard') await loadDashboard(content);
    else if (tab === 'users') await loadUsers(content);
    else if (tab === 'categories') await loadCategories(content);
    else if (tab === 'tags') await loadTags(content);
  } catch (err) {
    content.innerHTML = `<p style="color: var(--red)">Error: ${escapeHtml(err.error || 'Error desconocido')}</p>`;
  }
}

async function loadDashboard(container) {
  const data = await api.get('/admin/dashboard');

  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="card rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-primary">${data.counts.users}</div>
        <div class="text-xs text-secondary mt-1">Usuarios</div>
      </div>
      <div class="card rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-primary">${data.counts.posts}</div>
        <div class="text-xs text-secondary mt-1">Posts</div>
      </div>
      <div class="card rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-primary">${data.counts.comments}</div>
        <div class="text-xs text-secondary mt-1">Comentarios</div>
      </div>
      <div class="card rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-primary">${data.counts.categories}</div>
        <div class="text-xs text-secondary mt-1">Categorías</div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="card rounded-lg p-6">
        <h3 class="text-lg font-semibold text-primary mb-4">Usuarios recientes</h3>
        <div class="space-y-3">
          ${data.recentUsers.map(u => `
            <div class="flex items-center justify-between text-sm border-b border-theme pb-2">
              <div>
                <span class="text-primary font-medium">${escapeHtml(u.username)}</span>
                <span class="text-xs badge-${u.role} px-2 py-0.5 rounded-full ml-2">${u.role}</span>
              </div>
              <span class="text-muted text-xs">${new Date(u.created_at).toLocaleDateString('es-AR')}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card rounded-lg p-6">
        <h3 class="text-lg font-semibold text-primary mb-4">Posts recientes</h3>
        <div class="space-y-3">
          ${data.recentPosts.map(p => `
            <div class="flex items-center justify-between text-sm border-b border-theme pb-2">
              <div>
                <a href="/post.html?id=${p.id}" class="text-primary font-medium link-theme hover:underline">${escapeHtml(p.title)}</a>
                <span class="text-muted ml-2">por ${escapeHtml(p.username)}</span>
              </div>
              <span class="text-muted text-xs">${new Date(p.created_at).toLocaleDateString('es-AR')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

async function loadUsers(container) {
  const users = await api.get('/users');

  container.innerHTML = `
    <div class="card rounded-lg overflow-hidden">
      <div class="p-4 border-b border-theme">
        <h3 class="text-lg font-semibold text-primary">${users.length} usuarios</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-theme">
              <th class="text-left p-3 text-secondary font-medium">Usuario</th>
              <th class="text-left p-3 text-secondary font-medium">Email</th>
              <th class="text-left p-3 text-secondary font-medium">Rol</th>
              <th class="text-left p-3 text-secondary font-medium">Registro</th>
              <th class="text-right p-3 text-secondary font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr class="border-b border-theme hover:bg-opacity-50" style="transition: background-color 0.15s">
                <td class="p-3">
                  <div class="flex items-center gap-2">
                    ${u.avatar_url
                      ? `<img src="${u.avatar_url}" class="w-6 h-6 rounded-full object-cover">`
                      : `<div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style="background-color: var(--orange-light); color: var(--orange)">${escapeHtml(u.username.charAt(0).toUpperCase())}</div>`
                    }
                    <a href="/profile.html?user_id=${u.id}" class="text-primary link-theme hover:underline">${escapeHtml(u.username)}</a>
                  </div>
                </td>
                <td class="p-3 text-secondary">${escapeHtml(u.email)}</td>
                <td class="p-3"><span class="text-xs badge-${u.role} px-2 py-0.5 rounded-full">${u.role}</span></td>
                <td class="p-3 text-muted text-xs">${new Date(u.created_at).toLocaleDateString('es-AR')}</td>
                <td class="p-3 text-right">
                  <select onchange="changeRole(${u.id}, this.value)" class="input-field rounded px-2 py-1 text-xs">
                    <option value="3" ${u.role === 'alumno' ? 'selected' : ''}>alumno</option>
                    <option value="2" ${u.role === 'profesor' ? 'selected' : ''}>profesor</option>
                    <option value="1" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                  </select>
                  <button onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')" class="ml-2 text-xs px-2 py-1 rounded" style="color: var(--red); background-color: var(--red-light)">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function changeRole(userId, roleId) {
  try {
    await api.put(`/users/${userId}`, { role_id: Number(roleId) });
  } catch (err) {
    alert(err.error || 'Error al cambiar rol');
    loadTab('users');
  }
}

async function deleteUser(userId, username) {
  if (!confirm(`¿Eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api.delete(`/users/${userId}`);
    loadTab('users');
  } catch (err) {
    alert(err.error || 'Error al eliminar usuario');
  }
}

async function loadCategories(container) {
  const categories = await api.get('/categories');

  container.innerHTML = `
    <div class="card rounded-lg p-6 mb-4">
      <h3 class="text-lg font-semibold text-primary mb-4">Nueva categoría</h3>
      <form onsubmit="createCategory(event)" class="flex gap-3 flex-wrap">
        <input type="text" name="name" placeholder="Nombre" required class="input-field rounded px-3 py-2 text-sm flex-1 min-w-[200px]">
        <input type="text" name="description" placeholder="Descripción (opcional)" class="input-field rounded px-3 py-2 text-sm flex-1 min-w-[200px]">
        <button type="submit" class="btn-primary px-4 py-2 rounded text-sm font-medium">Crear</button>
      </form>
    </div>

    <div class="card rounded-lg overflow-hidden">
      <div class="p-4 border-b border-theme">
        <h3 class="text-lg font-semibold text-primary">${categories.length} categorías</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-theme">
              <th class="text-left p-3 text-secondary font-medium">Nombre</th>
              <th class="text-left p-3 text-secondary font-medium">Descripción</th>
              <th class="text-left p-3 text-secondary font-medium">Subcategorías</th>
              <th class="text-right p-3 text-secondary font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map(c => `
              <tr class="border-b border-theme">
                <td class="p-3 text-primary font-medium">${escapeHtml(c.name)}</td>
                <td class="p-3 text-secondary text-xs">${escapeHtml(c.description || '-')}</td>
                <td class="p-3 text-muted">${c.subcategories ? c.subcategories.length : 0}</td>
                <td class="p-3 text-right">
                  <button onclick="deleteCategory(${c.id}, '${escapeHtml(c.name)}')" class="text-xs px-2 py-1 rounded" style="color: var(--red); background-color: var(--red-light)">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function createCategory(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const description = form.description.value.trim();

  if (!name) return;

  try {
    await api.post('/categories', { name, description: description || undefined });
    form.reset();
    loadTab('categories');
  } catch (err) {
    alert(err.error || 'Error al crear categoría');
  }
}

async function deleteCategory(id, name) {
  if (!confirm(`¿Eliminar la categoría "${name}"?`)) return;
  try {
    await api.delete(`/categories/${id}`);
    loadTab('categories');
  } catch (err) {
    alert(err.error || 'Error al eliminar categoría');
  }
}

async function loadTags(container) {
  const tags = await api.get('/tags');

  container.innerHTML = `
    <div class="card rounded-lg p-6 mb-4">
      <h3 class="text-lg font-semibold text-primary mb-4">Nuevo tag</h3>
      <form onsubmit="createTag(event)" class="flex gap-3 flex-wrap items-end">
        <div>
          <label class="text-secondary text-xs mb-1 block">Nombre</label>
          <input type="text" name="name" required class="input-field rounded px-3 py-2 text-sm">
        </div>
        ${renderColorPicker()}
        <button type="submit" class="btn-primary px-4 py-2 rounded text-sm font-medium">Crear</button>
      </form>
    </div>

    <div class="card rounded-lg overflow-hidden">
      <div class="p-4 border-b border-theme">
        <h3 class="text-lg font-semibold text-primary">${tags.length} tags</h3>
      </div>
      <div class="p-4 flex flex-wrap gap-2">
        ${tags.map(t => `
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style="background-color: var(--bg-input); border: 1px solid var(--border)">
            <span class="w-3 h-3 rounded-full" style="background-color: ${escapeHtml(t.color)}"></span>
            <span class="text-primary">${escapeHtml(t.name)}</span>
            <button onclick="deleteTag(${t.id}, '${escapeHtml(t.name)}')" class="text-muted hover:text-secondary text-xs ml-1">&times;</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function createTag(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const color = form.color.value;

  if (!name) return;

  try {
    await api.post('/tags', { name, color });
    selectedTagColor = TAG_COLORS[0].value;
    loadTab('tags');
  } catch (err) {
    alert(err.error || 'Error al crear tag');
  }
}

async function deleteTag(id, name) {
  if (!confirm(`¿Eliminar el tag "${name}"?`)) return;
  try {
    await api.delete(`/tags/${id}`);
    loadTab('tags');
  } catch (err) {
    alert(err.error || 'Error al eliminar tag');
  }
}

loadAdmin();
