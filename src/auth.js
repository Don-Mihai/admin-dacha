const USERS_KEY = 'admin_users';
const SESSION_KEY = 'admin_session';
const ROLES = ['admin', 'editor', 'viewer'];

const DEFAULT_USERS = [{ id: '1', username: 'admin', password: 'admin', role: 'admin' }];

export function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return [...DEFAULT_USERS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return [...DEFAULT_USERS];
    }
    return parsed;
  } catch {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    return [...DEFAULT_USERS];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role };
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const users = getUsers();
    const user = users.find((u) => u.id === session.id);
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return publicUser(user);
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function login(username, password) {
  const users = getUsers();
  const user = users.find((u) => u.username === username.trim() && u.password === password);
  if (!user) return null;
  const session = publicUser(user);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function listUsers() {
  return getUsers().map(publicUser);
}

export function createUser({ username, password, role }) {
  const name = String(username || '').trim();
  const pass = String(password || '');
  const r = String(role || '').trim();
  if (!name || !pass) throw new Error('Логин и пароль обязательны');
  if (!ROLES.includes(r)) throw new Error('Некорректная роль');
  const users = getUsers();
  if (users.some((u) => u.username === name)) throw new Error('Пользователь с таким логином уже есть');
  const user = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: name,
    password: pass,
    role: r,
  };
  users.push(user);
  saveUsers(users);
  return publicUser(user);
}

export function updateUser(id, { username, password, role }) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('Пользователь не найден');
  const user = users[idx];
  if (username != null) {
    const name = String(username).trim();
    if (!name) throw new Error('Логин обязателен');
    if (users.some((u) => u.username === name && u.id !== id)) {
      throw new Error('Пользователь с таким логином уже есть');
    }
    user.username = name;
  }
  if (password != null && String(password) !== '') {
    user.password = String(password);
  }
  if (role != null) {
    const r = String(role).trim();
    if (!ROLES.includes(r)) throw new Error('Некорректная роль');
    if (user.role === 'admin' && r !== 'admin') {
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) throw new Error('Нельзя снять роль с последнего админа');
    }
    user.role = r;
  }
  users[idx] = user;
  saveUsers(users);
  const session = getSession();
  if (session && session.id === id) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(publicUser(user)));
  }
  return publicUser(user);
}

export function deleteUser(id, currentUserId) {
  if (id === currentUserId) throw new Error('Нельзя удалить самого себя');
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('Пользователь не найден');
  if (users[idx].role === 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) throw new Error('Нельзя удалить последнего админа');
  }
  users.splice(idx, 1);
  saveUsers(users);
}
