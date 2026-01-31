const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'signbridge-secret-change-in-production';
const JWT_EXPIRES = '7d';

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// In-memory stores (loaded from / persisted to file for users)
let users = new Map(); // id -> { id, email, name, passwordHash, createdAt }
const chatSessions = new Map(); // sessionId -> { userId, messages, createdAt }

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      users = new Map(data.users.map((u) => [u.id, u]));
    }
  } catch (err) {
    console.warn('Could not load users:', err.message);
  }
}

function saveUsers() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = { users: Array.from(users.values()) };
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not save users:', err.message);
  }
}

loadUsers();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve login/register pages before static (so GET /login and GET /register work)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = users.get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ----- Auth -----
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedName = (name || '').trim();
  if (!trimmedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const existing = Array.from(users.values()).find((u) => u.email === trimmedEmail);
  if (existing) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id,
    email: trimmedEmail,
    name: trimmedName || trimmedEmail.split('@')[0],
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.set(id, user);
  saveUsers();
  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const trimmedEmail = (email || '').trim().toLowerCase();
  if (!trimmedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = Array.from(users.values()).find((u) => u.email === trimmedEmail);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// ----- Chat (protected) -----
app.post('/api/chat/session', authMiddleware, (req, res) => {
  const sessionId = uuidv4();
  chatSessions.set(sessionId, {
    userId: req.user.id,
    messages: [],
    createdAt: Date.now(),
  });
  res.json({ sessionId });
});

app.post('/api/chat/:sessionId/message', authMiddleware, (req, res) => {
  const { sessionId } = req.params;
  const { type, content, source } = req.body;
  const session = chatSessions.get(sessionId);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const message = {
    id: uuidv4(),
    type,
    content,
    source,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(message);
  res.json(message);
});

app.get('/api/chat/:sessionId', authMiddleware, (req, res) => {
  const session = chatSessions.get(req.params.sessionId);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session.messages);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`SignBridge server running at http://localhost:${PORT}`);
});
