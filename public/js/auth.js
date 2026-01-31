/**
 * Auth: token storage, auth fetch, redirect to login
 */
const TOKEN_KEY = 'signbridge_token';
const USER_KEY = 'signbridge_user';
const API_BASE = '';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function logout() {
  setToken(null);
  setUser(null);
  window.location.href = '/login';
}

export function authHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function authFetch(url, options = {}) {
  const res = await fetch(API_BASE + url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  return res;
}

export async function checkAuth() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await authFetch('/api/auth/me');
    if (!res.ok) return null;
    const user = await res.json();
    setUser(user);
    return user;
  } catch {
    return null;
  }
}

export function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = '/login';
    return false;
  }
  return true;
}
