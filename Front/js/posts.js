const POSTS_PER_PAGE = 20;
let pendingImageUrl = null;
let allTags = [];

function getState() {
  const params = new URLSearchParams(window.location.search);
  return {
    categoryId: params.get('category_id'),
    tagId: params.get('tag_id'),
    q: (params.get('q') || '').trim(),
    sort: params.get('sort') === 'votes' ? 'votes' : 'recent',
    page: Math.max(1, Number(params.get('page')) || 1)
  };
}

function setState(changes) {
  const params = new URLSearchParams(window.location.search);
  params.delete('new');
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '' || (key === 'sort' && value === 'recent') || (key === 'page' && value === 1)) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  history.pushState(null, '', `/posts.html?${params}`);
  loadPosts();
}

/* ---------- Encabezado de la categoría ---------- */

async function loadHeader() {
  const { categoryId } = getState();
  const nameEl = document.getElementById('category-name');
  const descEl = document.getElementById('category-description');
  const subsEl = document.getElementById('subcategories');
  const crumbs = document.getElementById('breadcrumb');

  if (!categoryId) {
    nameEl.textContent = 'Todos los posts';
    descEl.textContent = 'Lo último que se publicó en todas las categorías.';
    document.title = 'Todos los posts · Foro UTN FRT';
    return;
  }

  try {
    const cat = await api.get(`/categories/${encodeURIComponent(categoryId)}`);
    nameEl.textContent = cat.name;
    descEl.textContent = cat.description || '';
    document.title = `${cat.name} · Foro UTN FRT`;
    crumbs.innerHTML = `
      <a href="/">Inicio</a>
      ${cat.parent_id ? `<span aria-hidden="true">›</span><a href="/posts.html?category_id=${cat.parent_id}">${escapeHtml(cat.parent_name)}</a>` : ''}
      <span aria-hidden="true">›</span><span class="text-primary">${escapeHtml(cat.name)}</span>
    `;
    subsEl.innerHTML = cat.subcategories.map((sub) =>
      `<a href="/posts.html?category_id=${sub.id}" class="chip">${escapeHtml(sub.name)}</a>`
    ).join('');
  } catch (err) {
    nameEl.textContent = err.status === 404 ? 'Categoría no encontrada' : 'Categoría';
    document.getElementById('new-post-btn').classList.add('hidden');
  }
}

/* ---------- Tags ---------- */

async function loadTagsOnce() {
  if (allTags.length > 0) return allTags;
  try {
    allTags = await api.get('/tags');
  } catch {
    allTags = [];
  }
  return allTags;
}

function renderSidebarTags() {
  const { tagId } = getState();
  const container = document.getElementById('sidebar-tags');
  if (allTags.length === 0) {
    container.innerHTML = '<p class="text-muted text-sm">No hay etiquetas.</p>';
    return;
  }
  container.innerHTML = allTags.map((t) => `
    <button type="button" class="tag-filter ${String(t.id) === tagId ? 'active' : ''}" style="--tag: ${safeColor(t.color)}" data-tag-id="${t.id}"
            aria-pressed="${String(t.id) === tagId}">${escapeHtml(t.name)}</button>
  `).join('');
  container.querySelectorAll('[data-tag-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tagId;
      setState({ tag_id: id === getState().tagId ? null : id, page: 1 });
    });
  });
}

function renderActiveFilters() {
  const { tagId, q } = getState();
  const container = document.getElementById('active-filters');
  const chips = [];
  if (q) chips.push(`<button type="button" class="chip chip-removable" data-clear="q">Búsqueda: “${escapeHtml(q)}” ✕</button>`);
  const tag = allTags.find((t) => String(t.id) === tagId);
  if (tag) chips.push(`<button type="button" class="chip chip-removable" data-clear="tag_id">Etiqueta: ${escapeHtml(tag.name)} ✕</button>`);
  container.innerHTML = chips.join('');
  container.querySelectorAll('[data-clear]').forEach((btn) => {
    btn.addEventListener('click', () => setState({ [btn.dataset.clear]: null, page: 1 }));
  });
}

/* ---------- Listado ---------- */

async function loadPosts() {
  const { categoryId, tagId, q, sort, page } = getState();
  const container = document.getElementById('posts');

  document.getElementById('search-input').value = q;
  document.querySelectorAll('.sort-tab').forEach((tab) => {
    const active = tab.dataset.sort === sort;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  await loadTagsOnce();
  renderSidebarTags();
  renderActiveFilters();

  container.innerHTML = renderSkeletonCards(3);

  try {
    const query = new URLSearchParams({ page, limit: POSTS_PER_PAGE });
    if (categoryId) query.set('category_id', categoryId);
    if (tagId) query.set('tag_id', tagId);
    if (sort !== 'recent') query.set('sort', sort);
    if (q) query.set('q', q);

    const result = await api.get(`/posts?${query}`);

    if (result.data.length === 0) {
      container.innerHTML = q || tagId
        ? renderEmptyState('No hay posts con esos filtros', 'Probá sacando algún filtro.')
        : renderEmptyState('Todavía no hay posts acá', 'Animate a publicar el primero.');
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    container.innerHTML = result.data.map(renderPostCard).join('');
    renderPagination('pagination', result.pages, result.page, (p) => setState({ page: p }));
  } catch (err) {
    container.innerHTML = renderEmptyState('No se pudieron cargar los posts', errorMessage(err, ''));
  }
}

/* ---------- Nuevo post ---------- */

async function fillCategorySelect() {
  const select = document.getElementById('post-category');
  if (select.options.length > 0) return;
  const { categoryId } = getState();
  try {
    const categories = await api.get('/categories');
    select.innerHTML = '<option value="">Elegí una categoría</option>' + categories.map((cat) => `
      <option value="${cat.id}">${escapeHtml(cat.name)}</option>
      ${cat.subcategories.map((sub) => `<option value="${sub.id}">&nbsp;&nbsp;↳ ${escapeHtml(sub.name)}</option>`).join('')}
    `).join('');
    if (categoryId) select.value = categoryId;
  } catch {
    select.innerHTML = '<option value="">No se pudieron cargar las categorías</option>';
  }
}

function renderTagSelector() {
  const container = document.getElementById('tag-selector');
  if (allTags.length === 0) {
    container.innerHTML = '<span class="text-muted text-sm">No hay etiquetas disponibles.</span>';
    return;
  }
  container.innerHTML = allTags.map((t) => `
    <label class="tag-option" style="--tag: ${safeColor(t.color)}">
      <input type="checkbox" name="tag_ids" value="${t.id}" class="sr-only">
      <span>${escapeHtml(t.name)}</span>
    </label>
  `).join('');
}

async function showNewPostForm() {
  if (!isLoggedIn()) {
    showLoginPrompt('crear un post');
    return;
  }
  const section = document.getElementById('new-post-form');
  section.classList.remove('hidden');
  await Promise.all([fillCategorySelect(), loadTagsOnce()]);
  renderTagSelector();
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('post-title').focus();
}

function hideNewPostForm() {
  document.getElementById('new-post-form').classList.add('hidden');
}

function resetImage() {
  pendingImageUrl = null;
  document.getElementById('image-preview').innerHTML = '';
  document.getElementById('post-image-input').value = '';
  document.getElementById('file-drop-label').textContent = 'Elegí una imagen (JPG, PNG, GIF o WEBP, hasta 5MB)';
}

async function uploadPostImage(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    toast('La imagen no puede superar 5MB', 'error');
    e.target.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('image', file);
  const label = document.getElementById('file-drop-label');
  label.textContent = 'Subiendo imagen…';

  try {
    const data = await api.upload('/posts/upload-image', formData);
    pendingImageUrl = data.image_url;
    label.textContent = file.name;
    document.getElementById('image-preview').innerHTML = `
      <div class="image-preview">
        <img src="${safeUrl(data.image_url)}" alt="Vista previa">
        <button type="button" onclick="resetImage()" class="image-remove" aria-label="Quitar imagen">✕</button>
      </div>
    `;
  } catch (err) {
    toast(errorMessage(err, 'Error al subir la imagen'), 'error');
    resetImage();
  }
}

document.getElementById('post-image-input').addEventListener('change', uploadPostImage);

document.getElementById('create-post-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const button = document.getElementById('publish-btn');
  const tagIds = Array.from(form.querySelectorAll('input[name="tag_ids"]:checked')).map((cb) => Number(cb.value));

  button.disabled = true;
  try {
    const post = await api.post('/posts', {
      title: form.title.value.trim(),
      content: form.content.value.trim(),
      category_id: Number(form.category_id.value),
      image_url: pendingImageUrl,
      tag_ids: tagIds
    });
    window.location.href = `/post.html?id=${post.id}`;
  } catch (err) {
    toast(errorMessage(err, 'Error al crear el post'), 'error');
    button.disabled = false;
  }
});

/* ---------- Eventos ---------- */

document.querySelectorAll('.sort-tab').forEach((tab) => {
  tab.addEventListener('click', () => setState({ sort: tab.dataset.sort, page: 1 }));
});

document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  setState({ q: document.getElementById('search-input').value.trim(), page: 1 });
});

window.addEventListener('popstate', loadPosts);

loadHeader();
loadPosts();
if (new URLSearchParams(window.location.search).get('new')) showNewPostForm();
