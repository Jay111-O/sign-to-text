/**
 * SignBridge app: auth check, wire Speech-to-Sign, Sign-to-Text, and Chat
 */
import { requireAuth, getUser, logout } from './auth.js';
import * as speechToSign from './speech-to-sign.js';
import * as signToText from './sign-to-text.js';
import * as chat from './chat.js';

function renderUserBar() {
  const user = getUser();
  const bar = document.getElementById('user-bar');
  const nameEl = document.getElementById('user-name');
  const logoutBtn = document.getElementById('logout-btn');
  if (!bar) return;
  if (user) {
    if (nameEl) nameEl.textContent = user.name || user.email;
    if (logoutBtn) {
      logoutBtn.hidden = false;
      logoutBtn.onclick = () => logout();
    }
  } else {
    if (logoutBtn) logoutBtn.hidden = true;
  }
}

async function init() {
  if (!requireAuth()) return;
  renderUserBar();

  await chat.ensureSession();
  await chat.loadHistory();

  speechToSign.setOnTranscriptCallback(async (text) => {
    if (text.trim()) await chat.addMessage('speech-to-sign', text, 'user');
  });

  signToText.setOnSignCallback(async (text) => {
    if (text && text.trim()) {
      await chat.addMessage('sign-to-text', text.trim(), 'user');
      signToText.clearSignBuffer();
    }
  });
}

init().catch(console.error);
