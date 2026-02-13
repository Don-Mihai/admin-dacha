const API = '/api';

let projects = [];
let currentProject = null;
let currentFile = null;
let dirty = false;

const $projectList = document.getElementById('projectList');
const $jsonEditor = document.getElementById('jsonEditor');
const $saveBtn = document.getElementById('saveBtn');
const $saveStatus = document.getElementById('saveStatus');
const $currentFile = document.getElementById('currentFile');
const $jsonError = document.getElementById('jsonError');
const $refreshBtn = document.getElementById('refreshBtn');
const $uploadProject = document.getElementById('uploadProject');
const $uploadPath = document.getElementById('uploadPath');
const $uploadForm = document.getElementById('uploadForm');
const $uploadFile = document.getElementById('uploadFile');
const $uploadResult = document.getElementById('uploadResult');
const $uploadedUrl = document.getElementById('uploadedUrl');
const $copyUrlBtn = document.getElementById('copyUrlBtn');

function showStatus(text, type = '') {
  $saveStatus.textContent = text;
  $saveStatus.className = 'status ' + type;
  if (text) setTimeout(() => { $saveStatus.textContent = ''; }, 3000);
}

function setDirty(value) {
  dirty = value;
  $saveBtn.disabled = !(currentProject && currentFile && dirty);
}

function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function validateJSON() {
  const raw = $jsonEditor.value.trim();
  if (!raw) {
    $jsonError.classList.add('hidden');
    return true;
  }
  const parsed = parseJSON(raw);
  if (parsed === null) {
    try {
      JSON.parse(raw);
    } catch (err) {
      $jsonError.textContent = err.message;
      $jsonError.classList.remove('hidden');
      return false;
    }
  }
  $jsonError.classList.add('hidden');
  return true;
}

async function loadProjects() {
  const res = await fetch(`${API}/projects`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  projects = data.projects;
  renderProjects();
  fillUploadProjects();
}

function renderProjects() {
  $projectList.innerHTML = '';
  projects.forEach((p) => {
    const li = document.createElement('li');
    const header = document.createElement('div');
    header.className = 'project-name' + (projects.indexOf(p) === 0 ? ' open' : '');
    header.textContent = p.name;
    header.addEventListener('click', () => {
      header.classList.toggle('open');
      listEl.classList.toggle('hidden');
    });
    const listEl = document.createElement('ul');
    listEl.className = 'file-list' + (projects.indexOf(p) === 0 ? '' : ' hidden');
    p.dataFiles.forEach((f) => {
      const fli = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'file-link';
      a.textContent = f.name;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        selectFile(p.id, f.path);
        document.querySelectorAll('.file-link.active').forEach((x) => x.classList.remove('active'));
        a.classList.add('active');
      });
      fli.appendChild(a);
      listEl.appendChild(fli);
    });
    li.appendChild(header);
    li.appendChild(listEl);
    $projectList.appendChild(li);
  });
}

function fillUploadProjects() {
  $uploadProject.innerHTML = '<option value="">— выбрать —</option>';
  projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    $uploadProject.appendChild(opt);
  });
}

async function selectFile(project, file) {
  if (dirty && !confirm('Несохранённые изменения. Всё равно перейти?')) return;
  currentProject = project;
  currentFile = file;
  setDirty(false);
  $currentFile.textContent = `${project} / ${file}`;
  $jsonError.classList.add('hidden');
  try {
    const res = await fetch(`${API}/file?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}`);
    if (!res.ok) throw new Error(await res.text());
    const text = await res.text();
    $jsonEditor.value = text;
    try {
      JSON.parse(text);
      $jsonEditor.value = JSON.stringify(JSON.parse(text), null, 2);
    } catch (_) {}
  } catch (err) {
    $jsonEditor.value = '';
    showStatus(err.message, 'error');
  }
}

async function saveFile() {
  if (!currentProject || !currentFile) return;
  if (!validateJSON()) return;
  const content = $jsonEditor.value.trim();
  try {
    const res = await fetch(`${API}/file?project=${encodeURIComponent(currentProject)}&file=${encodeURIComponent(currentFile)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.statusText);
    }
    setDirty(false);
    showStatus('Сохранено', 'success');
  } catch (err) {
    showStatus(err.message, 'error');
  }
}

$jsonEditor.addEventListener('input', () => setDirty(true));
$jsonEditor.addEventListener('blur', validateJSON);

$saveBtn.addEventListener('click', saveFile);

$refreshBtn.addEventListener('click', () => {
  loadProjects().then(() => showStatus('Список обновлён', 'success')).catch((e) => showStatus(e.message, 'error'));
});

// Tabs
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// Upload
$uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  $uploadResult.classList.add('hidden');
  const project = $uploadProject.value;
  const path = $uploadPath.value.trim() || 'data/images';
  const file = $uploadFile.files[0];
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
    $uploadedUrl.value = data.url;
    $uploadResult.classList.remove('hidden');
    $uploadFile.value = '';
  } catch (err) {
    alert(err.message);
  }
});

$copyUrlBtn.addEventListener('click', () => {
  $uploadedUrl.select();
  navigator.clipboard.writeText($uploadedUrl.value);
  $copyUrlBtn.textContent = 'Скопировано';
  setTimeout(() => { $copyUrlBtn.textContent = 'Копировать'; }, 2000);
});

// Init
loadProjects().catch((e) => showStatus(e.message, 'error'));
