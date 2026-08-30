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
      <button onclick="switchTab('reports')" class="tab-btn px-4 py-2 rounded text-sm font-medium" data-tab="reports">Reportes</button>
      <button onclick="switchTab('bans')" class="tab-btn px-4 py-2 rounded text-sm font-medium" data-tab="bans">Bans</button>
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
    else if (tab === 'reports') await loadReports(content);
    else if (tab === 'bans') await loadBans(content);
  } catch (err) {
    content.innerHTML = `<p style="color: var(--red)">Error: ${escapeHtml(err.error || 'Error desconocido')}</p>`;
  }
}

async function loadDashboard(container) {
  const data = await api.get('/admin/dashboard');

  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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
      <div class="card rounded-lg p-4 text-center">
        <div class="text-2xl font-bold" style="color: var(--orange)">${data.counts.pendingReports}</div>
        <div class="text-xs text-secondary mt-1">Reportes</div>
      </div>
      <div class="card rounded-lg p-4 text-center">
        <div class="text-2xl font-bold" style="color: var(--red)">${data.counts.activeBans}</div>
        <div class="text-xs text-secondary mt-1">Bans</div>
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

async function loadReports(container) {
  const [pending, resolved, dismissed] = await Promise.all([
    api.get('/reports?status=pending'),
    api.get('/reports?status=resolved'),
    api.get('/reports?status=dismissed')
  ]);

  container.innerHTML = `
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="card rounded-lg p-4 text-center">
        <div class="text-2xl font-bold" style="color: var(--orange)">${pending.length}</div>
        <div class="text-xs text-secondary mt-1">Pendientes</div>
      </div>
      <div class="card rounded-lg p-4 text-center">
        <div class="text-2xl font-bold vote-positive">${resolved.length}</div>
        <div class="text-xs text-secondary mt-1">Resueltos</div>
      </div>
      <div class="card rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-muted">${dismissed.length}</div>
        <div class="text-xs text-secondary mt-1">Descartados</div>
      </div>
    </div>

    ${pending.length > 0 ? `
      <div class="card rounded-lg overflow-hidden mb-6">
        <div class="p-4 border-b border-theme">
          <h3 class="text-lg font-semibold text-primary">Reportes pendientes</h3>
        </div>
        <div class="divide-y divide-theme">
          ${pending.map(r => renderReport(r, true)).join('')}
        </div>
      </div>
    ` : '<p class="text-muted text-center py-4">No hay reportes pendientes</p>'}

    ${resolved.length > 0 ? `
      <div class="card rounded-lg overflow-hidden mb-6">
        <div class="p-4 border-b border-theme">
          <h3 class="text-lg font-semibold text-primary">Reportes resueltos</h3>
        </div>
        <div class="divide-y divide-theme">
          ${resolved.map(r => renderReport(r, false)).join('')}
        </div>
      </div>
    ` : ''}

    ${dismissed.length > 0 ? `
      <div class="card rounded-lg overflow-hidden">
        <div class="p-4 border-b border-theme">
          <h3 class="text-lg font-semibold text-primary">Reportes descartados</h3>
        </div>
        <div class="divide-y divide-theme">
          ${dismissed.map(r => renderReport(r, false)).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

function renderReport(r, showActions) {
  const reasons = { spam: 'Spam', abuso: 'Abuso', contenido_inapropiado: 'Contenido inapropiado', off_topic: 'Off-topic', otro: 'Otro' };
  const targetInfo = r.post_title
    ? `Post: <a href="/post.html?id=${r.post_id}" class="link-theme hover:underline">${escapeHtml(r.post_title)}</a>`
    : `Comentario: "${escapeHtml((r.comment_content || '').substring(0, 80))}${r.comment_content && r.comment_content.length > 80 ? '...' : ''}"`;

  return `
    <div class="p-4">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2 text-sm mb-1">
            <span class="font-medium text-primary">${escapeHtml(r.reporter_username)}</span>
            <span class="text-muted">reportó</span>
            <span class="text-xs px-2 py-0.5 rounded-full" style="background-color: var(--orange-light); color: var(--orange)">${reasons[r.reason] || r.reason}</span>
          </div>
          <p class="text-secondary text-sm">${targetInfo}</p>
          ${r.description ? `<p class="text-muted text-xs mt-1">"${escapeHtml(r.description)}"</p>` : ''}
          <p class="text-muted text-xs mt-1">${new Date(r.created_at).toLocaleString('es-AR')}</p>
        </div>
        ${showActions ? `
          <div class="flex gap-2 ml-4">
            <button onclick="resolveReport(${r.id}, 'resolved')" class="text-xs px-3 py-1 rounded" style="background-color: var(--green-light); color: var(--green)">Resolver</button>
            <button onclick="resolveReport(${r.id}, 'dismissed')" class="text-xs px-3 py-1 rounded btn-secondary">Descartar</button>
          </div>
        ` : `
          ${r.resolved_by_username ? `<span class="text-muted text-xs">por ${escapeHtml(r.resolved_by_username)}</span>` : ''}
        `}
      </div>
    </div>
  `;
}

async function resolveReport(reportId, action) {
  try {
    await api.put(`/reports/${reportId}`, { action });
    loadTab('reports');
  } catch (err) {
    alert(err.error || 'Error al procesar reporte');
  }
}

async function loadBans(container) {
  const data = await api.get('/bans');

  container.innerHTML = `
    <div class="card rounded-lg p-6 mb-4">
      <h3 class="text-lg font-semibold text-primary mb-4">Banear usuario</h3>
      <form onsubmit="banUser(event)" class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="text-secondary text-xs mb-1 block">Email del usuario</label>
            <div class="flex gap-2">
              <input type="email" name="email" required placeholder="usuario@ejemplo.com"
                     class="w-full input-field rounded px-3 py-2 text-sm"
                     oninput="clearUserPreview()" autocomplete="off">
              <button type="button" onclick="lookupUser()" class="btn-secondary px-3 py-2 rounded text-sm font-medium whitespace-nowrap">Buscar</button>
            </div>
            <div id="user-preview" class="mt-1.5 text-xs hidden"></div>
            <input type="hidden" name="user_id" id="ban-user-id">
          </div>
          <div>
            <label class="text-secondary text-xs mb-1 block">Tipo</label>
            <select name="type" required onchange="toggleDuration(this.value)" class="w-full input-field rounded px-3 py-2 text-sm">
              <option value="temporary">Temporal</option>
              <option value="permanent">Permanente</option>
            </select>
          </div>
          <div id="duration-field">
            <label class="text-secondary text-xs mb-1 block">Duración (horas)</label>
            <input type="number" name="duration_hours" min="1" value="24" class="w-full input-field rounded px-3 py-2 text-sm">
          </div>
        </div>
        <div>
          <label class="text-secondary text-xs mb-1 block">Razón</label>
          <input type="text" name="reason" required placeholder="Motivo del ban..."
                 class="w-full input-field rounded px-3 py-2 text-sm">
        </div>
        <button type="submit" id="btn-ban" class="btn-primary px-4 py-2 rounded text-sm font-medium" disabled>Banear usuario</button>
      </form>
    </div>

    ${data.active.length > 0 ? `
      <div class="card rounded-lg overflow-hidden mb-6">
        <div class="p-4 border-b border-theme">
          <h3 class="text-lg font-semibold text-primary">Bans activos (${data.active.length})</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-theme">
                <th class="text-left p-3 text-secondary font-medium">Usuario</th>
                <th class="text-left p-3 text-secondary font-medium">Razón</th>
                <th class="text-left p-3 text-secondary font-medium">Tipo</th>
                <th class="text-left p-3 text-secondary font-medium">Expira</th>
                <th class="text-left p-3 text-secondary font-medium">Baneado por</th>
                <th class="text-right p-3 text-secondary font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${data.active.map(b => `
                <tr class="border-b border-theme">
                  <td class="p-3 text-primary font-medium">${escapeHtml(b.username)}</td>
                  <td class="p-3 text-secondary text-xs">${escapeHtml(b.reason)}</td>
                  <td class="p-3"><span class="text-xs px-2 py-0.5 rounded-full" style="background-color: ${b.type === 'permanent' ? 'var(--red-light)' : 'var(--orange-light)'}; color: ${b.type === 'permanent' ? 'var(--red)' : 'var(--orange)'}">${b.type === 'permanent' ? 'Permanente' : 'Temporal'}</span></td>
                  <td class="p-3 text-muted text-xs">${b.expires_at ? new Date(b.expires_at).toLocaleString('es-AR') : '-'}</td>
                  <td class="p-3 text-muted text-xs">${escapeHtml(b.banned_by_username)}</td>
                  <td class="p-3 text-right">
                    <button onclick="unbanUser(${b.user_id})" class="text-xs px-2 py-1 rounded btn-secondary">Desbanear</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : '<p class="text-muted text-center py-4">No hay bans activos</p>'}

    ${data.expired.length > 0 ? `
      <div class="card rounded-lg overflow-hidden">
        <div class="p-4 border-b border-theme">
          <h3 class="text-lg font-semibold text-primary">Bans expirados (${data.expired.length})</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-theme">
                <th class="text-left p-3 text-secondary font-medium">Usuario</th>
                <th class="text-left p-3 text-secondary font-medium">Razón</th>
                <th class="text-left p-3 text-secondary font-medium">Expiró</th>
              </tr>
            </thead>
            <tbody>
              ${data.expired.map(b => `
                <tr class="border-b border-theme">
                  <td class="p-3 text-primary font-medium">${escapeHtml(b.username)}</td>
                  <td class="p-3 text-secondary text-xs">${escapeHtml(b.reason)}</td>
                  <td class="p-3 text-muted text-xs">${new Date(b.expires_at).toLocaleString('es-AR')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

function toggleDuration(type) {
  const field = document.getElementById('duration-field');
  field.style.display = type === 'temporary' ? 'block' : 'none';
}

async function lookupUser() {
  const email = document.querySelector('input[name="email"]').value.trim();
  const preview = document.getElementById('user-preview');
  const hiddenId = document.getElementById('ban-user-id');
  const btnBan = document.getElementById('btn-ban');

  if (!email) {
    preview.classList.add('hidden');
    hiddenId.value = '';
    btnBan.disabled = true;
    return;
  }

  try {
    const user = await api.get(`/users/by-email?email=${encodeURIComponent(email)}`);
    preview.classList.remove('hidden');
    if (user.role === 'admin') {
      preview.innerHTML = '<span style="color: var(--red)">No se puede banear a un administrador</span>';
      hiddenId.value = '';
      btnBan.disabled = true;
    } else {
      preview.innerHTML = `<span style="color: var(--green)">Encontrado: <strong>${escapeHtml(user.username)}</strong> (${user.role})</span>`;
      hiddenId.value = user.id;
      btnBan.disabled = false;
    }
  } catch {
    preview.classList.remove('hidden');
    preview.innerHTML = '<span style="color: var(--red)">No se encontró usuario con ese email</span>';
    hiddenId.value = '';
    btnBan.disabled = true;
  }
}

function clearUserPreview() {
  const preview = document.getElementById('user-preview');
  const hiddenId = document.getElementById('ban-user-id');
  const btnBan = document.getElementById('btn-ban');
  preview.classList.add('hidden');
  preview.innerHTML = '';
  hiddenId.value = '';
  btnBan.disabled = true;
}

async function banUser(e) {
  e.preventDefault();
  const form = e.target;
  const userId = document.getElementById('ban-user-id').value;

  if (!userId) {
    alert('Buscá y seleccioná un usuario primero');
    return;
  }

  try {
    await api.post('/bans', {
      user_id: Number(userId),
      reason: form.reason.value.trim(),
      type: form.type.value,
      duration_hours: form.type.value === 'temporary' ? Number(form.duration_hours.value) : undefined
    });
    form.reset();
    document.getElementById('user-preview').classList.add('hidden');
    document.getElementById('ban-user-id').value = '';
    document.getElementById('btn-ban').disabled = true;
    loadTab('bans');
  } catch (err) {
    alert(err.error || 'Error al banear usuario');
  }
}

async function unbanUser(userId) {
  if (!confirm('¿Desbanear a este usuario?')) return;
  try {
    await api.post('/bans/unban', { user_id: userId });
    loadTab('bans');
  } catch (err) {
    alert(err.error || 'Error al desbanear usuario');
  }
}

loadAdmin();
