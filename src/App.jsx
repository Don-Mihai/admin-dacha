import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ThemeProvider,
  createTheme,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  Box,
  Tabs,
  Tab,
  Button,
  TextField,
  Alert,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Chip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LogoutIcon from '@mui/icons-material/Logout';
import SyncIcon from '@mui/icons-material/Sync';

const DRAWER_WIDTH = 280;
const API = '/api';
const TOKEN_KEY = 'utkina_cms_token';
const USER_KEY = 'utkina_cms_user';

const theme = createTheme({
  typography: { fontFamily: '"Roboto", sans-serif' },
});

function isArrayOfObjects(data) {
  return Array.isArray(data) && data.length > 0 && data.every((item) => item && typeof item === 'object' && !Array.isArray(item));
}

function getTableableArrays(data) {
  if (!data) return [];
  const list = [];
  if (isArrayOfObjects(data)) list.push({ key: null, label: '(корень)', data });
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (isArrayOfObjects(value)) list.push({ key, label: key, data: value });
    }
  }
  return list;
}

function getAllKeys(arr) {
  const set = new Set();
  arr.forEach((obj) => Object.keys(obj).forEach((k) => set.add(k)));
  return [...set];
}

function renderCell(value) {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  const s = String(value);
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
}

function isEditableValue(value) {
  return value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function getStoredAuth() {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const userRaw = sessionStorage.getItem(USER_KEY);
    const user = userRaw ? JSON.parse(userRaw) : null;
    return token && user ? { token, user } : null;
  } catch {
    return null;
  }
}

async function apiFetch(path, { token, method = 'GET', body, headers = {} } = {}) {
  const opts = {
    method,
    headers: { ...headers },
  };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    if (body instanceof FormData) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = (data && data.error) || res.statusText || 'Request failed';
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

function LoginScreen({ onLogin }) {
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: { login, password },
      });
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
        <Paper sx={{ p: 4, width: 360 }} component='form' onSubmit={submit}>
          <Typography variant='h6' gutterBottom>
            CMS Уткина дача
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Вход по JWT (ролевой доступ)
          </Typography>
          {error && (
            <Alert severity='error' sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label='Логин'
            fullWidth
            margin='normal'
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoFocus
          />
          <TextField
            label='Пароль'
            type='password'
            fullWidth
            margin='normal'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type='submit' variant='contained' fullWidth sx={{ mt: 2 }} disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </Button>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

function UsersTab({ token }) {
  const [users, setUsers] = useState([]);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const data = await apiFetch('/auth/users', { token });
    setUsers(data.users || []);
  }, [token]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const createUser = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/auth/users', { token, method: 'POST', body: { login, password, role } });
      setLogin('');
      setPassword('');
      setMessage('Пользователь создан');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity='error' sx={{ mb: 1 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity='success' sx={{ mb: 1 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      <Paper sx={{ p: 2, mb: 2, maxWidth: 480 }} component='form' onSubmit={createUser}>
        <Typography variant='subtitle2' gutterBottom>
          Новый пользователь
        </Typography>
        <TextField label='Логин' fullWidth margin='dense' value={login} onChange={(e) => setLogin(e.target.value)} required />
        <TextField
          label='Пароль'
          type='password'
          fullWidth
          margin='dense'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <FormControl fullWidth margin='dense'>
          <InputLabel>Роль</InputLabel>
          <Select value={role} label='Роль' onChange={(e) => setRole(e.target.value)}>
            <MenuItem value='admin'>admin</MenuItem>
            <MenuItem value='editor'>editor</MenuItem>
            <MenuItem value='viewer'>viewer</MenuItem>
          </Select>
        </FormControl>
        <Button type='submit' variant='contained' sx={{ mt: 1 }}>
          Создать
        </Button>
      </Paper>
      <TableContainer component={Paper} sx={{ maxWidth: 640 }}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Логин</TableCell>
              <TableCell>Роль</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.id}</TableCell>
                <TableCell>{u.login}</TableCell>
                <TableCell>{u.role}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => getStoredAuth());
  const token = auth?.token;
  const user = auth?.user;
  const canWrite = user && (user.role === 'admin' || user.role === 'editor');

  const [projects, setProjects] = useState([]);
  const [openProjects, setOpenProjects] = useState({});
  const [currentProject, setCurrentProject] = useState(null);
  const [currentKey, setCurrentKey] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState({ text: '', severity: 'info' });
  const [jsonError, setJsonError] = useState('');
  const [tabIndex, setTabIndex] = useState(0);
  const [dataView, setDataView] = useState('table');
  const [selectedTableKey, setSelectedTableKey] = useState('');
  const [uploadProject, setUploadProject] = useState('');
  const [uploadPath, setUploadPath] = useState('data/images');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '' });
  const fileInputRef = useRef(null);

  const handleLogin = (nextToken, nextUser) => {
    sessionStorage.setItem(TOKEN_KEY, nextToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setAuth({ token: nextToken, user: nextUser });
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setAuth(null);
  };

  const loadProjects = useCallback(async () => {
    if (!token) return;
    const data = await apiFetch('/projects', { token });
    setProjects(data.projects || []);
    setOpenProjects((prev) => {
      const next = { ...prev };
      if (data.projects?.length && !Object.keys(next).length) next[data.projects[0].id] = true;
      return next;
    });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadProjects().catch((e) => {
      if (e.status === 401) handleLogout();
      else setStatus({ text: e.message, severity: 'error' });
    });
  }, [loadProjects, token]);

  useEffect(() => {
    setSelectedTableKey('');
  }, [currentProject, currentKey]);

  if (!auth) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const toggleProject = (id) => setOpenProjects((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectFile = async (projectId, documentKey) => {
    if (dirty && !window.confirm('Несохранённые изменения. Всё равно перейти?')) return;
    setCurrentProject(projectId);
    setCurrentKey(documentKey);
    setDirty(false);
    setJsonError('');
    try {
      const data = await apiFetch(`/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentKey)}`, {
        token,
      });
      setFileContent(JSON.stringify(data.payload, null, 2));
    } catch (err) {
      setStatus({ text: err.message, severity: 'error' });
      setFileContent('');
    }
  };

  const validateAndSave = async () => {
    if (!currentProject || !currentKey) return;
    if (!canWrite) {
      setStatus({ text: 'Недостаточно прав для записи (нужна роль editor или admin)', severity: 'error' });
      return;
    }
    const raw = fileContent.trim();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      setJsonError(err.message);
      return;
    }
    setJsonError('');
    try {
      await apiFetch(`/projects/${encodeURIComponent(currentProject)}/documents/${encodeURIComponent(currentKey)}`, {
        token,
        method: 'PUT',
        body: { payload },
      });
      setDirty(false);
      setStatus({ text: 'Сохранено в БД и синхронизировано в public/data', severity: 'success' });
    } catch (err) {
      setStatus({ text: err.message, severity: 'error' });
    }
  };

  const syncProject = async () => {
    if (!currentProject || !canWrite) return;
    try {
      const data = await apiFetch(`/sync/${encodeURIComponent(currentProject)}`, { token, method: 'POST', body: {} });
      setSnack({ open: true, message: `Синхронизировано файлов: ${data.written?.length || 0}` });
    } catch (err) {
      setStatus({ text: err.message, severity: 'error' });
    }
  };

  const parsedData = (() => {
    try {
      return JSON.parse(fileContent);
    } catch {
      return null;
    }
  })();
  const tableableList = getTableableArrays(parsedData);
  const canShowTable = tableableList.length > 0;
  const currentTableEntry = tableableList.find((e) => (e.key == null ? '' : e.key) === selectedTableKey) || tableableList[0] || null;
  const tableData = currentTableEntry?.data ?? [];
  const tableKeys = canShowTable ? getAllKeys(tableData) : [];

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!canWrite) {
      setStatus({ text: 'Недостаточно прав для загрузки', severity: 'error' });
      return;
    }
    const project = uploadProject;
    const path = uploadPath.trim() || 'data/images';
    const file = fileInputRef.current?.files?.[0];
    if (!project || !file) return;
    const formData = new FormData();
    formData.append('project', project);
    formData.append('path', path);
    formData.append('file', file);
    try {
      const data = await apiFetch('/media', { token, method: 'POST', body: formData });
      setUploadedUrl(data.url);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatus({ text: 'Файл загружен', severity: 'success' });
    } catch (err) {
      setStatus({ text: err.message, severity: 'error' });
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(uploadedUrl);
    setSnack({ open: true, message: 'URL скопирован' });
  };

  const handleTableCellChange = (rowIndex, key, newValue) => {
    if (!canWrite || !currentTableEntry || parsedData == null) return;
    const arr = currentTableEntry.data;
    const newArr = arr.map((row, i) => (i === rowIndex ? { ...row, [key]: newValue } : row));
    const newData = currentTableEntry.key == null ? newArr : { ...parsedData, [currentTableEntry.key]: newArr };
    setFileContent(JSON.stringify(newData, null, 2));
    setDirty(true);
  };

  const tabs = [
    { label: 'Данные', index: 0 },
    { label: 'Медиа', index: 1 },
    ...(user.role === 'admin' ? [{ label: 'Пользователи', index: 2 }] : []),
  ];

  return (
    <ThemeProvider theme={theme}>
      <AppBar position='fixed' sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant='h6' noWrap component='div' sx={{ flexGrow: 1 }}>
            CMS Уткина дача
          </Typography>
          <Chip label={`${user.login} (${user.role})`} size='small' sx={{ mr: 2, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
          <Button color='inherit' startIcon={<LogoutIcon />} onClick={handleLogout}>
            Выйти
          </Button>
        </Toolbar>
      </AppBar>
      <Drawer
        variant='permanent'
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            top: 64,
            height: 'calc(100vh - 64px)',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', p: 1 }}>
          <Button
            fullWidth
            startIcon={<RefreshIcon />}
            onClick={() =>
              loadProjects()
                .then(() => setSnack({ open: true, message: 'Список обновлён' }))
                .catch((e) => setStatus({ text: e.message, severity: 'error' }))
            }
            sx={{ mb: 1 }}
          >
            Обновить список
          </Button>
          <List dense disablePadding>
            {projects.map((p) => (
              <React.Fragment key={p.id}>
                <ListItemButton onClick={() => toggleProject(p.id)}>
                  {openProjects[p.id] ? <FolderOpenIcon sx={{ mr: 0.5 }} /> : <FolderIcon sx={{ mr: 0.5 }} />}
                  <ListItemText primary={p.name} />
                </ListItemButton>
                <Collapse in={!!openProjects[p.id]} timeout='auto' unmountOnExit>
                  <List component='div' disablePadding sx={{ pl: 2 }}>
                    {(p.dataFiles || []).map((f) => (
                      <ListItemButton
                        key={f.key || f.path}
                        selected={currentProject === p.id && currentKey === f.key}
                        onClick={() => selectFile(p.id, f.key)}
                      >
                        <InsertDriveFileIcon sx={{ mr: 0.5, fontSize: 18 }} />
                        <ListItemText primary={f.name} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </React.Fragment>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box component='main' sx={{ flexGrow: 1, p: 2, ml: `${DRAWER_WIDTH}px`, mt: 7 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          sx={{ mb: 2 }}
        >
          {tabs.map((t) => (
            <Tab key={t.label} label={t.label} />
          ))}
        </Tabs>

        {tabIndex === 0 && (
          <Box>
            {(status.text || jsonError) && (
              <Alert
                severity={jsonError ? 'error' : status.severity}
                sx={{ mb: 1 }}
                onClose={() => {
                  setStatus({ text: '', severity: 'info' });
                  setJsonError('');
                }}
              >
                {jsonError || status.text}
              </Alert>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant='body2' color='text.secondary' sx={{ flex: 1 }}>
                {currentKey ? `${currentProject} / ${currentKey}` : 'Выберите документ слева'}
              </Typography>
              {canShowTable && (
                <>
                  {tableableList.length > 1 && (
                    <FormControl size='small' sx={{ minWidth: 160 }}>
                      <InputLabel>Массив</InputLabel>
                      <Select
                        value={currentTableEntry ? (currentTableEntry.key == null ? '' : currentTableEntry.key) : ''}
                        label='Массив'
                        onChange={(e) => setSelectedTableKey(e.target.value)}
                      >
                        {tableableList.map((e) => (
                          <MenuItem key={e.key ?? '__root__'} value={e.key == null ? '' : e.key}>
                            {e.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                  <ToggleButtonGroup size='small' value={dataView} exclusive onChange={(_, v) => v != null && setDataView(v)}>
                    <ToggleButton value='table'>Таблица</ToggleButton>
                    <ToggleButton value='json'>JSON</ToggleButton>
                  </ToggleButtonGroup>
                </>
              )}
              <Button
                variant='outlined'
                startIcon={<SyncIcon />}
                disabled={!currentProject || !canWrite}
                onClick={syncProject}
              >
                Sync на диск
              </Button>
              <Button
                variant='contained'
                startIcon={<SaveIcon />}
                disabled={!currentProject || !currentKey || !dirty || !canWrite}
                onClick={validateAndSave}
              >
                Сохранить
              </Button>
            </Box>
            {dataView === 'table' && canShowTable && currentTableEntry ? (
              <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
                <Table size='small' stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                      {tableKeys.map((k) => (
                        <TableCell key={k} sx={{ fontWeight: 600 }}>
                          {k}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableData.map((row, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ width: 48 }}>{idx + 1}</TableCell>
                        {tableKeys.map((key) => {
                          const value = row[key];
                          const editable = canWrite && isEditableValue(value);
                          return (
                            <TableCell key={key} sx={{ padding: 0.5, verticalAlign: 'top' }}>
                              {editable ? (
                                typeof value === 'boolean' ? (
                                  <Select
                                    size='small'
                                    fullWidth
                                    value={value ? 'да' : 'нет'}
                                    onChange={(e) => handleTableCellChange(idx, key, e.target.value === 'да')}
                                    sx={{ fontSize: 'inherit', '.MuiSelect-select': { py: 0.5 } }}
                                  >
                                    <MenuItem value='да'>да</MenuItem>
                                    <MenuItem value='нет'>нет</MenuItem>
                                  </Select>
                                ) : (
                                  <TextField
                                    size='small'
                                    fullWidth
                                    value={value == null ? '' : String(value)}
                                    type={typeof value === 'number' ? 'number' : 'text'}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      let newVal = v;
                                      if (typeof value === 'number') newVal = v === '' ? 0 : Number(v);
                                      else if (value == null) newVal = v === '' ? null : v;
                                      handleTableCellChange(idx, key, newVal);
                                    }}
                                    sx={{ '& .MuiInputBase-input': { py: 0.5, fontSize: 'inherit' } }}
                                  />
                                )
                              ) : (
                                <Box sx={{ py: 0.5, fontSize: 'inherit' }}>{renderCell(value)}</Box>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <TextField
                fullWidth
                multiline
                minRows={16}
                maxRows={40}
                value={fileContent}
                onChange={(e) => {
                  if (!canWrite) return;
                  setFileContent(e.target.value);
                  setDirty(true);
                }}
                InputProps={{ readOnly: !canWrite }}
                placeholder='Выберите документ в списке проектов'
                spellCheck={false}
                sx={{
                  '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: 13 },
                }}
              />
            )}
          </Box>
        )}

        {tabIndex === 1 && (
          <Paper sx={{ p: 2, maxWidth: 480 }}>
            <Typography variant='subtitle2' color='text.secondary' gutterBottom>
              Загрузка изображений (API + media_assets)
            </Typography>
            <Box component='form' onSubmit={handleUpload} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth required>
                <InputLabel>Проект</InputLabel>
                <Select value={uploadProject} label='Проект' onChange={(e) => setUploadProject(e.target.value)}>
                  <MenuItem value=''>— выбрать —</MenuItem>
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label='Папка в public' value={uploadPath} onChange={(e) => setUploadPath(e.target.value)} placeholder='data/images' fullWidth />
              <Button variant='outlined' component='label' startIcon={<CloudUploadIcon />} disabled={!canWrite}>
                Выбрать файл
                <input ref={fileInputRef} type='file' name='uploadFile' accept='image/*,.png,.jpg,.jpeg,.gif,.webp' hidden />
              </Button>
              <Button type='submit' variant='contained' disabled={!canWrite}>
                Загрузить
              </Button>
            </Box>
            {uploadedUrl && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField size='small' fullWidth value={uploadedUrl} InputProps={{ readOnly: true }} />
                <Button size='small' startIcon={<ContentCopyIcon />} onClick={copyUrl}>
                  Копировать
                </Button>
              </Box>
            )}
          </Paper>
        )}

        {tabIndex === 2 && user.role === 'admin' && <UsersTab token={token} />}
      </Box>
      <Snackbar
        open={snack.open}
        autoHideDuration={2000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </ThemeProvider>
  );
}
