import { createHmac, timingSafeEqual } from 'node:crypto';

const text = (body, status = 200) => new Response(body, {
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
});

export function GET(request) {
  const query = new URL(request.url).searchParams;
  const valid = query.get('hub.mode') === 'subscribe'
    && query.get('hub.verify_token') === process.env.META_VERIFY_TOKEN;
  return valid ? text(query.get('hub.challenge') || '') : text('Forbidden', 403);
}

export async function POST(request) {
  const rawBody = await request.text();
  const provided = request.headers.get('x-hub-signature-256') || '';
  const expected = `sha256=${createHmac('sha256', process.env.META_APP_SECRET || '').update(rawBody).digest('hex')}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return text('Invalid signature', 401);
  // Acknowledge quickly; durable event processing will be added with token storage.
  return text('EVENT_RECEIVED');
}
