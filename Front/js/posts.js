let categoryId = null;

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

async function loadPosts() {
  categoryId = getCategoryId();
  if (!categoryId) {
    window.location.href = '/';
    return;
  }

  const container = document.getElementById('posts');
  const nameEl = document.getElementById('category-name');
  const newPostBtn = document.getElementById('new-post-btn');
  newPostBtn.classList.remove('hidden');

  try {
    const cat = await api.get(`/categories/${categoryId}`);
    nameEl.textContent = cat.name;
    document.title = `ForoU - ${cat.name}`;
  } catch {
    nameEl.textContent = 'Categoría';
  }

  try {
    const posts = await api.get(`/posts?category_id=${categoryId}`);

    if (posts.length === 0) {
      container.innerHTML = '<p class="text-muted text-center py-8">No hay posts en esta categoría</p>';
      return;
    }

    container.innerHTML = posts.map(post => `
      <a href="/post.html?id=${post.id}" class="block card rounded-lg p-4 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="font-semibold text-primary">${post.title}</h3>
            <p class="text-secondary text-sm mt-1 line-clamp-2">${post.content.substring(0, 150)}${post.content.length > 150 ? '...' : ''}</p>
            <div class="flex items-center gap-4 mt-2 text-xs text-muted">
              <span>por ${post.username}</span>
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
  } catch (err) {
    container.innerHTML = '<p style="color: var(--red)">Error al cargar posts</p>';
  }
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
    loadPosts();
  } catch (err) {
    alert(err.error || 'Error al crear post');
  }
});

loadPosts();
