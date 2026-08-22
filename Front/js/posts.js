let categoryId = null;
let currentPage = 1;
const POSTS_PER_PAGE = 20;

function getCategoryId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('category_id');
}

function showNewPostForm() {
  if (!isLoggedIn()) {
    showLoginPrompt('crear un post');
    return;
  }
  document.getElementById('new-post-form').classList.remove('hidden');
}

function hideNewPostForm() {
  document.getElementById('new-post-form').classList.add('hidden');
}

async function loadPosts(page = 1) {
  categoryId = getCategoryId();
  if (!categoryId) {
    window.location.href = '/';
    return;
  }

  currentPage = page;
  const container = document.getElementById('posts');
  const nameEl = document.getElementById('category-name');
  const newPostBtn = document.getElementById('new-post-btn');
  if (isLoggedIn()) newPostBtn.classList.remove('hidden');

  try {
    const cat = await api.get(`/categories/${categoryId}`);
    nameEl.textContent = cat.name;
    document.title = `ForoU - ${cat.name}`;
  } catch {
    nameEl.textContent = 'Categoría';
  }

  try {
    const result = await api.get(`/posts?category_id=${categoryId}&page=${page}&limit=${POSTS_PER_PAGE}`);
    const posts = result.data;

    if (posts.length === 0 && currentPage === 1) {
      container.innerHTML = '<p class="text-muted text-center py-8">No hay posts en esta categoría</p>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    container.innerHTML = posts.map(post => `
      <a href="/post.html?id=${post.id}" class="block card rounded-lg p-4 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="font-semibold text-primary">${escapeHtml(post.title)}</h3>
            <p class="text-secondary text-sm mt-1 line-clamp-2">${escapeHtml(post.content.substring(0, 150))}${post.content.length > 150 ? '...' : ''}</p>
            <div class="flex items-center gap-4 mt-2 text-xs text-muted">
              <span>por ${escapeHtml(post.username)}</span>
              <span>${new Date(post.created_at).toLocaleDateString('es-AR')}</span>
              <span>${post.comment_count} comentarios</span>
            </div>
          </div>
          <div class="text-right ml-4">
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

  try {
    await api.post('/posts', {
      title: form.title.value.trim(),
      content: form.content.value.trim(),
      category_id: Number(categoryId)
    });
    form.reset();
    hideNewPostForm();
    loadPosts(1);
  } catch (err) {
    alert(err.error || 'Error al crear post');
  }
});

loadPosts();
