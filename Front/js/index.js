const SEARCH_LIMIT = 20;

async function loadCategories() {
  const container = document.getElementById('categories');
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q');

  if (query) {
    document.getElementById('search-title').textContent = `Resultados para "${query}"`;
    document.getElementById('search-title').classList.remove('hidden');
    document.getElementById('browse-title').classList.add('hidden');
    document.getElementById('browse-subtitle').classList.add('hidden');
    container.className = 'space-y-3';
    await searchPosts(query);
    return;
  }

  document.getElementById('search-title').classList.add('hidden');
  document.getElementById('browse-title').classList.remove('hidden');
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
    const result = await api.get(`/posts?q=${encodeURIComponent(query)}&page=${page}&limit=${SEARCH_LIMIT}`);
    const posts = result.data;

    if (posts.length === 0) {
      container.innerHTML = '<p class="text-muted text-center py-8">No se encontraron posts</p>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    container.innerHTML = posts.map(post => renderPostCard(post)).join('');

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
    html += `<button class="search-page-btn btn-secondary px-3 py-1.5 rounded text-sm" data-page="${activePage - 1}" data-query="${escapeHtml(query)}">&#8592; Anterior</button>`;
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
    html += `<button class="search-page-btn btn-secondary px-3 py-1.5 rounded text-sm" data-page="${activePage + 1}" data-query="${escapeHtml(query)}">Siguiente &#8594;</button>`;
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
