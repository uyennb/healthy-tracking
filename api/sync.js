// Vercel Serverless Function for NutriFit 6-Digit Realtime Cloud Sync
// Powered by zero-rate-limit paste storage engine

let MASTER_INDEX_URL = 'https://paste.rs/Qtyao';

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

    if (req.method === 'POST' || req.method === 'PUT') {
      const { logs, profile } = req.body || {};
      const payload = {
        logs: logs || [],
        profile: profile || {},
        updatedAt: new Date().toISOString(),
      };

      try {
        // 1. Store payload to paste.rs
        const postRes = await fetch('https://paste.rs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (postRes.ok) {
          const itemUrl = (await postRes.text()).trim();
          if (itemUrl && itemUrl.startsWith('http')) {
            // 2. Fetch master index
            let indexMap = {};
            try {
              const idxRes = await fetch(MASTER_INDEX_URL);
              if (idxRes.ok) indexMap = await idxRes.json();
            } catch {}

            // 3. Update master index map with cleanCode -> itemUrl
            indexMap[cleanCode] = itemUrl;
            const newIdxRes = await fetch('https://paste.rs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(indexMap),
            });
            if (newIdxRes.ok) {
              const newUrl = (await newIdxRes.text()).trim();
              if (newUrl && newUrl.startsWith('http')) {
                MASTER_INDEX_URL = newUrl;
              }
            }
          }
        }
      } catch (e) {
        console.warn('paste.rs update error:', e);
      }

      return res.status(200).json({ success: true, code: cleanCode, payload });
    }

    if (req.method === 'GET') {
      try {
        let indexMap = {};
        try {
          const idxRes = await fetch(MASTER_INDEX_URL);
          if (idxRes.ok) indexMap = await idxRes.json();
        } catch {}

        const itemUrl = indexMap[cleanCode];
        if (itemUrl) {
          const itemRes = await fetch(itemUrl);
          if (itemRes.ok) {
            const data = await itemRes.json();
            if (data && Array.isArray(data.logs)) {
              return res.status(200).json({ success: true, data });
            }
          }
        }
      } catch (e) {
        console.warn('paste.rs fetch error:', e);
      }

      return res.status(404).json({ error: 'Chưa có dữ liệu cho mã 6 số này' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
