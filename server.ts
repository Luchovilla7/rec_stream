import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// In-memory / JSON store for recordings
const DATA_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const RECORDINGS_JSON = path.join(DATA_DIR, 'recordings.json');

interface ServerRecording {
  id: string;
  user_id: string;
  title: string;
  storage_path: string;
  duration_sec: number;
  share_slug: string;
  view_count: number;
  file_size_mb: number;
  created_at: string;
  video_url: string;
  is_local?: boolean;
  mime_type?: string;
}

function loadRecordings(): ServerRecording[] {
  try {
    if (fs.existsSync(RECORDINGS_JSON)) {
      const content = fs.readFileSync(RECORDINGS_JSON, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error reading recordings json:', e);
  }
  return [];
}

function saveRecordings(list: ServerRecording[]) {
  try {
    fs.writeFileSync(RECORDINGS_JSON, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing recordings json:', e);
  }
}

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Express API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET all recordings
app.get('/api/recordings', (req, res) => {
  const list = loadRecordings();
  res.json(list);
});

// GET recording by share slug (and increment view count)
app.get('/api/recordings/:slug', (req, res) => {
  const { slug } = req.params;
  const list = loadRecordings();
  const rec = list.find((r) => r.share_slug === slug || r.id === slug);

  if (!rec) {
    return res.status(404).json({ error: 'Grabación no encontrada' });
  }

  rec.view_count = (rec.view_count || 0) + 1;
  saveRecordings(list);

  res.json(rec);
});

// CREATE / SAVE new recording metadata
app.post('/api/recordings', (req, res) => {
  const newRec: ServerRecording = req.body;
  if (!newRec || !newRec.id) {
    return res.status(400).json({ error: 'Faltan datos de la grabación' });
  }

  const list = loadRecordings();
  const existingIdx = list.findIndex((r) => r.id === newRec.id);
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...newRec };
  } else {
    list.unshift(newRec);
  }

  saveRecordings(list);
  res.json({ success: true, recording: newRec });
});

// DELETE recording by ID
app.delete('/api/recordings/:id', (req, res) => {
  const { id } = req.params;
  let list = loadRecordings();
  const target = list.find((r) => r.id === id);

  list = list.filter((r) => r.id !== id);
  saveRecordings(list);

  // Try removing local video file if present
  if (target) {
    const videoFilePath = path.join(DATA_DIR, `${id}.webm`);
    if (fs.existsSync(videoFilePath)) {
      try {
        fs.unlinkSync(videoFilePath);
      } catch (e) {
        console.warn('File removal error:', e);
      }
    }
  }

  res.json({ success: true });
});

// UPLOAD RAW VIDEO BINARY ROUTE
app.post('/api/upload-video/:id', express.raw({ type: '*/*', limit: '500mb' }), (req, res) => {
  const { id } = req.params;
  const filePath = path.join(DATA_DIR, `${id}.webm`);

  try {
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      fs.writeFileSync(filePath, req.body);
      return res.json({ success: true, id, size: req.body.length });
    }
    return res.status(400).json({ error: 'Buffer de video vacío o inválido' });
  } catch (e: any) {
    console.error('Error al guardar archivo de video:', e);
    return res.status(500).json({ error: 'Error interno guardando video' });
  }
});

// UPLOAD CHUNK fallback route
app.post('/api/upload-chunk', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  const id = (req.headers['x-recording-id'] as string) || (req.query.id as string) || 'chunk_file';
  const chunkIndex = req.headers['x-chunk-index'] || req.query.chunkIndex || '0';
  const chunkFilePath = path.join(DATA_DIR, `${id}_chunk_${chunkIndex}.tmp`);

  try {
    if (Buffer.isBuffer(req.body)) {
      fs.writeFileSync(chunkFilePath, req.body);
    }
    res.json({ success: true, chunkIndex });
  } catch (e) {
    res.status(500).json({ error: 'Error al guardar fragmento' });
  }
});

// GET video stream
app.get('/api/video/:id', (req, res) => {
  const { id } = req.params;
  let filePath = path.join(DATA_DIR, `${id}.webm`);

  if (!fs.existsSync(filePath)) {
    // Check if recorded with slug or alternate extension
    if (fs.existsSync(path.join(DATA_DIR, id))) {
      filePath = path.join(DATA_DIR, id);
    } else {
      const files = fs.readdirSync(DATA_DIR);
      const match = files.find((f) => f.includes(id) && (f.endsWith('.webm') || f.endsWith('.mp4')));
      if (match) {
        filePath = path.join(DATA_DIR, match);
      } else {
        return res.status(404).json({ error: 'Video file not found' });
      }
    }
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/webm',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/webm',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
