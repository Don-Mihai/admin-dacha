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
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const DRAWER_WIDTH = 280;
const API = '/api';

const theme = createTheme({
  typography: { fontFamily: '"Roboto", sans-serif' },
});

function isArrayOfObjects(data) {
  return Array.isArray(data) && data.length > 0 && data.every((item) => item && typeof item === 'object' && !Array.isArray(item));
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

export default function App() {
  const [projects, setProjects] = useState([]);
  const [openProjects, setOpenProjects] = useState({});
  const [currentProject, setCurrentProject] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState({ text: '', severity: 'info' });
  const [jsonError, setJsonError] = useState('');
  const [tabIndex, setTabIndex] = useState(0);
  const [dataView, setDataView] = useState('table'); // 'table' | 'json'
  const [uploadProject, setUploadProject] = useState('');
  const [uploadPath, setUploadPath] = useState('data/images');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '' });
  const fileInputRef = useRef(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch(`${API}/projects`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setProjects(data.projects);
    setOpenProjects((prev) => {
      const next = { ...prev };
      if (data.projects.length && !Object.keys(next).length) next[data.projects[0].id] = true;
      return next;
    });
  }, []);

  useEffect(() => {
    loadProjects().catch((e) => setStatus({ text: e.message, severity: 'error' }));
  }, [loadProjects]);

  const toggleProject = (id) => setOpenProjects((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectFile = useCallback(async (projectId, filePath) => {
    if (dirty && !window.confirm('Несохранённые изменения. Всё равно перейти?')) return;
    setCurrentProject(projectId);
    setCurrentFile(filePath);
    setDirty(false);
    setJsonError('');
    try {
      const res = await fetch(`${API}/file?project=${encodeURIComponent(projectId)}&file=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      try {
        const parsed = JSON.parse(text);
        setFileContent(JSON.stringify(parsed, null, 2));
      } catch {
        setFileContent(text);
      }
    } catch (err) {
      setStatus({ text: err.message, severity: 'error' });
      setFileContent('');
    }
  }, [dirty]);

  const validateAndSave = useCallback(async () => {
    if (!currentProject || !currentFile) return;
    const raw = fileContent.trim();
    let content = raw;
    try {
      JSON.parse(raw);
      content = raw;
    } catch (err) {
      setJsonError(err.message);
      return;
    }
    setJsonError('');
    try {
      const res = await fetch(
        `${API}/file?project=${encodeURIComponent(currentProject)}&file=${encodeURIComponent(currentFile)}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      setDirty(false);
      setStatus({ text: 'Сохранено', severity: 'success' });
    } catch (err) {
      setStatus({ text: err.message, severity: 'error' });
    }
  }, [currentProject, currentFile, fileContent]);

  const parsedData = (() => {
    try {
      return JSON.parse(fileContent);
    } catch {
      return null;
    }
  })();
  const canShowTable = parsedData && isArrayOfObjects(parsedData);
  const tableKeys = canShowTable ? getAllKeys(parsedData) : [];

  const handleUpload = async (e) => {
    e.preventDefault();
    const project = uploadProject;
    const path = uploadPath.trim() || 'data/images';
    const file = fileInputRef.current?.files?.[0];
    if (!project || !file) return;
    const formData = new FormData();
    formData.append('project', project);
    formData.append('path', path);
    formData.append('file', file);
    try {
      const res = await fetch(`${API}/upload`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const data = await res.json();
      setUploadedUrl(data.url);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setStatus({ text: err.message, severity: 'error' });
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(uploadedUrl);
    setSnack({ open: true, message: 'URL скопирован' });
  };

  return (
    <ThemeProvider theme={theme}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Админка проектов — Уткина дача
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
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
            onClick={() => loadProjects().then(() => setSnack({ open: true, message: 'Список обновлён' })).catch((e) => setStatus({ text: e.message, severity: 'error' }))}
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
                <Collapse in={!!openProjects[p.id]} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ pl: 2 }}>
                    {p.dataFiles.map((f) => (
                      <ListItemButton
                        key={f.path}
                        selected={currentProject === p.id && currentFile === f.path}
                        onClick={() => selectFile(p.id, f.path)}
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
      <Box component="main" sx={{ flexGrow: 1, p: 2, ml: `${DRAWER_WIDTH}px`, mt: 7 }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 2 }}>
          <Tab label="Данные (JSON)" />
          <Tab label="Загрузка изображений" />
        </Tabs>

        {tabIndex === 0 && (
          <Box>
            {(status.text || jsonError) && (
              <Alert severity={jsonError ? 'error' : status.severity} sx={{ mb: 1 }} onClose={() => { setStatus({ text: '', severity: 'info' }); setJsonError(''); }}>
                {jsonError || status.text}
              </Alert>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                {currentFile ? `${currentProject} / ${currentFile}` : 'Выберите файл слева'}
              </Typography>
              {canShowTable && (
                <ToggleButtonGroup
                  size="small"
                  value={dataView}
                  exclusive
                  onChange={(_, v) => v != null && setDataView(v)}
                >
                  <ToggleButton value="table">Таблица</ToggleButton>
                  <ToggleButton value="json">JSON</ToggleButton>
                </ToggleButtonGroup>
              )}
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={!currentProject || !currentFile || !dirty}
                onClick={validateAndSave}
              >
                Сохранить
              </Button>
            </Box>
            {dataView === 'table' && canShowTable ? (
              <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
                <Table size="small" stickyHeader>
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
                    {parsedData.map((row, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>{idx + 1}</TableCell>
                        {tableKeys.map((key) => (
                          <TableCell key={key}>{renderCell(row[key])}</TableCell>
                        ))}
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
                onChange={(e) => { setFileContent(e.target.value); setDirty(true); }}
                placeholder="Выберите файл в списке проектов"
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
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Загрузка изображений
            </Typography>
            <Box component="form" onSubmit={handleUpload} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth required>
                <InputLabel>Проект</InputLabel>
                <Select
                  value={uploadProject}
                  label="Проект"
                  onChange={(e) => setUploadProject(e.target.value)}
                >
                  <MenuItem value="">— выбрать —</MenuItem>
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Папка в public"
                value={uploadPath}
                onChange={(e) => setUploadPath(e.target.value)}
                placeholder="data/images"
                fullWidth
              />
              <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />}>
                Выбрать файл
                <input ref={fileInputRef} type="file" name="uploadFile" accept="image/*,.png,.jpg,.jpeg,.gif,.webp" hidden />
              </Button>
              <Button type="submit" variant="contained">
                Загрузить
              </Button>
            </Box>
            {uploadedUrl && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField size="small" fullWidth value={uploadedUrl} InputProps={{ readOnly: true }} />
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={copyUrl}>
                  Копировать
                </Button>
              </Box>
            )}
          </Paper>
        )}
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
