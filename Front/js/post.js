let postId = null;
let commentsLoaded = false;

function getPostId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function toggleComments() {
  if (!isLoggedIn()) {
    showLoginPrompt('comentar');
    return;
  }

  const section = document.getElementById('comments-section');
  const isHidden = section.classList.contains('hidden');

  if (isHidden) {
    section.classList.remove('hidden');
    if (!commentsLoaded) {
      loadComments();
      commentsLoaded = true;
    }
  } else {
    section.classList.add('hidden');
  }
}

async function loadPost() {
  postId = getPostId();
  if (!postId) {
    window.location.href = '/';
    return;
  }

  const container = document.getElementById('post-detail');

  try {
    const post = await api.get(`/posts/${postId}`);
    document.title = `ForoU - ${post.title}`;

    const user = getUser();
    const canEdit = user && (user.id === post.user_id || user.role === 'admin');

    container.innerHTML = `
      <div class="card rounded-lg p-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h1 class="text-2xl font-bold text-primary">${post.title}</h1>
            <div class="flex items-center gap-3 mt-2 text-sm text-secondary">
              <span>por <a href="/profile.html?user_id=${post.user_id}" class="link-theme hover:underline">${post.username}</a></span>
              <span>${new Date(post.created_at).toLocaleDateString('es-AR')}</span>
              <a href="/posts.html?category_id=${post.category_id}" class="link-theme hover:underline">${post.category_name}</a>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${canEdit ? `
              <button onclick="deletePost()" class="text-sm" style="color: var(--red)">Eliminar</button>
            ` : ''}
          </div>
        </div>
        <div class="text-secondary whitespace-pre-wrap">${post.content}</div>
        <div class="flex items-center gap-3 mt-4 pt-4 border-t border-theme">
          <div class="vote-group">
            <button onclick="isLoggedIn() ? votePost(1) : showLoginPrompt('votar')" class="vote-btn vote-btn-up" title="Upvote">▲</button>
            <span id="post-votes" class="vote-count ${post.vote_count > 0 ? 'vote-positive' : post.vote_count < 0 ? 'vote-negative' : 'vote-neutral'}">${post.vote_count}</span>
            <button onclick="isLoggedIn() ? votePost(-1) : showLoginPrompt('votar')" class="vote-btn vote-btn-down" title="Downvote">▼</button>
          </div>
          <button onclick="toggleComments()" class="btn-secondary px-3 py-1.5 rounded text-sm font-medium ml-2 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.678 11.894a1 1 0 0 1 .287.801 10.97 10.97 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8.06 8.06 0 0 0 8 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 0 1-.713.129c-.2.032-.352-.176-.298-.378a10.264 10.264 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.78 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  } catch {
    container.innerHTML = '<p style="color: var(--red)">Error al cargar el post</p>';
  }
}

async function loadComments() {
  const container = document.getElementById('comments');

  try {
    const comments = await api.get(`/posts/${postId}/comments`);

    if (comments.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm">No hay comentarios todavía</p>';
      return;
    }

    container.innerHTML = comments.map(c => renderComment(c)).join('');
  } catch {
    container.innerHTML = '<p style="color: var(--red)">Error al cargar comentarios</p>';
  }
}

function renderComment(comment, depth = 0) {
  const user = getUser();
  const canEdit = user && (user.id === comment.user_id || user.role === 'admin');

  const card = `
    <div class="card rounded-lg p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2 text-sm">
          <span class="font-medium text-primary">${comment.username}</span>
          <span class="text-muted">·</span>
          <span class="text-muted">${new Date(comment.created_at).toLocaleDateString('es-AR')}</span>
        </div>
        <div class="flex items-center gap-2">
          ${canEdit ? `
            <button onclick="deleteComment(${comment.id})" class="text-xs" style="color: var(--red)">Eliminar</button>
          ` : ''}
        </div>
      </div>
      <p class="text-secondary text-sm whitespace-pre-wrap">${comment.content}</p>
      <div class="flex items-center gap-3 mt-2">
        <div class="vote-group">
          <button onclick="isLoggedIn() ? voteComment(${comment.id}, 1) : showLoginPrompt('votar')" class="vote-btn vote-btn-up">▲</button>
          <span class="vote-count ${comment.vote_count > 0 ? 'vote-positive' : comment.vote_count < 0 ? 'vote-negative' : 'vote-neutral'}">${comment.vote_count}</span>
          <button onclick="isLoggedIn() ? voteComment(${comment.id}, -1) : showLoginPrompt('votar')" class="vote-btn vote-btn-down">▼</button>
        </div>
        <button onclick="isLoggedIn() ? replyTo(${comment.id}) : showLoginPrompt('responder')" class="link-theme hover:underline text-xs">Responder</button>
      </div>
      <div id="reply-form-${comment.id}" class="hidden mt-2">
        <form onsubmit="submitReply(event, ${comment.id})" class="space-y-2">
          <textarea placeholder="Tu respuesta..." required rows="2" class="w-full input-field rounded px-2 py-1 text-sm"></textarea>
          <div class="flex gap-2">
            <button type="submit" class="btn-primary px-3 py-1 rounded text-xs">Enviar</button>
            <button type="button" onclick="hideReplyForm(${comment.id})" class="text-muted text-xs">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const replies = (comment.replies || []).map(r => renderComment(r, depth + 1)).join('');

  if (replies) {
    return card + `<div class="ml-6 mt-2 space-y-3" style="border-left: 2px solid var(--border); padding-left: 12px;">${replies}</div>`;
  }

  return card;
}

function replyTo(commentId) {
  document.getElementById(`reply-form-${commentId}`).classList.remove('hidden');
}

function hideReplyForm(commentId) {
  document.getElementById(`reply-form-${commentId}`).classList.add('hidden');
}

async function submitReply(e, parentId) {
  e.preventDefault();
  const form = e.target;
  const content = form.querySelector('textarea').value.trim();

  try {
    await api.post(`/posts/${postId}/comments`, { content, parent_id: parentId });
    form.reset();
    hideReplyForm(parentId);
    loadComments();
  } catch (err) {
    alert(err.error || 'Error al responder');
  }
}

async function votePost(value) {
  try {
    const data = await api.put(`/posts/${postId}/vote`, { value });
    const el = document.getElementById('post-votes');
    el.textContent = data.vote_count;
    el.className = `vote-count ${data.vote_count > 0 ? 'vote-positive' : data.vote_count < 0 ? 'vote-negative' : 'vote-neutral'}`;
  } catch (err) {
    alert(err.error || 'Error al votar');
  }
}

async function voteComment(commentId, value) {
  try {
    await api.put(`/comments/${commentId}/vote`, { value });
    loadComments();
  } catch (err) {
    alert(err.error || 'Error al votar');
  }
}

async function deletePost() {
  if (!confirm('¿Eliminar este post?')) return;
  try {
    await api.delete(`/posts/${postId}`);
    window.location.href = '/';
  } catch (err) {
    alert(err.error || 'Error al eliminar');
  }
}

async function deleteComment(commentId) {
  if (!confirm('¿Eliminar este comentario?')) return;
  try {
    await api.delete(`/posts/${postId}/comments/${commentId}`);
    loadComments();
  } catch (err) {
    alert(err.error || 'Error al eliminar');
  }
}

document.getElementById('comment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isLoggedIn()) {
    showLoginPrompt('comentar');
    return;
  }
  const form = e.target;
  const content = form.content.value.trim();

  try {
    await api.post(`/posts/${postId}/comments`, { content });
    form.reset();
    loadComments();
  } catch (err) {
    alert(err.error || 'Error al comentar');
  }
});

loadPost();
