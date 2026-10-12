let currentTab = 'dashboard';

const TABS = [
  ['dashboard', 'Resumen'],
  ['reports', 'Reportes'],
  ['users', 'Usuarios'],
  ['bans', 'Bans'],
  ['categories', 'Categorías'],
  ['tags', 'Etiquetas']
];

const TAG_COLORS = [
  ['Naranja', '#F99B4A'], ['Verde', '#22c55e'], ['Rojo', '#ef4444'], ['Azul', '#3b82f6'], ['Púrpura', '#a855f7'],
  ['Amarillo', '#eab308'], ['Cyan', '#06b6d4'], ['Rosa', '#ec4899'], ['Gris', '#9ca3af']
];

const REPORT_REASONS = { spam: 'Spam', abuso: 'Abuso', contenido_inapropiado: 'Contenido inapropiado', off_topic: 'Off-topic', otro: 'Otro' };

const input = 'class="w-full input-field rounded-lg px-3 py-2 text-sm"';

function loadAdmin() {
  const container = document.getElementById('admin-content');
  const user = getUser();

  if (!user || user.role !== 'admin') {
    container.innerHTML = renderEmptyState('No tenés permisos para ver esta página', 'Si sos admin, iniciá sesión de nuevo.');
    return;
  }

  const requested = window.location.hash.slice(1);
  if (TABS.some(([id]) => id === requested)) currentTab = requested;

  container.innerHTML = `
    <div class="sort-tabs mb-6 flex-wrap" role="tablist">
      ${TABS.map(([id, label]) => `<button type="button" class="sort-tab" data-tab="${id}" role="tab">${label}</button>`).join('')}
    </div>
    <div id="tab-content"></div>
  `;

  container.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  switchTab(currentTab);
}

function switchTab(tab) {
  currentTab = tab;
  history.replaceState(null, '', `#${tab}`);
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  loadTab(tab);
}

async function loadTab(tab) {
  const content = document.getElementById('tab-content');
  content.innerHTML = renderSkeletonCards(2);

  const loaders = { dashboard: loadDashboard, users: loadUsers, categories: loadCategories, tags: loadTags, reports: loadReports, bans: loadBans };
  try {
    await loaders[tab](content);
  } catch (err) {
    content.innerHTML = renderEmptyState('No se pudo cargar esta sección', errorMessage(err, ''));
  }
}

function statCard(value, label, color = '') {
  return `
    <div class="card stat-card">
      <div class="stat-value" ${color ? `style="color: ${color}"` : ''}>${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}

/* ---------- Resumen ---------- */

async function loadDashboard(container) {
  const data = await api.get('/admin/dashboard');
  const c = data.counts;

  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      ${statCard(c.users, 'Usuarios')}
      ${statCard(c.posts, 'Posts')}
      ${statCard(c.comments, 'Comentarios')}
      ${statCard(c.categories, 'Categorías')}
      ${statCard(c.pendingReports, 'Reportes pendientes', c.pendingReports > 0 ? 'var(--orange)' : '')}
      ${statCard(c.activeBans, 'Bans activos', c.activeBans > 0 ? 'var(--red)' : '')}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="card p-5">
        <h3 class="side-title">Usuarios nuevos</h3>
        ${data.recentUsers.map((u) => `
          <div class="flex items-center justify-between gap-2 text-sm py-2 border-b border-theme last:border-0">
            <a href="/profile.html?user_id=${u.id}" class="text-primary font-medium hover:underline">${escapeHtml(u.username)}</a>
            <span class="flex items-center gap-2">
              <span class="badge badge-${escapeHtml(u.role)}">${escapeHtml(u.role)}</span>
              <span class="text-muted text-xs">${timeAgo(u.created_at)}</span>
            </span>
          </div>
        `).join('') || '<p class="text-muted text-sm">Sin usuarios.</p>'}
      </div>

      <div class="card p-5">
        <h3 class="side-title">Posts recientes</h3>
        ${data.recentPosts.map((p) => `
          <div class="flex items-center justify-between gap-2 text-sm py-2 border-b border-theme last:border-0">
            <a href="/post.html?id=${p.id}" class="text-primary font-medium hover:underline line-clamp-1">${escapeHtml(p.title)}</a>
            <span class="text-muted text-xs whitespace-nowrap">${escapeHtml(p.username)} · ${timeAgo(p.created_at)}</span>
          </div>
        `).join('') || '<p class="text-muted text-sm">Sin posts.</p>'}
      </div>
    </div>
  `;
}

/* ---------- Usuarios ---------- */

async function loadUsers(container) {
  const users = await api.get('/users');
  const me = getUser();

  container.innerHTML = `
    <div class="card overflow-hidden">
      <div class="p-4 flex items-center justify-between gap-3 flex-wrap">
        <h3 class="font-semibold text-primary">${pluralize(users.length, 'usuario', 'usuarios')}</h3>
        <input type="search" id="user-filter" placeholder="Filtrar por nombre o email" class="input-field rounded-full px-4 py-1.5 text-sm" style="min-width: 240px">
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm admin-table">
          <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Registro</th><th class="text-right">Acciones</th></tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr data-user-id="${u.id}" data-username="${escapeHtml(u.username)}" data-search="${escapeHtml((u.username + ' ' + u.email).toLowerCase())}">
                <td>
                  <div class="flex items-center gap-2">
                    ${renderAvatar(u.avatar_url, u.username, 'xs')}
                    <a href="/profile.html?user_id=${u.id}" class="text-primary hover:underline">${escapeHtml(u.username)}</a>
                  </div>
                </td>
                <td class="text-secondary">${escapeHtml(u.email)}</td>
                <td>
                  <select data-action="change-role" class="input-field rounded-lg px-2 py-1 text-xs" ${me && me.id === u.id ? 'disabled title="No podés cambiar tu propio rol"' : ''}>
                    <option value="3" ${u.role === 'alumno' ? 'selected' : ''}>alumno</option>
                    <option value="2" ${u.role === 'profesor' ? 'selected' : ''}>profesor</option>
                    <option value="1" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
                  </select>
                </td>
                <td class="text-muted text-xs">${formatDate(u.created_at)}</td>
                <td class="text-right">
                  ${me && me.id === u.id ? '<span class="text-muted text-xs">vos</span>' : '<button type="button" data-action="delete-user" class="action-btn action-danger">Eliminar</button>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#user-filter').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    container.querySelectorAll('tr[data-search]').forEach((row) => {
      row.classList.toggle('hidden', !row.dataset.search.includes(term));
    });
  });

  container.querySelectorAll('[data-action="change-role"]').forEach((select) => {
    select.addEventListener('change', async () => {
      const row = select.closest('tr');
      try {
        await api.put(`/users/${row.dataset.userId}`, { role_id: Number(select.value) });
        toast(`Rol de ${row.dataset.username} actualizado`, 'success');
      } catch (err) {
        toast(errorMessage(err, 'Error al cambiar el rol'), 'error');
        loadTab('users');
      }
    });
  });

  container.querySelectorAll('[data-action="delete-user"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      if (!(await confirmDialog(`¿Eliminar a "${row.dataset.username}"? Se borran también sus posts y comentarios.`, { confirmText: 'Eliminar', danger: true }))) return;
      try {
        await api.delete(`/users/${row.dataset.userId}`);
        toast('Usuario eliminado', 'success');
        loadTab('users');
      } catch (err) {
        toast(errorMessage(err, 'Error al eliminar el usuario'), 'error');
      }
    });
  });
}

/* ---------- Categorías ---------- */

async function loadCategories(container) {
  const categories = await api.get('/categories');
  const rows = [];
  for (const cat of categories) {
    rows.push({ ...cat, depth: 0 });
    for (const sub of cat.subcategories) rows.push({ ...sub, depth: 1 });
  }

  container.innerHTML = `
    <div class="card p-5 mb-4">
      <h3 class="font-semibold text-primary mb-3">Nueva categoría</h3>
      <form id="category-form" class="grid md:grid-cols-4 gap-3 items-end">
        <div class="md:col-span-1"><label class="field-label" for="cat-name">Nombre</label>
          <input id="cat-name" type="text" name="name" required maxlength="100" ${input}></div>
        <div class="md:col-span-1"><label class="field-label" for="cat-parent">Dentro de</label>
          <select id="cat-parent" name="parent_id" ${input}>
            <option value="">— Categoría principal —</option>
            ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select></div>
        <div class="md:col-span-1"><label class="field-label" for="cat-desc">Descripción</label>
          <input id="cat-desc" type="text" name="description" maxlength="500" placeholder="Opcional" ${input}></div>
        <button type="submit" class="btn-primary px-4 py-2 rounded-full text-sm font-semibold">Crear</button>
      </form>
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm admin-table">
          <thead><tr><th>Nombre</th><th>Descripción</th><th>Posts</th><th class="text-right">Acciones</th></tr></thead>
          <tbody>
            ${rows.map((c) => `
              <tr data-category-id="${c.id}" data-name="${escapeHtml(c.name)}">
                <td class="${c.depth === 0 ? 'text-primary font-semibold' : 'text-secondary'}">${c.depth ? '<span class="text-muted">↳</span> ' : ''}${escapeHtml(c.name)}</td>
                <td class="text-muted text-xs">${escapeHtml(c.description || '—')}</td>
                <td class="text-muted">${c.post_count}</td>
                <td class="text-right">
                  <a href="/posts.html?category_id=${c.id}" class="action-btn">Ver</a>
                  <button type="button" data-action="delete-category" class="action-btn action-danger">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await api.post('/categories', {
        name: form.name.value.trim(),
        description: form.description.value.trim() || null,
        parent_id: form.parent_id.value ? Number(form.parent_id.value) : null
      });
      toast('Categoría creada', 'success');
      loadTab('categories');
    } catch (err) {
      toast(errorMessage(err, 'Error al crear la categoría'), 'error');
    }
  });

  container.querySelectorAll('[data-action="delete-category"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      if (!(await confirmDialog(`¿Eliminar la categoría "${row.dataset.name}"?`, { confirmText: 'Eliminar', danger: true }))) return;
      try {
        await api.delete(`/categories/${row.dataset.categoryId}`);
        toast('Categoría eliminada', 'success');
        loadTab('categories');
      } catch (err) {
        toast(errorMessage(err, 'Error al eliminar la categoría'), 'error');
      }
    });
  });
}

/* ---------- Etiquetas ---------- */

async function loadTags(container) {
  const tags = await api.get('/tags');

  container.innerHTML = `
    <div class="card p-5 mb-4">
      <h3 class="font-semibold text-primary mb-3">Nueva etiqueta</h3>
      <form id="tag-form" class="flex gap-4 flex-wrap items-end">
        <div><label class="field-label" for="tag-name">Nombre</label>
          <input id="tag-name" type="text" name="name" required maxlength="50" ${input}></div>
        <fieldset>
          <legend class="field-label">Color</legend>
          <div class="flex gap-1.5 flex-wrap">
            ${TAG_COLORS.map(([name, value], i) => `
              <label title="${name}" class="color-swatch" style="--swatch: ${value}">
                <input type="radio" name="color" value="${value}" class="sr-only" ${i === 0 ? 'checked' : ''}>
                <span></span>
              </label>
            `).join('')}
          </div>
        </fieldset>
        <button type="submit" class="btn-primary px-4 py-2 rounded-full text-sm font-semibold">Crear</button>
      </form>
    </div>

    <div class="card p-5">
      <h3 class="side-title">${pluralize(tags.length, 'etiqueta', 'etiquetas')}</h3>
      <div class="flex flex-wrap gap-2">
        ${tags.map((t) => `
          <span class="inline-flex items-center gap-1" data-tag-id="${t.id}" data-name="${escapeHtml(t.name)}">
            ${renderTag(t)}
            <button type="button" data-action="delete-tag" class="action-btn action-danger" aria-label="Eliminar ${escapeHtml(t.name)}" style="padding: 2px 6px">✕</button>
          </span>
        `).join('') || '<p class="text-muted text-sm">No hay etiquetas.</p>'}
      </div>
    </div>
  `;

  container.querySelector('#tag-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await api.post('/tags', { name: form.name.value.trim(), color: form.color.value });
      toast('Etiqueta creada', 'success');
      loadTab('tags');
    } catch (err) {
      toast(errorMessage(err, 'Error al crear la etiqueta'), 'error');
    }
  });

  container.querySelectorAll('[data-action="delete-tag"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const el = btn.closest('[data-tag-id]');
      if (!(await confirmDialog(`¿Eliminar la etiqueta "${el.dataset.name}"? Se quita de todos los posts.`, { confirmText: 'Eliminar', danger: true }))) return;
      try {
        await api.delete(`/tags/${el.dataset.tagId}`);
        loadTab('tags');
      } catch (err) {
        toast(errorMessage(err, 'Error al eliminar la etiqueta'), 'error');
      }
    });
  });
}

/* ---------- Reportes ---------- */

async function loadReports(container) {
  const [pending, resolved, dismissed] = await Promise.all([
    api.get('/reports?status=pending'),
    api.get('/reports?status=resolved'),
    api.get('/reports?status=dismissed')
  ]);

  const section = (title, list, actions) => list.length === 0 ? '' : `
    <div class="card overflow-hidden mb-4">
      <div class="p-4 border-b border-theme"><h3 class="font-semibold text-primary">${title}</h3></div>
      <div class="divide-theme">${list.map((r) => renderReport(r, actions)).join('')}</div>
    </div>
  `;

  container.innerHTML = `
    <div class="grid grid-cols-3 gap-3 mb-4">
      ${statCard(pending.length, 'Pendientes', pending.length > 0 ? 'var(--orange)' : '')}
      ${statCard(resolved.length, 'Resueltos')}
      ${statCard(dismissed.length, 'Descartados')}
    </div>
    ${pending.length === 0 ? renderEmptyState('No hay reportes pendientes', 'Todo tranquilo por ahora.') : ''}
    ${section('Pendientes', pending, true)}
    ${section('Resueltos', resolved, false)}
    ${section('Descartados', dismissed, false)}
  `;

  container.querySelectorAll('[data-report-id] [data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleReportAction(btn));
  });
}

function reportTarget(r) {
  if (r.post_id && r.post_title) {
    return `Post: <a href="/post.html?id=${r.post_id}" class="link-theme hover:underline">${escapeHtml(r.post_title)}</a>`;
  }
  if (r.comment_id && r.comment_content !== null) {
    const text = r.comment_content.length > 100 ? r.comment_content.substring(0, 100) + '…' : r.comment_content;
    return `Comentario: <a href="/post.html?id=${r.comment_post_id}#comment-${r.comment_id}" class="link-theme hover:underline">“${escapeHtml(text)}”</a>`;
  }
  return '<span class="text-muted">El contenido ya fue eliminado</span>';
}

function renderReport(r, showActions) {
  const contentExists = (r.post_id && r.post_title) || (r.comment_id && r.comment_content !== null);
  return `
    <div class="p-4 flex items-start justify-between gap-4 flex-wrap" data-report-id="${r.id}"
         data-post-id="${r.post_id || ''}" data-comment-id="${r.comment_id || ''}" data-comment-post-id="${r.comment_post_id || ''}">
      <div class="min-w-0">
        <div class="flex items-center gap-2 text-sm mb-1 flex-wrap">
          <span class="font-medium text-primary">${escapeHtml(r.reporter_username)}</span>
          <span class="text-muted">reportó por</span>
          <span class="badge badge-alumno">${escapeHtml(REPORT_REASONS[r.reason] || r.reason)}</span>
          <span class="text-muted text-xs">${timeAgo(r.created_at)}</span>
        </div>
        <p class="text-secondary text-sm">${reportTarget(r)}</p>
        ${r.description ? `<p class="text-muted text-sm mt-1">“${escapeHtml(r.description)}”</p>` : ''}
        ${!showActions && r.resolved_by_username ? `<p class="text-muted text-xs mt-1">Revisado por ${escapeHtml(r.resolved_by_username)}</p>` : ''}
      </div>
      ${showActions ? `
        <div class="flex gap-2 flex-wrap">
          ${contentExists ? '<button type="button" data-action="delete-content" class="action-btn action-danger">Borrar contenido</button>' : ''}
          <button type="button" data-action="resolved" class="action-btn" style="color: var(--green)">Marcar resuelto</button>
          <button type="button" data-action="dismissed" class="action-btn">Descartar</button>
        </div>
      ` : ''}
    </div>
  `;
}

async function handleReportAction(btn) {
  const row = btn.closest('[data-report-id]');
  const action = btn.dataset.action;

  try {
    if (action === 'delete-content') {
      const isPost = !!row.dataset.postId;
      if (!(await confirmDialog(`¿Borrar ${isPost ? 'el post' : 'el comentario'} reportado? El reporte queda como resuelto.`, { confirmText: 'Borrar', danger: true }))) return;
      // Primero se resuelve el reporte: al borrar el contenido, el reporte pierde la referencia
      await api.put(`/reports/${row.dataset.reportId}`, { action: 'resolved' });
      if (isPost) {
        await api.delete(`/posts/${row.dataset.postId}`);
      } else {
        await api.delete(`/posts/${row.dataset.commentPostId}/comments/${row.dataset.commentId}`);
      }
      toast('Contenido borrado y reporte resuelto', 'success');
    } else {
      await api.put(`/reports/${row.dataset.reportId}`, { action });
      toast(action === 'resolved' ? 'Reporte resuelto' : 'Reporte descartado', 'success');
    }
    loadTab('reports');
  } catch (err) {
    toast(errorMessage(err, 'Error al procesar el reporte'), 'error');
    loadTab('reports');
  }
}

/* ---------- Bans ---------- */

async function loadBans(container) {
  const data = await api.get('/bans');

  container.innerHTML = `
    <div class="card p-5 mb-4">
      <h3 class="font-semibold text-primary mb-3">Suspender usuario</h3>
      <form id="ban-form" class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="field-label" for="ban-email">Email del usuario</label>
            <div class="flex gap-2">
              <input id="ban-email" type="email" name="email" required placeholder="usuario@ejemplo.com" autocomplete="off" ${input}>
              <button type="button" id="lookup-btn" class="btn-secondary px-3 py-2 rounded-lg text-sm font-medium">Buscar</button>
            </div>
            <div id="user-preview" class="mt-1.5 text-xs"></div>
            <input type="hidden" name="user_id" id="ban-user-id">
          </div>
          <div>
            <label class="field-label" for="ban-type">Tipo</label>
            <select id="ban-type" name="type" ${input}>
              <option value="temporary">Temporal</option>
              <option value="permanent">Permanente</option>
            </select>
          </div>
          <div id="duration-field">
            <label class="field-label" for="ban-hours">Duración (horas)</label>
            <input id="ban-hours" type="number" name="duration_hours" min="1" max="8760" value="24" ${input}>
          </div>
        </div>
        <div>
          <label class="field-label" for="ban-reason">Motivo (lo ve el usuario)</label>
          <input id="ban-reason" type="text" name="reason" required maxlength="500" placeholder="Ej: spam reiterado" ${input}>
        </div>
        <div class="flex justify-end">
          <button type="submit" id="btn-ban" class="btn-danger px-5 py-2 rounded-full text-sm font-semibold" disabled>Suspender</button>
        </div>
      </form>
    </div>

    <div class="card overflow-hidden mb-4">
      <div class="p-4 border-b border-theme"><h3 class="font-semibold text-primary">Activos (${data.active.length})</h3></div>
      ${data.active.length === 0 ? '<p class="text-muted text-sm p-4">No hay usuarios suspendidos.</p>' : `
        <div class="overflow-x-auto">
          <table class="w-full text-sm admin-table">
            <thead><tr><th>Usuario</th><th>Motivo</th><th>Tipo</th><th>Termina</th><th>Por</th><th class="text-right">Acciones</th></tr></thead>
            <tbody>
              ${data.active.map((b) => `
                <tr data-user-id="${b.user_id}" data-username="${escapeHtml(b.username)}">
                  <td class="text-primary font-medium">${escapeHtml(b.username)}</td>
                  <td class="text-secondary text-xs">${escapeHtml(b.reason)}</td>
                  <td><span class="badge" style="background: ${b.type === 'permanent' ? 'var(--red-light)' : 'var(--orange-light)'}; color: ${b.type === 'permanent' ? 'var(--red)' : 'var(--orange)'}">${b.type === 'permanent' ? 'Permanente' : 'Temporal'}</span></td>
                  <td class="text-muted text-xs">${b.expires_at ? new Date(b.expires_at).toLocaleString('es-AR') : '—'}</td>
                  <td class="text-muted text-xs">${escapeHtml(b.banned_by_username || '—')}</td>
                  <td class="text-right"><button type="button" data-action="unban" class="action-btn">Levantar</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>

    ${data.expired.length > 0 ? `
      <div class="card overflow-hidden">
        <div class="p-4 border-b border-theme"><h3 class="font-semibold text-primary">Vencidos (${data.expired.length})</h3></div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm admin-table">
            <thead><tr><th>Usuario</th><th>Motivo</th><th>Venció</th></tr></thead>
            <tbody>
              ${data.expired.map((b) => `
                <tr>
                  <td class="text-primary">${escapeHtml(b.username)}</td>
                  <td class="text-secondary text-xs">${escapeHtml(b.reason)}</td>
                  <td class="text-muted text-xs">${new Date(b.expires_at).toLocaleString('es-AR')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;

  const form = container.querySelector('#ban-form');
  const preview = container.querySelector('#user-preview');
  const hiddenId = container.querySelector('#ban-user-id');
  const btnBan = container.querySelector('#btn-ban');

  const clearPreview = () => {
    preview.innerHTML = '';
    hiddenId.value = '';
    btnBan.disabled = true;
  };

  const lookupUser = async () => {
    const email = form.email.value.trim();
    clearPreview();
    if (!email) return;
    try {
      const user = await api.get(`/users/by-email?email=${encodeURIComponent(email)}`);
      if (user.role === 'admin') {
        preview.innerHTML = '<span style="color: var(--red)">No se puede suspender a un administrador</span>';
        return;
      }
      preview.innerHTML = `<span style="color: var(--green)">Encontrado: <strong>${escapeHtml(user.username)}</strong> (${escapeHtml(user.role)})</span>`;
      hiddenId.value = user.id;
      btnBan.disabled = false;
    } catch (err) {
      preview.innerHTML = `<span style="color: var(--red)">${escapeHtml(errorMessage(err, 'No se encontró usuario con ese email'))}</span>`;
    }
  };

  form.email.addEventListener('input', clearPreview);
  form.email.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookupUser();
    }
  });
  container.querySelector('#lookup-btn').addEventListener('click', lookupUser);
  form.type.addEventListener('change', () => {
    container.querySelector('#duration-field').style.display = form.type.value === 'temporary' ? '' : 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!hiddenId.value) {
      toast('Buscá el usuario por email primero', 'error');
      return;
    }
    try {
      await api.post('/bans', {
        user_id: Number(hiddenId.value),
        reason: form.reason.value.trim(),
        type: form.type.value,
        duration_hours: form.type.value === 'temporary' ? Number(form.duration_hours.value) : undefined
      });
      toast('Usuario suspendido', 'success');
      loadTab('bans');
    } catch (err) {
      toast(errorMessage(err, 'Error al suspender al usuario'), 'error');
    }
  });

  container.querySelectorAll('[data-action="unban"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      if (!(await confirmDialog(`¿Levantar la suspensión de "${row.dataset.username}"?`, { confirmText: 'Levantar' }))) return;
      try {
        await api.post('/bans/unban', { user_id: Number(row.dataset.userId) });
        toast('Suspensión levantada', 'success');
        loadTab('bans');
      } catch (err) {
        toast(errorMessage(err, 'Error al levantar la suspensión'), 'error');
      }
    });
  });
}

loadAdmin();
