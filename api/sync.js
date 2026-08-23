// Vercel Serverless Function for NutriFit 6-Digit Realtime Cloud Sync
const REST_URL = 'https://api.restful-api.dev/objects';
const MASTER_INDEX_ID = 'ff8081819ff5b11001a02d5eafe47e4d';

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
        // 1. Create payload object
        const postRes = await fetch(REST_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `nutrifit_code_${cleanCode}`, data: payload }),
        });

        if (postRes.ok) {
          const created = await postRes.json();
          if (created && created.id) {
            // 2. Fetch master index
            let indexMap = {};
            const indexRes = await fetch(`${REST_URL}/${MASTER_INDEX_ID}`);
            if (indexRes.ok) {
              const indexObj = await indexRes.json();
              indexMap = indexObj.data || {};
            }
            // 3. Update master index map with cleanCode -> created.id
            indexMap[cleanCode] = created.id;
            await fetch(`${REST_URL}/${MASTER_INDEX_ID}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'nutrifit_master_index_v6', data: indexMap }),
            });
          }
        }
      } catch (e) {
        console.warn('REST update error:', e);
      }

      return res.status(200).json({ success: true, code: cleanCode, payload });
    }

    if (req.method === 'GET') {
      try {
        // 1. Fetch master index
        const indexRes = await fetch(`${REST_URL}/${MASTER_INDEX_ID}`);
        if (indexRes.ok) {
          const indexObj = await indexRes.json();
          const targetId = indexObj?.data?.[cleanCode];

          if (targetId) {
            const payloadRes = await fetch(`${REST_URL}/${targetId}`);
            if (payloadRes.ok) {
              const item = await payloadRes.json();
              if (item && item.data && Array.isArray(item.data.logs)) {
                return res.status(200).json({ success: true, data: item.data });
              }
            }
          }
        }
      } catch (e) {
        console.warn('REST fetch error:', e);
      }

      return res.status(404).json({ error: 'Chưa có dữ liệu cho mã 6 số này' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
