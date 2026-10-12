const FEED_LIMIT = 15;

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: (params.get('q') || '').trim(),
    sort: params.get('sort') === 'votes' ? 'votes' : 'recent',
    page: Math.max(1, Number(params.get('page')) || 1)
  };
}

function setParams(changes) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '' || (key === 'sort' && value === 'recent') || (key === 'page' && value === 1)) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  history.pushState(null, '', qs ? `/?${qs}` : '/');
  loadFeed();
}

async function loadFeed() {
  const { q, sort, page } = getParams();
  const feed = document.getElementById('feed');
  const title = document.getElementById('feed-title');

  document.getElementById('hero').classList.toggle('hidden', !!q);
  title.textContent = q ? `Resultados para “${q}”` : 'Últimos posts';
  document.title = q ? `Buscar: ${q} · Foro UTN FRT` : 'Foro UTN FRT';
  document.querySelectorAll('.sort-tab').forEach((tab) => {
    const active = tab.dataset.sort === sort;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  feed.innerHTML = renderSkeletonCards(3);

  try {
    const query = new URLSearchParams({ page, limit: FEED_LIMIT });
    if (q) query.set('q', q);
    if (sort !== 'recent') query.set('sort', sort);
    const result = await api.get(`/posts?${query}`);

    if (result.data.length === 0) {
      feed.innerHTML = q
        ? renderEmptyState('No encontramos posts', 'Probá con otras palabras.')
        : renderEmptyState('Todavía no hay posts', 'Elegí una categoría y sé el primero en publicar.');
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    feed.innerHTML = result.data.map(renderPostCard).join('');
    renderPagination('pagination', result.pages, result.page, (p) => setParams({ page: p }));
  } catch (err) {
    feed.innerHTML = renderEmptyState('No se pudieron cargar los posts', errorMessage(err, ''));
  }
}

async function loadCategories() {
  const container = document.getElementById('categories');
  try {
    const categories = await api.get('/categories');
    if (categories.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm">No hay categorías todavía.</p>';
      return;
    }
    container.innerHTML = categories.map((cat) => `
      <div>
        <a href="/posts.html?category_id=${cat.id}" class="cat-root">${escapeHtml(cat.name)}</a>
        ${cat.subcategories.length > 0 ? `
          <ul class="cat-list">
            ${cat.subcategories.map((sub) => `
              <li><a href="/posts.html?category_id=${sub.id}" class="cat-link">
                <span>${escapeHtml(sub.name)}</span>
                ${sub.post_count > 0 ? `<span class="cat-count">${sub.post_count}</span>` : ''}
              </a></li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<p class="text-sm" style="color: var(--red)">Error al cargar categorías</p>';
  }
}

function renderSideCta() {
  const el = document.getElementById('side-cta');
  if (isLoggedIn()) {
    el.innerHTML = `
      <p class="text-sm text-secondary mb-3">¿Tenés una duda, un apunte o algo para compartir?</p>
      <a href="/posts.html?new=1" class="btn-primary w-full block text-center px-4 py-2 rounded-full text-sm font-semibold">Crear un post</a>
    `;
  } else {
    el.innerHTML = `
      <p class="text-sm text-secondary mb-3">Sumate para publicar, comentar y votar.</p>
      <a href="/register.html" class="btn-primary w-full block text-center px-4 py-2 rounded-full text-sm font-semibold">Crear cuenta</a>
      <a href="/login.html" class="btn-ghost w-full block text-center px-4 py-2 rounded-full text-sm mt-2">Ya tengo cuenta</a>
    `;
  }
}

document.querySelectorAll('.sort-tab').forEach((tab) => {
  tab.addEventListener('click', () => setParams({ sort: tab.dataset.sort, page: 1 }));
});
window.addEventListener('popstate', loadFeed);

renderSideCta();
loadCategories();
loadFeed();
