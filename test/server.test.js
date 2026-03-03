'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('path');
const fs = require('fs');
const app = require('../server.js');

// Use a random port to avoid conflicts
const server = http.createServer(app);
let baseUrl;

before(() => new Promise(res => {
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
    res();
  });
}));

after(() => new Promise(res => server.close(res)));

/* helper: simple HTTP request */
function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers,
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/* helper: multipart upload */
function uploadFile(filename, content, mimeType) {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary' + Date.now();
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="manual"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`),
      Buffer.from(content),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const url = new URL('/api/manuals/upload', baseUrl);
    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

test('GET /api/manuals returns an array', async () => {
  const { status, body } = await request('GET', '/api/manuals');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body));
});

test('POST /api/manuals/upload rejects missing file', async () => {
  const boundary = '----EmptyBoundary';
  const body = `--${boundary}--\r\n`;
  const { status } = await request('POST', '/api/manuals/upload', body, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': Buffer.byteLength(body),
  });
  assert.equal(status, 400);
});

test('POST /api/manuals/upload accepts a txt file and GET lists it', async () => {
  const { status, body } = await uploadFile('test-manual.txt', 'Hello training manual!', 'text/plain');
  assert.equal(status, 200);
  assert.ok(body.filename);

  const list = await request('GET', '/api/manuals');
  assert.equal(list.status, 200);
  const found = list.body.find(m => m.filename === body.filename);
  assert.ok(found, 'Uploaded file should appear in manual list');

  // cleanup
  await request('DELETE', `/api/manuals/${encodeURIComponent(body.filename)}`);
});

test('GET /api/manuals/:filename returns 404 for missing file', async () => {
  const { status } = await request('GET', '/api/manuals/nonexistent-file.txt');
  assert.equal(status, 404);
});

test('DELETE /api/manuals/:filename returns 404 for missing file', async () => {
  const { status } = await request('DELETE', '/api/manuals/nonexistent-file.txt');
  assert.equal(status, 404);
});

test('POST /api/manuals/upload rejects disallowed file type', async () => {
  const { status } = await uploadFile('malware.exe', 'evil', 'application/octet-stream');
  assert.equal(status, 400);
});
