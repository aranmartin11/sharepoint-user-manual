'use strict';

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/gif',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

app.use(express.static(path.join(__dirname, 'public')));

const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const apiLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });

// Upload endpoint
app.post('/api/upload', uploadLimiter, upload.array('documents', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }
  const uploaded = req.files.map((f) => ({
    name: f.originalname,
    storedName: f.filename,
    size: f.size,
    mimeType: f.mimetype,
    uploadedAt: new Date().toISOString(),
  }));
  return res.json({ files: uploaded });
});

// List documents endpoint
app.get('/api/documents', apiLimiter, (_req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Could not list documents.' });
    }
    const docs = files
      .filter((f) => !f.startsWith('.'))
      .map((f) => {
        const filePath = path.join(UPLOADS_DIR, f);
        const stats = fs.statSync(filePath);
        const dashIndex = f.indexOf('-');
        const originalName = dashIndex !== -1 ? f.slice(dashIndex + 1) : f;
        return {
          storedName: f,
          name: originalName.replace(/_/g, ' '),
          size: stats.size,
          uploadedAt: stats.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    return res.json({ files: docs });
  });
});

// Download / view endpoint
app.get('/api/documents/:filename', apiLimiter, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!filePath.startsWith(UPLOADS_DIR + path.sep) || filePath === UPLOADS_DIR) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  res.download(filePath);
});

// Delete endpoint
app.delete('/api/documents/:filename', apiLimiter, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!filePath.startsWith(UPLOADS_DIR + path.sep) || filePath === UPLOADS_DIR) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).json({ error: 'Could not delete file.' });
    return res.json({ message: 'File deleted.' });
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Document portal running at http://localhost:${PORT}`);
});

module.exports = app;
