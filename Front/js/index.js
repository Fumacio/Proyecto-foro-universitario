async function loadCategories() {
  const container = document.getElementById('categories');

  try {
    const categories = await api.get('/categories');

    if (categories.length === 0) {
      container.innerHTML = '<p class="text-muted">No hay categorías</p>';
      return;
    }

    container.innerHTML = categories.map(cat => `
      <div class="card rounded-lg p-5 hover:shadow-md transition-shadow">
        <h2 class="text-lg font-semibold text-primary mb-3">${cat.name}</h2>
        ${cat.description ? `<p class="text-secondary text-sm mb-3">${cat.description}</p>` : ''}
        <div class="flex flex-wrap gap-2">
          ${cat.subcategories.map(sub => `
            <a href="/posts.html?category_id=${sub.id}"
               class="inline-block text-sm px-3 py-1.5 rounded transition-colors"
               style="background-color: var(--accent-light); color: var(--accent);">
              ${sub.name}
            </a>
          `).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p style="color: var(--red)">Error al cargar categorías</p>';
  }
}

loadCategories();
