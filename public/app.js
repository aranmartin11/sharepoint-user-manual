'use strict';

/* ── Helpers ────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    pdf: '📕', doc: '📘', docx: '📘',
    xls: '📗', xlsx: '📗',
    ppt: '📙', pptx: '📙',
    txt: '📄',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️',
  };
  return map[ext] || '📎';
}

function isPreviewable(name) {
  const ext = name.split('.').pop().toLowerCase();
  return ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'txt'].includes(ext);
}

/* ── DOM refs ───────────────────────────────────────── */
const dropZone        = $('dropZone');
const fileInput       = $('fileInput');
const selectedFiles   = $('selectedFiles');
const uploadBtn       = $('uploadBtn');
const cancelUploadBtn = $('cancelUploadBtn');
const uploadPanel     = $('uploadPanel');
const uploadTrigger   = $('uploadTrigger');
const uploadProgress  = $('uploadProgress');
const progressFill    = $('progressFill');
const uploadStatus    = $('uploadStatus');
const docsList        = $('docsList');
const refreshBtn      = $('refreshBtn');
const searchInput     = $('searchInput');
const previewModal    = $('previewModal');
const modalBackdrop   = $('modalBackdrop');
const modalClose      = $('modalClose');
const modalTitle      = $('modalTitle');
const modalBody       = $('modalBody');
const listViewBtn     = $('listViewBtn');
const gridViewBtn     = $('gridViewBtn');
const navToggle       = $('navToggle');
const sideNav         = $('sideNav');
const dropOverlay     = $('dropOverlay');
const storageFill     = $('storageFill');
const storageLabel    = $('storageLabel');

let allDocs = [];
let currentView = 'list'; // 'list' | 'grid'
let dragCounter = 0;

/* ── Sidebar toggle (mobile) ────────────────────────── */
navToggle.addEventListener('click', () => {
  const open = sideNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

/* ── View toggle ────────────────────────────────────── */
listViewBtn.addEventListener('click', () => setView('list'));
gridViewBtn.addEventListener('click', () => setView('grid'));

function setView(view) {
  currentView = view;
  listViewBtn.setAttribute('aria-pressed', String(view === 'list'));
  gridViewBtn.setAttribute('aria-pressed', String(view === 'grid'));
  renderDocuments(filterDocs());
}

/* ── Upload panel ───────────────────────────────────── */
uploadTrigger.addEventListener('click', () => {
  uploadPanel.hidden = false;
  fileInput.click();
  uploadPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

cancelUploadBtn.addEventListener('click', () => {
  uploadPanel.hidden = true;
  fileInput.value = '';
  selectedFiles.innerHTML = '';
  uploadBtn.disabled = true;
  setStatus('', '');
});

/* ── Drop zone interactions ─────────────────────────── */
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  fileInput.files = e.dataTransfer.files;
  handleFileSelection();
});

fileInput.addEventListener('change', handleFileSelection);

function handleFileSelection() {
  uploadPanel.hidden = false;
  const files = Array.from(fileInput.files);
  selectedFiles.innerHTML = files
    .map((f) => `<span class="file-chip">${fileIcon(f.name)} ${escapeHtml(f.name)} (${formatSize(f.size)})</span>`)
    .join('');
  uploadBtn.disabled = files.length === 0;
  setStatus('', '');
}

/* ── Full-page drag-and-drop overlay ────────────────── */
document.addEventListener('dragenter', (e) => {
  if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
    dragCounter++;
    dropOverlay.hidden = false;
  }
});
document.addEventListener('dragleave', () => {
  dragCounter--;
  if (dragCounter <= 0) { dragCounter = 0; dropOverlay.hidden = true; }
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.hidden = true;
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    uploadPanel.hidden = false;
    fileInput.files = e.dataTransfer.files;
    handleFileSelection();
    uploadPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

/* ── Upload ─────────────────────────────────────────── */
uploadBtn.addEventListener('click', () => {
  const files = fileInput.files;
  if (!files || files.length === 0) return;

  const formData = new FormData();
  for (const file of files) formData.append('documents', file);

  uploadBtn.disabled = true;
  uploadProgress.classList.add('visible');
  progressFill.style.width = '0%';
  setStatus('Uploading…', '');

  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      progressFill.style.width = `${Math.round((e.loaded / e.total) * 100)}%`;
    }
  });

  xhr.addEventListener('load', () => {
    uploadProgress.classList.remove('visible');
    progressFill.style.width = '0%';
    if (xhr.status >= 200 && xhr.status < 300) {
      const result = JSON.parse(xhr.responseText);
      setStatus(`✅ ${result.files.length} file(s) uploaded successfully.`, 'success');
      fileInput.value = '';
      selectedFiles.innerHTML = '';
      uploadBtn.disabled = true;
      loadDocuments();
      setTimeout(() => { uploadPanel.hidden = true; setStatus('', ''); }, 2000);
    } else {
      let msg = 'Upload failed.';
      try { msg = JSON.parse(xhr.responseText).error || msg; } catch (_) { /* ignore */ }
      setStatus(`❌ ${msg}`, 'error');
      uploadBtn.disabled = false;
    }
  });

  xhr.addEventListener('error', () => {
    uploadProgress.classList.remove('visible');
    setStatus('❌ Network error. Please try again.', 'error');
    uploadBtn.disabled = false;
  });

  xhr.open('POST', '/api/upload');
  xhr.send(formData);
});

function setStatus(msg, cls) {
  uploadStatus.textContent = msg;
  uploadStatus.className = `status-msg ${cls}`;
}

/* ── Document list ──────────────────────────────────── */
async function loadDocuments() {
  docsList.innerHTML = '<p class="loading">Loading…</p>';
  try {
    const res = await fetch('/api/documents');
    if (!res.ok) throw new Error('Failed to load documents');
    const data = await res.json();
    allDocs = data.files || [];
    updateStorageBar();
    renderDocuments(allDocs);
  } catch (err) {
    docsList.innerHTML = `<p class="empty-state">Could not load documents: ${escapeHtml(err.message)}</p>`;
  }
}

function filterDocs() {
  const q = searchInput.value.toLowerCase();
  return q ? allDocs.filter((d) => d.name.toLowerCase().includes(q)) : allDocs;
}

function renderDocuments(docs) {
  if (docs.length === 0) {
    docsList.className = 'docs-list';
    docsList.innerHTML = '<p class="empty-state">No files here. Use the Upload button to add files.</p>';
    return;
  }

  if (currentView === 'grid') {
    docsList.className = 'docs-list docs-list--grid';
    docsList.innerHTML = docs.map((doc) => `
      <div class="doc-item" data-stored="${escapeAttr(doc.storedName)}">
        <div class="doc-icon" aria-hidden="true">${fileIcon(doc.name)}</div>
        <div class="doc-name-cell">
          <div class="doc-name" title="${escapeAttr(doc.name)}">${escapeHtml(doc.name)}</div>
        </div>
        <div class="doc-actions">
          ${isPreviewable(doc.name) ? `<button class="doc-action-btn preview-btn" data-stored="${escapeAttr(doc.storedName)}" data-name="${escapeAttr(doc.name)}">View</button>` : ''}
          <a class="doc-action-btn" href="/api/documents/${encodeURIComponent(doc.storedName)}" download="${escapeAttr(doc.name)}">Download</a>
          <button class="doc-action-btn doc-action-btn--danger delete-btn" data-stored="${escapeAttr(doc.storedName)}" data-name="${escapeAttr(doc.name)}">Delete</button>
        </div>
      </div>
    `).join('');
  } else {
    docsList.className = 'docs-list docs-list--list';
    docsList.innerHTML = `
      <div class="list-header" role="row" aria-hidden="true">
        <span>Name</span>
        <span>Modified</span>
        <span>File size</span>
        <span></span>
      </div>
    ` + docs.map((doc) => `
      <div class="doc-item" role="row" data-stored="${escapeAttr(doc.storedName)}">
        <div class="doc-name-cell">
          <span class="doc-icon" aria-hidden="true">${fileIcon(doc.name)}</span>
          <span class="doc-name" title="${escapeAttr(doc.name)}">${escapeHtml(doc.name)}</span>
        </div>
        <div class="doc-meta-cell">${formatDate(doc.uploadedAt)}</div>
        <div class="doc-meta-cell">${formatSize(doc.size)}</div>
        <div class="doc-actions">
          ${isPreviewable(doc.name) ? `<button class="doc-action-btn preview-btn" data-stored="${escapeAttr(doc.storedName)}" data-name="${escapeAttr(doc.name)}">👁 View</button>` : ''}
          <a class="doc-action-btn" href="/api/documents/${encodeURIComponent(doc.storedName)}" download="${escapeAttr(doc.name)}">⬇ Download</a>
          <button class="doc-action-btn doc-action-btn--danger delete-btn" data-stored="${escapeAttr(doc.storedName)}" data-name="${escapeAttr(doc.name)}">🗑 Delete</button>
        </div>
      </div>
    `).join('');
  }

  docsList.querySelectorAll('.preview-btn').forEach((btn) => {
    btn.addEventListener('click', () => openPreview(btn.dataset.stored, btn.dataset.name));
  });
  docsList.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteDocument(btn.dataset.stored, btn.dataset.name));
  });
}

/* ── Storage indicator ──────────────────────────────── */
function updateStorageBar() {
  const MAX = 5 * 1024 * 1024 * 1024; // 5 GB display cap
  const used = allDocs.reduce((sum, d) => sum + d.size, 0);
  const pct = Math.min((used / MAX) * 100, 100);
  storageFill.style.width = `${pct}%`;
  storageLabel.textContent = `${formatSize(used)} used`;
}

/* ── Search ─────────────────────────────────────────── */
searchInput.addEventListener('input', () => renderDocuments(filterDocs()));

/* ── Refresh ────────────────────────────────────────── */
refreshBtn.addEventListener('click', loadDocuments);

/* ── Preview modal ──────────────────────────────────── */
function openPreview(storedName, name) {
  const url = `/api/documents/${encodeURIComponent(storedName)}`;
  const ext = name.split('.').pop().toLowerCase();
  modalTitle.textContent = name;

  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
    modalBody.innerHTML = `<img src="${escapeAttr(url)}" alt="${escapeAttr(name)}" />`;
  } else if (ext === 'pdf') {
    modalBody.innerHTML = `<iframe src="${escapeAttr(url)}" title="${escapeAttr(name)}"></iframe>`;
  } else if (ext === 'txt') {
    modalBody.innerHTML = '<p class="loading">Loading…</p>';
    fetch(url)
      .then((r) => r.text())
      .then((text) => { modalBody.innerHTML = `<pre>${escapeHtml(text)}</pre>`; })
      .catch(() => { modalBody.innerHTML = '<p class="preview-unavailable">Could not load file.</p>'; });
  } else {
    modalBody.innerHTML = '<p class="preview-unavailable">Preview not available for this file type. Use the Download button.</p>';
  }

  previewModal.hidden = false;
  document.body.style.overflow = 'hidden';
  modalClose.focus();
}

function closeModal() {
  previewModal.hidden = true;
  document.body.style.overflow = '';
  modalBody.innerHTML = '';
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !previewModal.hidden) closeModal();
});

/* ── Delete ─────────────────────────────────────────── */
async function deleteDocument(storedName, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  try {
    const res = await fetch(`/api/documents/${encodeURIComponent(storedName)}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(`Could not delete file: ${data.error}`);
      return;
    }
    loadDocuments();
  } catch (_) {
    alert('Network error. Could not delete file.');
  }
}

/* ── XSS helpers ────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

/* ── Init ───────────────────────────────────────────── */
loadDocuments();
