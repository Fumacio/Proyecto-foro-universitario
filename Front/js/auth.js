function getReturnUrl() {
  const url = localStorage.getItem('returnUrl');
  localStorage.removeItem('returnUrl');
  return url || '/';
}

function showAuthMsgIfAny() {
  const msg = sessionStorage.getItem('authMsg');
  if (!msg) return;
  sessionStorage.removeItem('authMsg');
  const el = document.getElementById('msg');
  if (el) {
    el.textContent = msg;
    el.style.color = 'var(--red)';
  }
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
    const msg = document.getElementById('msg');
    msg.textContent = '';

    try {
      const data = await api.post('/auth/login', {
        email: form.email.value.trim(),
        password: form.password.value
      });
      handleAuthSuccess(data);
    } catch (err) {
      msg.textContent = err.error || 'Error al iniciar sesión';
      msg.className = 'text-sm mt-2';
      msg.style.color = 'var(--red)';
    }
  });
}

function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  showAuthMsgIfAny();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    msg.textContent = '';

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
      msg.textContent = err.error || 'Error al registrarse';
      msg.className = 'text-sm mt-2';
      msg.style.color = 'var(--red)';
    }
  });
}
