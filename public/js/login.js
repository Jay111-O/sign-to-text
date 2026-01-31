import { setToken, setUser } from './auth.js';

const form = document.getElementById('login-form');
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
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) {
    showError('Email and password are required.');
    return;
  }
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in…';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.error || 'Sign in failed.');
      return;
    }
    setToken(data.token);
    setUser(data.user);
    window.location.href = '/';
  } catch (err) {
    showError('Network error. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';
  }
});
