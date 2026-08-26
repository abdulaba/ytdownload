const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');

const PORT = Number(process.env.PORT) || 4173;
const INACTIVITY_TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS) || 120_000;
const COOKIES_BROWSER = process.env.YTDLP_COOKIES_BROWSER || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const jobs = new Map();

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function validYouTubeUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return url.protocol === 'https:' && ['youtube.com', 'youtu.be', 'm.youtube.com', 'music.youtube.com'].includes(host);
  } catch {
    return false;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10_000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON no válido')); }
    });
    req.on('error', reject);
  });
}

function cleanupJobArtifacts(id, keepFile = null) {
  let removed = 0;
  for (const name of fs.readdirSync(DOWNLOAD_DIR)) {
    if (!name.startsWith(`${id}-`) || name === keepFile) continue;
    try {
      fs.unlinkSync(path.join(DOWNLOAD_DIR, name));
      removed += 1;
    } catch (error) {
      console.warn(`No se pudo eliminar el temporal ${name}: ${error.message}`);
    }
  }
  return removed;
}

function startDownload(url) {
  const id = randomUUID();
  const outputTemplate = path.join(DOWNLOAD_DIR, `${id}-%(title).120B.%(ext)s`);
  const job = { id, status: 'starting', progress: 0, message: 'Preparando descarga…', file: null, error: null, logs: [] };
  jobs.set(id, job);

  const addLog = (level, message) => {
    const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!cleanMessage) return;
    job.logs.push({ time: new Date().toISOString(), level, message: cleanMessage });
    if (job.logs.length > 300) job.logs.shift();
  };

  addLog('info', 'Trabajo creado. Preparando yt-dlp…');

  const args = [
    '--newline', '--verbose', '--no-playlist',
    '-f', 'bestvideo+bestaudio/best',
    '--merge-output-format', 'mp4',
    '--restrict-filenames',
    '--progress-template', 'download:%(progress._percent_str)s',
    '-o', outputTemplate,
  ];
  if (COOKIES_BROWSER) args.push('--cookies-from-browser', COOKIES_BROWSER);
  args.push('--', url);
  const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let errorOutput = '';
  let inactivityTimer;
  let timedOut = false;
  const streamBuffers = { stdout: '', stderr: '' };

  addLog('info', `yt-dlp iniciado (PID ${child.pid || 'pendiente'}).`);

  const refreshTimeout = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      timedOut = true;
      job.status = 'error';
      job.error = 'yt-dlp no respondió durante 2 minutos. Revisa tu conexión o prueba usando las cookies del navegador.';
      addLog('error', job.error);
      child.kill('SIGTERM');
    }, INACTIVITY_TIMEOUT_MS);
  };

  const consumeChunk = (source, chunk) => {
    streamBuffers[source] += chunk.toString();
    const lines = streamBuffers[source].split(/\r?\n/);
    streamBuffers[source] = lines.pop() || '';
    for (const line of lines) {
      addLog(source === 'stderr' ? 'warning' : 'info', line);
      processLine(line);
    }
  };

  const processLine = line => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    const match = cleanLine.match(/(?:download:\s*)?([\d.]+)%/i);
    if (match) {
      job.status = 'downloading';
      job.progress = Math.min(99, Number(match[1]));
      job.message = `Descargando… ${job.progress.toFixed(1)}%`;
    } else if (/Merging formats|Merger|Fixing MPEG-TS/i.test(cleanLine)) {
      job.status = 'processing';
      job.message = 'Combinando video y audio…';
    } else if (/Downloading webpage|Downloading initial data|Extracting URL|Downloading player|Solving JS/i.test(cleanLine)) {
      job.status = 'extracting';
      job.message = 'Consultando información del video…';
    } else if (/Downloading \d+ format/i.test(cleanLine)) {
      job.status = 'downloading';
      job.message = 'Iniciando descarga en máxima calidad…';
    } else if (/Sign in|cookies|not a bot/i.test(cleanLine)) {
      job.message = 'YouTube solicita autenticación…';
    } else if (/Retrying/i.test(cleanLine)) {
      job.message = 'Problema de conexión; reintentando…';
    }
  };

  refreshTimeout();

  child.stdout.on('data', chunk => {
    refreshTimeout();
    consumeChunk('stdout', chunk);
  });

  child.stderr.on('data', chunk => {
    refreshTimeout();
    const output = chunk.toString();
    errorOutput = (errorOutput + output).slice(-6000);
    consumeChunk('stderr', chunk);
  });
  child.on('error', error => {
    clearTimeout(inactivityTimer);
    job.status = 'error';
    job.error = error.code === 'ENOENT'
      ? 'No se encontró yt-dlp. Instálalo y reinicia el servidor.'
      : error.message;
    addLog('error', job.error);
  });
  child.on('close', code => {
    clearTimeout(inactivityTimer);
    for (const source of ['stdout', 'stderr']) {
      if (streamBuffers[source]) {
        addLog(source === 'stderr' ? 'warning' : 'info', streamBuffers[source]);
        processLine(streamBuffers[source]);
      }
    }
    if (timedOut) {
      const removed = cleanupJobArtifacts(id);
      if (removed) addLog('info', `Se eliminaron ${removed} archivo(s) temporal(es).`);
      return;
    }
    if (code !== 0) {
      job.status = 'error';
      const output = errorOutput.trim();
      if (/Sign in|not a bot|cookies/i.test(output)) {
        job.error = 'YouTube solicita autenticación. Reinicia la aplicación configurando YTDLP_COOKIES_BROWSER=chrome (o safari/firefox).';
      } else if (/Unable to download|Failed to resolve|Network is unreachable/i.test(output)) {
        job.error = 'No se pudo conectar con YouTube. Revisa la conexión a Internet y el DNS.';
      } else if (/Private video/i.test(output)) {
        job.error = 'El video es privado y requiere una cuenta con acceso.';
      } else if (/video (?:is )?unavailable/i.test(output)) {
        job.error = 'El video no está disponible o tiene restricciones regionales.';
      } else {
        job.error = output.split('\n').filter(Boolean).slice(-3).join('\n') || `yt-dlp terminó con código ${code}`;
      }
      addLog('error', job.error);
      const removed = cleanupJobArtifacts(id);
      if (removed) addLog('info', `Se eliminaron ${removed} archivo(s) temporal(es).`);
      return;
    }
    const file = fs.readdirSync(DOWNLOAD_DIR).find(name => name.startsWith(`${id}-`) && name.endsWith('.mp4'));
    if (!file) {
      job.status = 'error';
      job.error = 'La descarga terminó, pero no se encontró el archivo MP4.';
      addLog('error', job.error);
      return;
    }
    job.status = 'done';
    job.progress = 100;
    job.message = '¡Listo! El archivo está guardado en la carpeta downloads.';
    job.file = file;
    const removed = cleanupJobArtifacts(id, file);
    if (removed) addLog('info', `Se eliminaron ${removed} archivo(s) temporal(es).`);
    addLog('success', `Archivo listo: ${file.replace(`${job.id}-`, '')}`);
  });

  return job;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && requestUrl.pathname === '/api/download') {
    try {
      const { url } = await readBody(req);
      if (!validYouTubeUrl(url)) return json(res, 400, { error: 'Ingresa una URL válida de YouTube.' });
      const job = startDownload(url);
      return json(res, 202, { id: job.id });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  const statusMatch = requestUrl.pathname.match(/^\/api\/status\/([a-f0-9-]+)$/);
  if (req.method === 'GET' && statusMatch) {
    const job = jobs.get(statusMatch[1]);
    if (!job) return json(res, 404, { error: 'Descarga no encontrada.' });
    return json(res, 200, job);
  }

  const fileMatch = requestUrl.pathname.match(/^\/api\/file\/([a-f0-9-]+)$/);
  if (req.method === 'GET' && fileMatch) {
    const job = jobs.get(fileMatch[1]);
    if (!job || job.status !== 'done' || !job.file) return json(res, 404, { error: 'Archivo no disponible.' });
    const filePath = path.join(DOWNLOAD_DIR, job.file);
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${job.file.replace(`${job.id}-`, '')}"`,
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido.' });
  const relativePath = requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname.slice(1);
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
    return json(res, 403, { error: 'Acceso denegado.' });
  }
  fs.readFile(filePath, (error, data) => {
    if (error) return json(res, 404, { error: 'No encontrado.' });
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`YT Downloader disponible en http://localhost:${PORT}`);
});
