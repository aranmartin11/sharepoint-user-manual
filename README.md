# Training Manuals Portal

A SharePoint-style web portal for uploading and viewing training manuals.

![Training Manuals Portal](https://github.com/user-attachments/assets/b66f9b7a-717b-4f90-81d4-3cdd74fced0f)

## Features

- **Upload** training manuals via drag-and-drop or file browser (PDF, Word, Excel, PowerPoint, TXT, images — up to 50 MB)
- **Browse** all uploaded manuals in a searchable table
- **View / download** any manual directly in the browser
- **Delete** manuals you no longer need
- Real-time upload progress bar
- Toast notifications for success and error states

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

### Install dependencies

```bash
npm install
```

### Run the server

```bash
npm start
```

Then open <http://localhost:3000> in your browser.

The `PORT` environment variable can be set to change the listening port (default `3000`).

### Run tests

```bash
npm test
```

## Project structure

```
├── server.js          # Express server (API + static file serving)
├── public/
│   └── index.html     # Single-page UI
├── uploads/           # Uploaded manuals are stored here (git-ignored)
└── test/
    └── server.test.js # Node built-in test runner tests
```

## Supported file types

| Type        | Extensions                    |
|-------------|-------------------------------|
| PDF         | `.pdf`                        |
| Word        | `.doc`, `.docx`               |
| Excel       | `.xls`, `.xlsx`               |
| PowerPoint  | `.ppt`, `.pptx`               |
| Plain text  | `.txt`                        |
| Images      | `.png`, `.jpg`, `.jpeg`, `.gif` |
