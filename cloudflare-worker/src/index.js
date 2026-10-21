const APP_ORIGIN = 'https://sr01064.github.io';
const ALLOWED_REFERENCE_IDS = new Set([
  '2fb8ea5aea1a4a5da4b6808704de238e',
]);
const VOICE_STYLE = 'deep, slightly raspy, mature masculine voice; energetic, varied and theatrical; original anime-inspired mentor; clear English with playful, lightly sarcastic teasing, sounding amused and confident, never cruel or demeaning; do not imitate any existing character or actor';

function json(body, status = 200, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (origin === APP_ORIGIN) {
    headers['Access-Control-Allow-Origin'] = APP_ORIGIN;
    headers.Vary = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = !origin || origin === APP_ORIGIN;

    if (url.pathname === '/' && request.method === 'GET') {
      return json({ service: 'modarribi-fish-audio', status: 'ok' }, 200, origin);
    }
    if (url.pathname !== '/api/tts') return json({ message: 'المسار غير موجود.' }, 404, origin);
    if (!allowedOrigin) return json({ message: 'مصدر الطلب غير مسموح.' }, 403);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': APP_ORIGIN,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }
    if (request.method !== 'POST') return json({ message: 'استخدم POST.' }, 405, origin);
    if (!env.FISH_API_KEY) return json({ message: 'مفتاح Fish Audio غير مضبوط على الخادم.' }, 503, origin);

    let input;
    try {
      const raw = await request.text();
      if (raw.length > 8192) return json({ message: 'بيانات الطلب أكبر من المسموح.' }, 413, origin);
      input = JSON.parse(raw);
    } catch {
      return json({ message: 'بيانات الطلب غير صالحة.' }, 400, origin);
    }

    const text = typeof input?.text === 'string' ? input.text.trim() : '';
    const referenceId = typeof input?.reference_id === 'string' ? input.reference_id.trim() : '';
    if (!text || text.length > 500) return json({ message: 'النص مطلوب، والحد الأقصى 500 حرف.' }, 400, origin);
    if (!ALLOWED_REFERENCE_IDS.has(referenceId)) {
      return json({ message: 'معرّف الصوت غير مسموح به على الخادم.' }, 403, origin);
    }

    try {
      const upstream = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.FISH_API_KEY}`,
          'Content-Type': 'application/json',
          model: 's2.1-pro-free',
        },
        body: JSON.stringify({
          text: `[${VOICE_STYLE}] ${text}`,
          reference_id: referenceId,
          format: 'mp3',
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!upstream.ok) {
        if (upstream.status === 401) return json({ message: 'مفتاح Fish Audio غير مقبول. راجعه في إعدادات الخادم.' }, 502, origin);
        if (upstream.status === 402) return json({ message: 'حساب Fish Audio لا يسمح بهذا الطلب حاليًا. راجع الرصيد أو حدود الاستخدام.' }, 402, origin);
        if (upstream.status === 403) return json({ message: 'هذا الصوت غير متاح للمفتاح المستخدم.' }, 403, origin);
        return json({ message: 'Fish Audio لم يتمكن من إنشاء الصوت. حاول مرة أخرى.' }, 502, origin);
      }

      const headers = new Headers({
        'Content-Type': upstream.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': APP_ORIGIN,
        Vary: 'Origin',
      });
      return new Response(upstream.body, { status: 200, headers });
    } catch {
      return json({ message: 'تعذر الوصول إلى Fish Audio. تحقق من الإنترنت وحاول مرة أخرى.' }, 502, origin);
    }
  },
};

