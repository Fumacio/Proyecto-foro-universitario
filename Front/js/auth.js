function getReturnUrl() {
  const url = localStorage.getItem('returnUrl');
  localStorage.removeItem('returnUrl');
  return url || '/';
}

function handleAuthSuccess(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  window.location.href = getReturnUrl();
}

function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    msg.textContent = '';

    try {
      const data = await api.post('/auth/register', {
        username: form.username.value.trim(),
        email: form.email.value.trim(),
        password: form.password.value
      });
      handleAuthSuccess(data);
    } catch (err) {
      msg.textContent = err.error || 'Error al registrarse';
      msg.className = 'text-sm mt-2';
      msg.style.color = 'var(--red)';
    }
  });
}
