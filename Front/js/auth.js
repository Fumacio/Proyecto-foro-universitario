function getReturnUrl() {
  const url = localStorage.getItem('returnUrl');
  localStorage.removeItem('returnUrl');
  // Solo rutas internas (evita redirigir a otro sitio)
  return url && url.startsWith('/') && !url.startsWith('//') && !/\/(login|register)\.html/.test(url) ? url : '/';
}

function showMsg(text, type = 'error') {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = text;
  el.className = `form-msg form-msg-${type}`;
}

function showAuthMsgIfAny() {
  const msg = sessionStorage.getItem('authMsg');
  if (!msg) return;
  sessionStorage.removeItem('authMsg');
  showMsg(msg);
}

function handleAuthSuccess(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  window.location.href = getReturnUrl();
}

function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  showAuthMsgIfAny();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    showMsg('');
    button.disabled = true;

    try {
      const data = await api.post('/auth/login', {
        email: form.email.value.trim(),
        password: form.password.value
      });
      handleAuthSuccess(data);
    } catch (err) {
      showMsg(errorMessage(err, 'Error al iniciar sesión'));
      button.disabled = false;
    }
  });
}

function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  showAuthMsgIfAny();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    showMsg('');
    button.disabled = true;

    try {
      const data = await api.post('/auth/register', {
        username: form.username.value.trim(),
        email: form.email.value.trim(),
        password: form.password.value,
        first_name: form.first_name.value.trim() || null,
        last_name: form.last_name.value.trim() || null,
        age: form.age.value ? Number(form.age.value) : null,
        commission: form.commission.value.trim() || null,
        career: form.career.value || null,
        gender: form.gender.value || null
      });
      handleAuthSuccess(data);
    } catch (err) {
      showMsg(errorMessage(err, 'Error al registrarse'));
      button.disabled = false;
    }
  });
}
