// Netlify Function dùng để lưu & đọc bình luận
// Lưu vào Netlify Blobs, không cần database bên ngoài

const { getStore } = require('@netlify/blobs');

const ALLOWED_ORIGINS = ['*']; // có thể chỉnh thành domain cụ thể sau

exports.handler = async function (event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': chooseOrigin(event.headers.origin),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const store = getStore('reviews'); // tên store blobs

  try {
    if (event.httpMethod === 'GET') {
      const url = new URL(event.rawUrl);
      const key = url.searchParams.get('key');
      if (!key) return resp(400, { error: 'Missing key' }, corsHeaders);

      const json = await store.get(key, { type: 'json' });
      return resp(200, json || [], corsHeaders);
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const key = body.key;
      const review = body.review;

      if (!key || !review) return resp(400, { error: 'Missing key or review' }, corsHeaders);

      const rating = Number(review.rating);
      const text = String(review.text || '').trim();

      if (!rating || rating < 1 || rating > 5) {
        return resp(400, { error: 'Invalid rating' }, corsHeaders);
      }
      if (!text) {
        return resp(400, { error: 'Empty text' }, corsHeaders);
      }

      const now = Date.now();
      const item = {
        name: (review.name || 'Ẩn danh').toString().slice(0, 80),
        title: (review.title || '').toString().slice(0, 120),
        text: text.slice(0, 2000),
        rating,
        ts: now
      };

      const list = (await store.get(key, { type: 'json' })) || [];
      list.push(item);
      await store.set(key, JSON.stringify(list), { metadata: { updatedAt: now } });

      return resp(200, { ok: true }, corsHeaders);
    }

    return resp(405, { error: 'Method not allowed' }, corsHeaders);
  } catch (e) {
    console.error(e);
    return resp(500, { error: 'Server error' }, corsHeaders);
  }
};

function resp(status, data, headers) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  };
}

function chooseOrigin(origin) {
  if (!origin) return '*';
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) return origin;
  return '*';
}
