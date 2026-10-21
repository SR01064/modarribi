import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appFile = path.resolve(here, '..', 'index.html');
const envFile = path.join(here, '.env');
const port = Number(process.env.PORT || '8787');
const host = process.env.HOST || '127.0.0.1';

function readEnvFile() {
  if (!fs.existsSync(envFile)) return;
  for (const raw of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}
readEnvFile();

const apiKey = process.env.FISH_API_KEY || '';
const allowedVoices = new Set((process.env.FISH_ALLOWED_REFERENCE_IDS || '').split(',').map(x => x.trim()).filter(Boolean));
const allowedOrigin = process.env.APP_ORIGIN || `http://localhost:${port}`;
const direction = 'deep, slightly raspy, mature masculine voice; energetic, varied, dramatic, confident and commanding; original anime-inspired mentor; clear English; do not imitate any existing character or actor';
const publicFiles = new Map([
  ['/', [appFile, 'text/html; charset=utf-8']],
  ['/index.html', [appFile, 'text/html; charset=utf-8']],
  ['/manifest.webmanifest', [path.resolve(here, '..', 'manifest.webmanifest'), 'application/manifest+json; charset=utf-8']],
  ['/sw.js', [path.resolve(here, '..', 'sw.js'), 'text/javascript; charset=utf-8']],
  ['/icon.svg', [path.resolve(here, '..', 'icon.svg'), 'image/svg+xml']],
]);
const buckets = new Map();

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function json(res, status, data) { send(res, status, JSON.stringify(data)); }
function originAllowed(req) {
  const origin = req.headers.origin;
  return origin === allowedOrigin || (!process.env.APP_ORIGIN && origin === `http://127.0.0.1:${port}`);
}
async function readJson(req) {
  const parts = [];
  let size = 0;
  for await (const part of req) {
    size += part.length;
    if (size > 8192) throw new Error('too_large');
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function rateLimited(req) {
  const key = req.socket.remoteAddress || 'local';
  const now = Date.now();
  const entry = buckets.get(key) || { start: now, count: 0 };
  if (now - entry.start > 60_000) { entry.start = now; entry.count = 0; }
  entry.count += 1;
  buckets.set(key, entry);
  return entry.count > 20;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`);
  const origin = req.headers.origin;
  const allowed = originAllowed(req);
  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS' && url.pathname === '/api/tts') {
    if (!allowed) return json(res, 403, { message: 'مصدر الطلب غير مسموح.' });
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'no-store',
      'Vary': 'Origin'
    });
    return res.end();
  }
  if (req.method === 'GET' && publicFiles.has(url.pathname)) {
    const [file, type] = publicFiles.get(url.pathname);
    try {
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': url.pathname === '/sw.js' ? 'no-cache' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
      return res.end(fs.readFileSync(file));
    } catch { return json(res, 500, { message: 'أحد ملفات التطبيق غير موجود.' }); }
  }
  if (url.pathname !== '/api/tts') return json(res, 404, { message: 'المسار غير موجود.' });
  if (req.method !== 'POST') return json(res, 405, { message: 'استخدم POST.' });
  if (!originAllowed(req)) return json(res, 403, { message: 'مصدر الطلب غير مسموح.' });
  if (rateLimited(req)) return json(res, 429, { message: 'طلبات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.' });
  if (!apiKey) return json(res, 503, { message: 'أضف مفتاح Fish Audio في ملف .env ثم أعد تشغيل الخادم.' });

  let input;
  try { input = await readJson(req); }
  catch (e) { return json(res, e.message === 'too_large' ? 413 : 400, { message: 'بيانات الطلب غير صالحة أو أكبر من المسموح.' }); }
  const text = typeof input?.text === 'string' ? input.text.trim() : '';
  const referenceId = typeof input?.reference_id === 'string' ? input.reference_id.trim() : '';
  if (!text || text.length > 500) return json(res, 400, { message: 'النص مطلوب، والحد الأقصى 500 حرف.' });
  if (!allowedVoices.has(referenceId)) return json(res, 403, { message: 'معرّف الصوت غير موجود في قائمة الأصوات المسموح بها على الخادم.' });

  try {
    const upstream = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'model': 's2.1-pro-free' },
      body: JSON.stringify({ text: `[${direction}] ${text}`, reference_id: referenceId, format: 'mp3' }),
      signal: AbortSignal.timeout(60_000)
    });
    if (!upstream.ok) {
      const status = upstream.status === 401 ? 502 : upstream.status === 403 ? 403 : upstream.status === 402 ? 402 : 502;
      const message = upstream.status === 401 ? 'مفتاح Fish Audio غير مقبول. راجعه في ملف .env.' : upstream.status === 402 ? 'حساب Fish Audio لا يسمح بهذا الطلب حاليًا. راجع الرصيد أو حدود الاستخدام.' : upstream.status === 403 ? 'هذا الصوت غير متاح للمفتاح المستخدم.' : 'Fish Audio لم يتمكن من إنشاء الصوت. حاول مرة أخرى.';
      return json(res, status, { message });
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    return send(res, 200, audio, upstream.headers.get('content-type') || 'audio/mpeg');
  } catch {
    return json(res, 502, { message: 'تعذر الوصول إلى Fish Audio. تحقق من الإنترنت وحاول مرة أخرى.' });
  }
});

server.listen(port, host, () => {
  console.log(`Modarribi server is running on ${host}:${port}`);
  console.log('Keep this window open while using the voice feature.');
});

