/**
 * Dual-mode chat: session, messages, copy, share (requires auth)
 */
import { authFetch, getToken } from './auth.js';

const chatSpeechEl = document.getElementById('chat-speech');
const chatSignEl = document.getElementById('chat-sign');
const copyBtn = document.getElementById('copy-chat-btn');
const shareBtn = document.getElementById('share-chat-btn');

if (!chatSpeechEl || !chatSignEl) throw new Error('Chat DOM elements not found');

let sessionId = null;

export async function ensureSession() {
  if (sessionId) return sessionId;
  if (!getToken()) return null;
  try {
    const res = await authFetch('/api/chat/session', { method: 'POST' });
    const data = await res.json();
    sessionId = data.sessionId;
  } catch (_) {
    sessionId = null;
  }
  return sessionId;
}

export async function addMessage(type, content, source = 'user') {
  const fallbackMsg = {
    id: 'local-' + Date.now(),
    type,
    content,
    source,
    timestamp: new Date().toISOString(),
  };
  try {
    const sid = await ensureSession();
    if (!sid) {
      renderMessage(fallbackMsg);
      return fallbackMsg;
    }
    const res = await authFetch(`/api/chat/${sid}/message`, {
      method: 'POST',
      body: JSON.stringify({ type, content, source }),
    });
    if (res.ok) {
      const msg = await res.json();
      renderMessage(msg);
      return msg;
    }
  } catch (_) {
    // Unauthorized or offline: still show in UI
  }
  renderMessage(fallbackMsg);
  return fallbackMsg;
}

function renderMessage(msg) {
  const container = msg.type === 'speech-to-sign' ? chatSpeechEl : chatSignEl;
  const div = document.createElement('div');
  div.className = `chat-message ${msg.type === 'sign-to-text' ? 'sign-side' : ''}`;
  div.innerHTML = `
    <div class="content">${escapeHtml(msg.content)}</div>
    <div class="time">${formatTime(msg.timestamp)}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export async function loadHistory() {
  if (!sessionId || !getToken()) return;
  try {
    const res = await authFetch(`/api/chat/${sessionId}`);
    if (!res.ok) return;
    const messages = await res.json();
    chatSpeechEl.innerHTML = '';
    chatSignEl.innerHTML = '';
    messages.forEach(renderMessage);
  } catch (_) {}
}

function getFullConversation() {
  const left = Array.from(chatSpeechEl.querySelectorAll('.chat-message .content')).map((el) => el.textContent);
  const right = Array.from(chatSignEl.querySelectorAll('.chat-message .content')).map((el) => el.textContent);
  const lines = [];
  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i++) {
    lines.push(`[Speech→Sign] ${left[i] || '—'}`);
    lines.push(`[Sign→Text]  ${right[i] || '—'}`);
  }
  return lines.join('\n');
}

function showToast(message) {
  let toast = document.getElementById('signbridge-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'signbridge-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

copyBtn?.addEventListener('click', async () => {
  const text = getFullConversation();
  if (!text.trim()) {
    showToast('No messages to copy');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Conversation copied to clipboard');
  } catch {
    showToast('Could not copy');
  }
});

shareBtn?.addEventListener('click', async () => {
  const text = getFullConversation();
  if (!text.trim()) {
    showToast('No messages to share');
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'SignBridge conversation',
        text,
      });
      showToast('Shared');
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Share failed');
    }
  } else {
    await navigator.clipboard.writeText(text);
    showToast('Conversation copied (share not supported)');
  }
});

export { sessionId };
