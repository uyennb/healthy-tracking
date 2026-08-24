// Vercel Serverless Function for NutriFit 6-Digit Realtime Cloud Sync
// Powered by zero-rate-limit ntfy.sh messaging engine

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

    const topic = `nutrifit_sync_${cleanCode}`;

    if (req.method === 'POST' || req.method === 'PUT') {
      const { logs, profile } = req.body || {};
      const payload = {
        logs: logs || [],
        profile: profile || {},
        updatedAt: new Date().toISOString(),
      };

      try {
        const postRes = await fetch(`https://ntfy.sh/${topic}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (postRes.ok) {
          return res.status(200).json({ success: true, code: cleanCode, payload });
        }
      } catch (e) {
        console.warn('ntfy push error:', e);
      }

      return res.status(200).json({ success: true, code: cleanCode, payload });
    }

    if (req.method === 'GET') {
      try {
        const getRes = await fetch(`https://ntfy.sh/${topic}/json?poll=1`);
        if (getRes.ok) {
          const text = await getRes.text();
          const lines = text.trim().split('\n').filter(Boolean);
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const parsed = JSON.parse(lines[i]);
              if (parsed.event === 'message' && parsed.message) {
                const payload = JSON.parse(parsed.message);
                if (payload && Array.isArray(payload.logs)) {
                  return res.status(200).json({ success: true, data: payload });
                }
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn('ntfy fetch error:', e);
      }

      return res.status(404).json({ error: 'Chưa có dữ liệu cho mã 6 số này' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
