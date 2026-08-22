async function loadCategories() {
  const container = document.getElementById('categories');
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q');

  if (query) {
    document.getElementById('search-title').textContent = `Resultados para "${query}"`;
    document.getElementById('search-title').classList.remove('hidden');
    document.getElementById('browse-title').classList.add('hidden');
    document.getElementById('search-subtitle').classList.remove('hidden');
    document.getElementById('browse-subtitle').classList.add('hidden');
    container.className = 'space-y-3';
    await searchPosts(query);
    return;
  }

  document.getElementById('search-title').classList.add('hidden');
  document.getElementById('browse-title').classList.remove('hidden');
  document.getElementById('search-subtitle').classList.add('hidden');
  document.getElementById('browse-subtitle').classList.remove('hidden');
  container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';

  try {
    const categories = await api.get('/categories');

    if (categories.length === 0) {
      container.innerHTML = '<p class="text-muted">No hay categorías</p>';
      return;
    }

    container.innerHTML = categories.map(cat => `
      <div class="card rounded-lg p-5 hover:shadow-md transition-shadow">
        <h2 class="text-lg font-semibold text-primary mb-3">${escapeHtml(cat.name)}</h2>
        ${cat.description ? `<p class="text-secondary text-sm mb-3">${escapeHtml(cat.description)}</p>` : ''}
        <div class="flex flex-wrap gap-2">
          ${cat.subcategories.map(sub => `
            <a href="/posts.html?category_id=${sub.id}"
               class="inline-block text-sm px-3 py-1.5 rounded transition-colors"
               style="background-color: var(--orange-light); color: var(--orange);">
              ${escapeHtml(sub.name)}
            </a>
          `).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p style="color: var(--red)">Error al cargar categorías</p>';
  }
}

async function searchPosts(query, page = 1) {
  const container = document.getElementById('categories');

  try {
    const result = await api.get(`/posts?q=${encodeURIComponent(query)}&page=${page}&limit=20`);
    const posts = result.data;

    if (posts.length === 0) {
      container.innerHTML = '<p class="text-muted text-center py-8">No se encontraron posts</p>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    container.innerHTML = posts.map(post => `
      <a href="/post.html?id=${post.id}" class="block card rounded-lg p-4 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-primary">${escapeHtml(post.title)}</h3>
            <p class="text-secondary text-sm mt-1 line-clamp-2">${escapeHtml(post.content.substring(0, 150))}${post.content.length > 150 ? '...' : ''}</p>
            <div class="flex items-center gap-4 mt-2 text-xs text-muted">
              <span>por ${escapeHtml(post.username)}</span>
              <span>${new Date(post.created_at).toLocaleDateString('es-AR')}</span>
              <a href="/posts.html?category_id=${post.category_id}" class="link-theme hover:underline">${escapeHtml(post.category_name)}</a>
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

    renderSearchPagination(result.pages, result.page, query);
  } catch (err) {
    container.innerHTML = '<p style="color: var(--red)">Error al buscar posts</p>';
  }
}

function renderSearchPagination(totalPages, activePage, query) {
  const container = document.getElementById('pagination');
  if (!container || totalPages <= 1) {
    if (container) container.innerHTML = '';
    return;
  }

  let html = '<div class="flex items-center justify-center gap-2 mt-6">';

  if (activePage > 1) {
    html += `<button class="search-page-btn btn-secondary px-3 py-1.5 rounded text-sm" data-page="${activePage - 1}" data-query="${escapeHtml(query)}">← Anterior</button>`;
  }

  for (let i = 1; i <= totalPages; i++) {
    if (i === activePage) {
      html += `<span class="btn-primary px-3 py-1.5 rounded text-sm cursor-default">${i}</span>`;
    } else if (i === 1 || i === totalPages || Math.abs(i - activePage) <= 2) {
      html += `<button class="search-page-btn btn-secondary px-3 py-1.5 rounded text-sm" data-page="${i}" data-query="${escapeHtml(query)}">${i}</button>`;
    } else if (Math.abs(i - activePage) === 3) {
      html += `<span class="text-muted px-1">...</span>`;
    }
  }

  if (activePage < totalPages) {
    html += `<button class="search-page-btn btn-secondary px-3 py-1.5 rounded text-sm" data-page="${activePage + 1}" data-query="${escapeHtml(query)}">Siguiente →</button>`;
  }

  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.search-page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      searchPosts(btn.dataset.query, Number(btn.dataset.page));
    });
  });
}

loadCategories();
