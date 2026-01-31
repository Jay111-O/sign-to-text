import { setToken, setUser } from './auth.js';

const form = document.getElementById('register-form');
const errorEl = document.getElementById('auth-error');
const submitBtn = document.getElementById('submit-btn');

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('show');
}

function hideError() {
  errorEl.textContent = '';
  errorEl.classList.remove('show');
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const name = form.name.value.trim();
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;
  const confirm = form.confirm.value;
  if (!email || !password) {
    showError('Email and password are required.');
    return;
  }
  if (password.length < 6) {
    showError('Password must be at least 6 characters.');
    return;
  }
  if (password !== confirm) {
    showError('Passwords do not match.');
    return;
  }
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account…';
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.error || 'Registration failed.');
      return;
    }
    setToken(data.token);
    setUser(data.user);
    window.location.href = '/';
  } catch (err) {
    showError('Network error. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Register';
  }
});
