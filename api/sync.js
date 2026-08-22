// Vercel Serverless Function for NutriFit 6-Digit Realtime Cloud Sync
const REST_URL = 'https://api.restful-api.dev/objects';

// Global memory cache across warm serverless invocations
if (!global.__nutrifit_sync_store) {
  global.__nutrifit_sync_store = new Map();
}
if (!global.__nutrifit_code_index) {
  global.__nutrifit_code_index = new Map();
}

const memoryStore = global.__nutrifit_sync_store;
const codeIndex = global.__nutrifit_code_index;

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const code = req.query.code || req.body?.code;
    if (!code) {
      return res.status(400).json({ error: 'Mã 6 số là bắt buộc' });
    }

    const cleanCode = String(code).replace(/[^0-9]/g, '');
    if (cleanCode.length !== 6) {
      return res.status(400).json({ error: 'Mã kết nối phải có đúng 6 chữ số' });
    }

    const objectName = `nutrifit_v6_${cleanCode}`;

    if (req.method === 'POST' || req.method === 'PUT') {
      const { logs, profile } = req.body || {};
      const payload = {
        logs: logs || [],
        profile: profile || {},
        updatedAt: new Date().toISOString(),
      };

      // 1. Cache in memory
      memoryStore.set(cleanCode, payload);

      // 2. Persist remotely
      try {
        const existingId = codeIndex.get(cleanCode);
        if (existingId) {
          const putRes = await fetch(`${REST_URL}/${existingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: objectName, data: payload }),
          });
          if (putRes.ok) {
            return res.status(200).json({ success: true, code: cleanCode, payload });
          }
        }

        const postRes = await fetch(REST_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: objectName, data: payload }),
        });

        if (postRes.ok) {
          const created = await postRes.json();
          if (created && created.id) {
            codeIndex.set(cleanCode, created.id);
          }
        }
      } catch (e) {
        console.warn('REST update fallback warning:', e);
      }

      return res.status(200).json({ success: true, code: cleanCode, payload });
    }

    if (req.method === 'GET') {
      // 1. Fast memory cache lookup
      if (memoryStore.has(cleanCode)) {
        const payload = memoryStore.get(cleanCode);
        return res.status(200).json({ success: true, data: payload });
      }

      // 2. Fetch by persisted ID lookup
      const existingId = codeIndex.get(cleanCode);
      if (existingId) {
        try {
          const fetchRes = await fetch(`${REST_URL}/${existingId}`);
          if (fetchRes.ok) {
            const item = await fetchRes.json();
            if (item && item.data && Array.isArray(item.data.logs)) {
              memoryStore.set(cleanCode, item.data);
              return res.status(200).json({ success: true, data: item.data });
            }
          }
        } catch (e) {
          console.warn('REST fetch by ID error:', e);
        }
      }

      return res.status(404).json({ error: 'Chưa có dữ liệu cho mã 6 số này' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
