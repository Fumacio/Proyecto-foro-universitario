let categoryId = null;
let currentPage = 1;
const POSTS_PER_PAGE = 20;
let pendingImageUrl = null;
let activeTagId = null;

function getCategoryId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('category_id');
}

function getSort() {
  const params = new URLSearchParams(window.location.search);
  return params.get('sort') || 'recent';
}

function showNewPostForm() {
  if (!isLoggedIn()) {
    showLoginPrompt('crear un post');
    return;
  }
  document.getElementById('new-post-form').classList.remove('hidden');
  loadTags();
}

function hideNewPostForm() {
  document.getElementById('new-post-form').classList.add('hidden');
}

async function loadTags() {
  try {
    const tags = await api.get('/tags');
    const container = document.getElementById('tag-selector');
    if (container) {
      container.innerHTML = tags.map(t =>
        `<label class="inline-flex items-center gap-1 text-xs cursor-pointer">
          <input type="checkbox" name="tag_ids" value="${t.id}" class="hidden peer">
          <span class="rounded-full px-2 py-0.5 transition-all"
                style="background-color: ${t.color}22; color: ${t.color}; border: 1px solid ${t.color}44"
                onclick="this.previousElementSibling.checked ? this.style.boxShadow='0 0 0 2px ${t.color}' : this.style.boxShadow=''">${escapeHtml(t.name)}</span>
        </label>`
      ).join('');
    }
  } catch {}
}

async function loadSidebarTags() {
  const container = document.getElementById('sidebar-tags');
  try {
    const tags = await api.get('/tags');
    const params = new URLSearchParams(window.location.search);

    container.innerHTML = `
      <label class="flex items-center gap-2 text-sm text-secondary cursor-pointer hover:text-primary transition-colors">
        <input type="radio" name="tag-filter" value="" ${!activeTagId ? 'checked' : ''} onchange="filterByTag(null)" class="accent-[var(--orange)]">
        Todos
      </label>
      ${tags.map(t => `
          <label class="flex items-center gap-2 text-sm text-secondary cursor-pointer hover:text-primary transition-colors">
            <input type="radio" name="tag-filter" value="${t.id}" ${String(t.id) === String(activeTagId) ? 'checked' : ''} onchange="filterByTag(${t.id})" class="accent-[var(--orange)]">
            ${escapeHtml(t.name.charAt(0).toUpperCase() + t.name.slice(1))}
          </label>
      `).join('')}
    `;
  } catch {}
}

function filterByTag(tagId) {
  activeTagId = tagId;
  const params = new URLSearchParams(window.location.search);
  if (tagId) {
    params.set('tag_id', tagId);
  } else {
    params.delete('tag_id');
  }
  params.delete('page');
  window.location.search = params.toString();
}

function handleSortChange() {
  const select = document.getElementById('sort-select');
  const selectMobile = document.getElementById('sort-select-mobile');
  const sort = (select && select.value) || (selectMobile && selectMobile.value) || 'recent';
  const params = new URLSearchParams(window.location.search);
  if (sort === 'recent') {
    params.delete('sort');
  } else {
    params.set('sort', sort);
  }
  params.delete('page');
  window.location.search = params.toString();
}

async function loadPosts(page = 1) {
  categoryId = getCategoryId();
  if (!categoryId) {
    document.getElementById('posts').innerHTML = '<p class="text-muted text-center py-8">Seleccioná una categoría</p>';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  activeTagId = params.get('tag_id');
  const sort = getSort();

  currentPage = page;
  const container = document.getElementById('posts');
  const nameEl = document.getElementById('category-name');
  const newPostBtn = document.getElementById('new-post-btn');
  if (isLoggedIn()) newPostBtn.classList.remove('hidden');

  const sortSelect = document.getElementById('sort-select');
  const sortSelectMobile = document.getElementById('sort-select-mobile');
  if (sortSelect) sortSelect.value = sort;
  if (sortSelectMobile) sortSelectMobile.value = sort;

  try {
    const cat = await api.get(`/categories/${categoryId}`);
    nameEl.textContent = cat.name;
    document.title = `ForoU - ${cat.name}`;
  } catch {
    nameEl.textContent = 'Categoría';
  }

  await loadSidebarTags();

  try {
    const queryParams = new URLSearchParams();
    queryParams.set('category_id', categoryId);
    queryParams.set('page', page);
    queryParams.set('limit', POSTS_PER_PAGE);
    if (activeTagId) queryParams.set('tag_id', activeTagId);
    if (sort !== 'recent') queryParams.set('sort', sort);

    const result = await api.get(`/posts?${queryParams.toString()}`);
    const posts = result.data;

    if (posts.length === 0 && currentPage === 1) {
      container.innerHTML = '<p class="text-muted text-center py-8">No hay posts en esta categoría</p>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    container.innerHTML = posts.map(post => `
      <a href="/post.html?id=${post.id}" class="block card rounded-lg p-4 hover:shadow-md transition-shadow">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-1">
            ${post.avatar_url
              ? `<img src="${post.avatar_url}" alt="" class="w-9 h-9 rounded-full object-cover">`
              : `<div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style="background-color: var(--orange-light); color: var(--orange)">${escapeHtml(post.username.charAt(0).toUpperCase())}</div>`
            }
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-primary">${escapeHtml(post.title)}</h3>
            <p class="text-secondary text-sm mt-1 line-clamp-2">${escapeHtml(post.content.substring(0, 150))}${post.content.length > 150 ? '...' : ''}</p>
            <div class="flex items-center gap-4 mt-2 text-xs text-muted">
              <span>por ${escapeHtml(post.username)}</span>
              <span>${new Date(post.created_at).toLocaleDateString('es-AR')}</span>
              <span>${post.comment_count} comentarios</span>
              ${post.tags && post.tags.length > 0 ? `<span class="flex items-center gap-1">${post.tags.map(t => `<span class="inline-block px-1.5 py-0.5 rounded text-[10px]" style="background-color: ${t.color}15; color: ${t.color}">${escapeHtml(t.name)}</span>`).join('')}</span>` : ''}
            </div>
          </div>
          <div class="text-right ml-4 flex-shrink-0">
            <div class="vote-group">
              <span class="vote-btn" style="color: var(--green); font-size: 10px;">▲</span>
              <span class="vote-count ${post.vote_count > 0 ? 'vote-positive' : post.vote_count < 0 ? 'vote-negative' : 'vote-neutral'}">${post.vote_count}</span>
              <span class="vote-btn" style="color: var(--red); font-size: 10px;">▼</span>
            </div>
          </div>
        </div>
      </a>
    `).join('');

    renderPagination(result.pages, result.page);
  } catch (err) {
    container.innerHTML = '<p style="color: var(--red)">Error al cargar posts</p>';
  }
}

function renderPagination(totalPages, activePage) {
  const container = document.getElementById('pagination');
  if (!container || totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  let html = '<div class="flex items-center justify-center gap-2 mt-6">';

  if (activePage > 1) {
    html += `<button onclick="loadPosts(${activePage - 1})" class="btn-secondary px-3 py-1.5 rounded text-sm">← Anterior</button>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === activePage) {
      html += `<span class="btn-primary px-3 py-1.5 rounded text-sm cursor-default">${i}</span>`;
    } else if (i === 1 || i === totalPages || Math.abs(i - activePage) <= 2) {
      html += `<button onclick="loadPosts(${i})" class="btn-secondary px-3 py-1.5 rounded text-sm">${i}</button>`;
    } else if (Math.abs(i - activePage) === 3) {
      html += `<span class="text-muted px-1">...</span>`;
    }
  }

  if (activePage < totalPages) {
    html += `<button onclick="loadPosts(${activePage + 1})" class="btn-secondary px-3 py-1.5 rounded text-sm">Siguiente →</button>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

document.getElementById('create-post-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  const selectedTags = Array.from(form.querySelectorAll('input[name="tag_ids"]:checked')).map(cb => Number(cb.value));

  try {
    await api.post('/posts', {
      title: form.title.value.trim(),
      content: form.content.value.trim(),
      category_id: Number(categoryId),
      image_url: pendingImageUrl,
      tag_ids: selectedTags
    });
    form.reset();
    pendingImageUrl = null;
    document.getElementById('image-preview').innerHTML = '';
    document.querySelectorAll('#tag-selector input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      cb.nextElementSibling.style.boxShadow = '';
    });
    hideNewPostForm();
    loadPosts(1);
  } catch (err) {
    alert(err.error || 'Error al crear post');
  }
});

async function uploadPostImage(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('La imagen no puede superar 5MB');
    return;
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/posts/upload-image', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw data;

    pendingImageUrl = data.image_url;
    document.getElementById('image-preview').innerHTML = `<img src="${data.image_url}" alt="Preview" class="rounded max-h-32 object-cover">`;
  } catch (err) {
    alert(err.error || 'Error al subir imagen');
  }
}

loadPosts();

window.addEventListener('popstate', () => {
  loadPosts();
});
