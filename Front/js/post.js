const postId = new URLSearchParams(window.location.search).get('id');
let currentPost = null;
let commentsPage = 1;

const REPORT_REASONS = [
  ['spam', 'Spam'],
  ['abuso', 'Abuso o acoso'],
  ['contenido_inapropiado', 'Contenido inapropiado'],
  ['off_topic', 'Off-topic'],
  ['otro', 'Otro']
];

function canModify(ownerId) {
  const user = getUser();
  return !!user && (user.id === ownerId || user.role === 'admin');
}

function canReport(ownerId) {
  const user = getUser();
  return !!user && user.id !== ownerId;
}

/* ---------- Post ---------- */

async function loadPost() {
  if (!postId) {
    window.location.href = '/';
    return;
  }

  const container = document.getElementById('post-detail');

  try {
    const post = await api.get(`/posts/${encodeURIComponent(postId)}`);
    currentPost = post;
    document.title = `${post.title} · Foro UTN FRT`;
    document.getElementById('breadcrumb').innerHTML = `
      <a href="/">Inicio</a><span aria-hidden="true">›</span>
      <a href="/posts.html?category_id=${post.category_id}">${escapeHtml(post.category_name)}</a>
    `;

    const image = safeUrl(post.image_url);
    container.innerHTML = `
      <article class="card post-detail">
        ${renderVotes('post', post.id, post.vote_count, post.my_vote)}
        <div class="post-detail-body">
          <div class="post-meta">
            ${renderAvatar(post.avatar_url, post.username, 'xs')}
            <a href="/profile.html?user_id=${post.user_id}" class="post-meta-user">${escapeHtml(post.username)}</a>
            <span aria-hidden="true">·</span>
            <a href="/posts.html?category_id=${post.category_id}" class="post-meta-category">${escapeHtml(post.category_name)}</a>
            <span aria-hidden="true">·</span>
            <time datetime="${escapeHtml(post.created_at)}" title="${escapeHtml(new Date(post.created_at).toLocaleString('es-AR'))}">${timeAgo(post.created_at)}</time>
            ${post.updated_at && new Date(post.updated_at) - new Date(post.created_at) > 60000 ? '<span class="text-muted">(editado)</span>' : ''}
          </div>

          <div id="post-view">
            <h1 class="text-2xl font-bold text-primary mt-2 break-words">${escapeHtml(post.title)}</h1>
            ${post.tags && post.tags.length > 0 ? `<div class="flex flex-wrap gap-1.5 mt-2">${post.tags.map(renderTag).join('')}</div>` : ''}
            <div class="post-content mt-4">${escapeHtml(post.content)}</div>
            ${image ? `<a href="${image}" target="_blank" rel="noopener"><img src="${image}" alt="Imagen del post" class="post-image" onerror="this.remove()"></a>` : ''}
          </div>

          <form id="edit-post-form" class="hidden space-y-3 mt-3">
            <input type="text" name="title" required maxlength="200" aria-label="Título" class="w-full input-field rounded-lg px-3 py-2 text-sm">
            <textarea name="content" required rows="8" maxlength="20000" aria-label="Contenido" class="w-full input-field rounded-lg px-3 py-2 text-sm"></textarea>
            <div class="flex gap-2 justify-end">
              <button type="button" data-action="cancel-edit-post" class="btn-ghost px-4 py-1.5 rounded-full text-sm">Cancelar</button>
              <button type="submit" class="btn-primary px-4 py-1.5 rounded-full text-sm font-semibold">Guardar</button>
            </div>
          </form>

          <div class="post-actions">
            <a href="#comments-section" class="action-btn" id="post-comment-count">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 4.5A2.5 2.5 0 015.5 2h9A2.5 2.5 0 0117 4.5v7a2.5 2.5 0 01-2.5 2.5H9l-4 3.5V14h0A2.5 2.5 0 013 11.5z"/></svg>
              ${pluralize(post.comment_count || 0, 'comentario', 'comentarios')}
            </a>
            <button type="button" data-action="share" class="action-btn">Compartir</button>
            ${canModify(post.user_id) ? `
              <button type="button" data-action="edit-post" class="action-btn">Editar</button>
              <button type="button" data-action="delete-post" class="action-btn action-danger">Eliminar</button>
            ` : ''}
            ${canReport(post.user_id) ? `<button type="button" data-action="report" data-type="post" data-id="${post.id}" class="action-btn">Reportar</button>` : ''}
          </div>
        </div>
      </article>
    `;

    document.getElementById('comments-section').classList.remove('hidden');
    setupCommentForm();
    loadComments();
  } catch (err) {
    container.innerHTML = err.status === 404
      ? renderEmptyState('Este post no existe', 'Puede que lo hayan borrado.')
      : renderEmptyState('No se pudo cargar el post', errorMessage(err, ''));
  }
}

function showEditPost() {
  const form = document.getElementById('edit-post-form');
  form.title.value = currentPost.title;
  form.content.value = currentPost.content;
  document.getElementById('post-view').classList.add('hidden');
  form.classList.remove('hidden');
  form.title.focus();
}

function hideEditPost() {
  document.getElementById('edit-post-form').classList.add('hidden');
  document.getElementById('post-view').classList.remove('hidden');
}

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'edit-post-form') return;
  e.preventDefault();
  const form = e.target;
  try {
    await api.put(`/posts/${postId}`, { title: form.title.value.trim(), content: form.content.value.trim() });
    toast('Post actualizado', 'success');
    loadPost();
  } catch (err) {
    toast(errorMessage(err, 'Error al editar el post'), 'error');
  }
});

async function deletePost() {
  if (!(await confirmDialog('¿Eliminar este post? Se borran también sus comentarios.', { confirmText: 'Eliminar', danger: true }))) return;
  try {
    await api.delete(`/posts/${postId}`);
    window.location.href = currentPost ? `/posts.html?category_id=${currentPost.category_id}` : '/';
  } catch (err) {
    toast(errorMessage(err, 'Error al eliminar'), 'error');
  }
}

async function sharePost() {
  const url = window.location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: currentPost.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast('Enlace copiado', 'success');
    }
  } catch {}
}

/* ---------- Comentarios ---------- */

function setupCommentForm() {
  const form = document.getElementById('comment-form');
  if (!isLoggedIn()) {
    form.outerHTML = `
      <div class="login-cta">
        <span class="text-secondary text-sm">Iniciá sesión para sumarte a la conversación.</span>
        <div class="flex gap-2">
          <a href="/login.html" onclick="localStorage.setItem('returnUrl', location.pathname + location.search)" class="btn-primary px-4 py-1.5 rounded-full text-sm font-semibold">Iniciar sesión</a>
          <a href="/register.html" class="btn-ghost px-4 py-1.5 rounded-full text-sm">Registrarme</a>
        </div>
      </div>
    `;
    return;
  }
  if (form.dataset.ready) return;
  form.dataset.ready = '1';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = form.content.value.trim();
    if (!content) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api.post(`/posts/${postId}/comments`, { content });
      form.reset();
      loadComments();
    } catch (err) {
      toast(errorMessage(err, 'Error al comentar'), 'error');
    } finally {
      button.disabled = false;
    }
  });
}

async function loadComments(page = commentsPage) {
  commentsPage = page;
  const container = document.getElementById('comments');

  try {
    const result = await api.get(`/posts/${postId}/comments?page=${page}`);
    document.getElementById('comments-title').textContent = result.total_comments > 0
      ? pluralize(result.total_comments, 'comentario', 'comentarios')
      : 'Comentarios';
    const countLink = document.getElementById('post-comment-count');
    if (countLink) countLink.lastChild.textContent = ` ${pluralize(result.total_comments, 'comentario', 'comentarios')}`;

    if (result.data.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm text-center py-6">Todavía no hay comentarios. ¡Sé el primero!</p>';
      document.getElementById('comments-pagination').innerHTML = '';
      return;
    }

    container.innerHTML = result.data.map((c) => renderComment(c, 0)).join('');
    renderPagination('comments-pagination', result.pages, result.page, loadComments);

    // Link directo a un comentario (desde el perfil): se carga async, así que el scroll va acá
    const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (target && target.classList.contains('comment') && !target.dataset.seen) {
      target.dataset.seen = '1';
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('comment-highlight');
    }
  } catch {
    container.innerHTML = '<p class="text-sm" style="color: var(--red)">Error al cargar comentarios</p>';
  }
}

function renderComment(comment, depth) {
  const replies = (comment.replies || []).map((r) => renderComment(r, depth + 1)).join('');
  const isAuthor = currentPost && comment.user_id === currentPost.user_id;

  return `
    <div class="comment ${depth > 0 ? 'comment-reply' : 'card'}" id="comment-${comment.id}" data-comment-id="${comment.id}">
      <div class="comment-head">
        ${renderAvatar(comment.avatar_url, comment.username, 'xs')}
        <a href="/profile.html?user_id=${comment.user_id}" class="font-medium text-primary hover:underline">${escapeHtml(comment.username)}</a>
        ${isAuthor ? '<span class="badge badge-op" title="Autor del post">autor</span>' : ''}
        <span class="text-muted" aria-hidden="true">·</span>
        <time class="text-muted" datetime="${escapeHtml(comment.created_at)}" title="${escapeHtml(new Date(comment.created_at).toLocaleString('es-AR'))}">${timeAgo(comment.created_at)}</time>
      </div>
      <div class="comment-content" data-role="content">${escapeHtml(comment.content)}</div>
      <form class="hidden space-y-2 mt-2" data-role="edit-form">
        <textarea name="content" required rows="3" maxlength="10000" aria-label="Editar comentario" class="w-full input-field rounded-lg px-3 py-2 text-sm"></textarea>
        <div class="flex gap-2 justify-end">
          <button type="button" data-action="cancel-edit-comment" class="btn-ghost px-3 py-1 rounded-full text-xs">Cancelar</button>
          <button type="submit" class="btn-primary px-3 py-1 rounded-full text-xs font-semibold">Guardar</button>
        </div>
      </form>
      <div class="comment-actions">
        ${renderVotes('comment', comment.id, comment.vote_count, comment.my_vote, { horizontal: true })}
        <button type="button" data-action="reply" class="action-btn">Responder</button>
        ${canModify(comment.user_id) ? `
          <button type="button" data-action="edit-comment" class="action-btn">Editar</button>
          <button type="button" data-action="delete-comment" class="action-btn action-danger">Eliminar</button>
        ` : ''}
        ${canReport(comment.user_id) ? `<button type="button" data-action="report" data-type="comment" data-id="${comment.id}" class="action-btn">Reportar</button>` : ''}
      </div>
      <form class="hidden space-y-2 mt-2" data-role="reply-form">
        <textarea name="content" required rows="2" maxlength="10000" placeholder="Tu respuesta…" aria-label="Tu respuesta" class="w-full input-field rounded-lg px-3 py-2 text-sm"></textarea>
        <div class="flex gap-2 justify-end">
          <button type="button" data-action="cancel-reply" class="btn-ghost px-3 py-1 rounded-full text-xs">Cancelar</button>
          <button type="submit" class="btn-primary px-3 py-1 rounded-full text-xs font-semibold">Responder</button>
        </div>
      </form>
      ${replies ? `<div class="comment-replies ${depth >= 5 ? 'comment-replies-flat' : ''}">${replies}</div>` : ''}
    </div>
  `;
}

function commentEl(target) {
  return target.closest('[data-comment-id]');
}

/** Formularios dentro del propio comentario (no los de sus respuestas) */
function ownPart(el, role) {
  return Array.from(el.querySelectorAll(`[data-role="${role}"]`)).find((node) => commentEl(node) === el);
}

document.addEventListener('submit', async (e) => {
  const form = e.target;
  const role = form.dataset.role;
  if (role !== 'reply-form' && role !== 'edit-form') return;
  e.preventDefault();

  const el = commentEl(form);
  const commentId = Number(el.dataset.commentId);
  const content = form.content.value.trim();
  if (!content) return;

  try {
    if (role === 'reply-form') {
      await api.post(`/posts/${postId}/comments`, { content, parent_id: commentId });
    } else {
      await api.put(`/posts/${postId}/comments/${commentId}`, { content });
    }
    loadComments();
  } catch (err) {
    toast(errorMessage(err, role === 'reply-form' ? 'Error al responder' : 'Error al editar'), 'error');
  }
});

/* ---------- Reportes ---------- */

function showReportModal(type, id) {
  if (!isLoggedIn()) {
    showLoginPrompt('reportar');
    return;
  }

  const overlay = openModal(`
    <h3 class="text-lg font-bold text-primary mb-1">Reportar ${type === 'post' ? 'post' : 'comentario'}</h3>
    <p class="text-secondary text-sm mb-4">¿Qué problema tiene?</p>
    <form id="report-form" class="space-y-3">
      <div class="space-y-1">
        ${REPORT_REASONS.map(([value, label], i) => `
          <label class="radio-row">
            <input type="radio" name="reason" value="${value}" ${i === 0 ? 'required' : ''}> ${label}
          </label>
        `).join('')}
      </div>
      <textarea name="description" rows="2" maxlength="1000" placeholder="Detalle (opcional)" aria-label="Detalle"
                class="w-full input-field rounded-lg px-3 py-2 text-sm"></textarea>
      <div class="flex gap-2 justify-end">
        <button type="button" onclick="closeModal('report-overlay')" class="btn-ghost px-4 py-1.5 rounded-full text-sm">Cancelar</button>
        <button type="submit" class="btn-primary px-4 py-1.5 rounded-full text-sm font-semibold">Enviar reporte</button>
      </div>
    </form>
  `, { id: 'report-overlay' });

  overlay.querySelector('#report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = { reason: form.reason.value, description: form.description.value.trim() || null };
    body[type === 'post' ? 'post_id' : 'comment_id'] = id;
    try {
      await api.post('/reports', body);
      closeModal('report-overlay');
      toast('Reporte enviado. ¡Gracias por avisar!', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Error al enviar el reporte'), 'error');
    }
  });
}

/* ---------- Acciones (un solo listener) ---------- */

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const el = commentEl(btn);

  switch (action) {
    case 'edit-post': return showEditPost();
    case 'cancel-edit-post': return hideEditPost();
    case 'delete-post': return deletePost();
    case 'share': return sharePost();
    case 'report': return showReportModal(btn.dataset.type, Number(btn.dataset.id));

    case 'reply': {
      if (!isLoggedIn()) return showLoginPrompt('responder');
      const form = ownPart(el, 'reply-form');
      form.classList.remove('hidden');
      form.content.focus();
      return;
    }
    case 'cancel-reply':
      ownPart(el, 'reply-form').classList.add('hidden');
      return;

    case 'edit-comment': {
      const form = ownPart(el, 'edit-form');
      const content = ownPart(el, 'content');
      form.content.value = content.textContent;
      content.classList.add('hidden');
      form.classList.remove('hidden');
      form.content.focus();
      return;
    }
    case 'cancel-edit-comment':
      ownPart(el, 'edit-form').classList.add('hidden');
      ownPart(el, 'content').classList.remove('hidden');
      return;

    case 'delete-comment': {
      if (!(await confirmDialog('¿Eliminar este comentario? También se borran sus respuestas.', { confirmText: 'Eliminar', danger: true }))) return;
      try {
        await api.delete(`/posts/${postId}/comments/${el.dataset.commentId}`);
        loadComments();
      } catch (err) {
        toast(errorMessage(err, 'Error al eliminar'), 'error');
      }
    }
  }
});

loadPost();
