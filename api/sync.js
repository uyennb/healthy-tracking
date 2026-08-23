// Vercel Serverless Function for NutriFit 6-Digit Realtime Cloud Sync
const KV_BUCKET = 'https://kvdb.io/nutrifit_sync_v6_db';

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

    const kvUrl = `${KV_BUCKET}/${cleanCode}`;

    if (req.method === 'POST' || req.method === 'PUT') {
      const { logs, profile } = req.body || {};
      const payload = {
        logs: logs || [],
        profile: profile || {},
        updatedAt: new Date().toISOString(),
      };

      try {
        await fetch(kvUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.warn('KV store POST error:', e);
      }

      return res.status(200).json({ success: true, code: cleanCode, payload });
    }

    if (req.method === 'GET') {
      try {
        const fetchRes = await fetch(kvUrl);
        if (fetchRes.ok) {
          const data = await fetchRes.json();
          if (data && Array.isArray(data.logs)) {
            return res.status(200).json({ success: true, data });
          }
        }
      } catch (e) {
        console.warn('KV store GET error:', e);
      }

      return res.status(404).json({ error: 'Chưa có dữ liệu cho mã 6 số này' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
