// Vercel Serverless Function for NutriFit 6-Digit Realtime Cloud Sync
const REST_URL = 'https://api.restful-api.dev/objects';

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

      // Check existing object to update or create
      try {
        const fetchRes = await fetch(REST_URL);
        if (fetchRes.ok) {
          const items = await fetchRes.json();
          if (Array.isArray(items)) {
            const existing = items.find((item) => item.name === objectName);
            if (existing && existing.id) {
              await fetch(`${REST_URL}/${existing.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: objectName, data: payload }),
              });
              return res.status(200).json({ success: true, code: cleanCode, payload });
            }
          }
        }
      } catch (e) {
        console.warn('REST update fallback error:', e);
      }

      // Create new object if not found
      await fetch(REST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: objectName, data: payload }),
      });

      return res.status(200).json({ success: true, code: cleanCode, payload });
    }

    if (req.method === 'GET') {
      try {
        const fetchRes = await fetch(REST_URL);
        if (fetchRes.ok) {
          const items = await fetchRes.json();
          if (Array.isArray(items)) {
            const found = items.find((item) => item.name === objectName);
            if (found && found.data && Array.isArray(found.data.logs)) {
              return res.status(200).json({ success: true, data: found.data });
            }
          }
        }
      } catch (e) {
        console.warn('REST fetch fallback error:', e);
      }

      return res.status(404).json({ error: 'Chưa có dữ liệu cho mã 6 số này' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
