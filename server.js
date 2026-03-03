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

// Allowed file types for training manuals
const ALLOWED_TYPES = /pdf|docx?|xlsx?|pptx?|txt|png|jpe?g|gif/;
const ALLOWED_MIMETYPES = [
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
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (ALLOWED_TYPES.test(ext) && ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only document and image files are allowed (PDF, Word, Excel, PowerPoint, TXT, PNG, JPG, GIF).'));
    }
  },
});

app.use(express.static(path.join(__dirname, 'public')));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// List all uploaded manuals
app.get('/api/manuals', (req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to list manuals.' });
    const manuals = files
      .filter(f => !f.startsWith('.'))
      .map(f => {
        const stat = fs.statSync(path.join(UPLOADS_DIR, f));
        const dashIndex = f.indexOf('-');
        const originalName = dashIndex !== -1 ? f.slice(dashIndex + 1).replace(/_/g, ' ') : f;
        return {
          filename: f,
          originalName,
          size: stat.size,
          uploadedAt: stat.birthtime,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json(manuals);
  });
});

// Upload a manual
app.post('/api/manuals/upload', uploadLimiter, upload.single('manual'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json({
    message: 'Manual uploaded successfully.',
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});

// Download / view a manual
app.get('/api/manuals/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Manual not found.' });
  res.sendFile(filePath);
});

// Delete a manual
app.delete('/api/manuals/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Manual not found.' });
  fs.unlink(filePath, err => {
    if (err) return res.status(500).json({ error: 'Failed to delete manual.' });
    res.json({ message: 'Manual deleted successfully.' });
  });
});

// Handle multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || (err && err.message)) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Training Manuals Portal running at http://localhost:${PORT}`);
  });
}

module.exports = app;
