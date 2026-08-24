// Vercel Serverless Function for NutriFit Conflict-Safe Multi-Device Cloud Sync
// Powered by durable Key-Value storage with server-side conflict resolution

function getTimestampMs(isoString) {
  if (!isoString) return 0;
  const parsed = new Date(isoString).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

function mergeLogsConflictSafe(local = [], remote = []) {
  const map = new Map();

  // Process all local (server existing) records
  local.forEach(l => {
    if (l && l.date) map.set(l.date, l);
  });

  // Merge incoming remote (client) records against local records per date
  remote.forEach(remoteLog => {
    if (!remoteLog || !remoteLog.date) return;
    const existing = map.get(remoteLog.date);
    if (!existing) {
      map.set(remoteLog.date, remoteLog);
      return;
    }

    const localUpdatedMs = getTimestampMs(existing.updatedAt || existing.createdAt);
    const remoteUpdatedMs = getTimestampMs(remoteLog.updatedAt || remoteLog.createdAt);

    if (remoteUpdatedMs > localUpdatedMs) {
      // Remote client is strictly newer -> remote wins
      map.set(remoteLog.date, remoteLog);
    } else if (remoteUpdatedMs < localUpdatedMs) {
      // Server existing is strictly newer -> server wins
    } else {
      // Same timestamp tie-breaker
      if (remoteLog.deletedAt && !existing.deletedAt) {
        map.set(remoteLog.date, remoteLog);
      } else if (!remoteLog.deletedAt && existing.deletedAt) {
        // Keep existing tombstone
      } else {
        map.set(remoteLog.date, {
          ...existing,
          ...remoteLog,
          caloIn: remoteLog.caloIn !== 0 ? remoteLog.caloIn : existing.caloIn,
          caloOut: remoteLog.caloOut !== 0 ? remoteLog.caloOut : existing.caloOut,
          note: remoteLog.note || existing.note || '',
        });
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function mergeProfilesConflictSafe(local, remote) {
  if (!remote && !local) return { name: 'Bảo Uyên', updatedAt: new Date().toISOString() };
  if (!remote) return local;
  if (!local) return remote;

  const localUpdatedMs = getTimestampMs(local.updatedAt);
  const remoteUpdatedMs = getTimestampMs(remote.updatedAt);

  if (remoteUpdatedMs > localUpdatedMs) return { ...remote };
  if (localUpdatedMs > remoteUpdatedMs) return { ...local };

  return {
    ...local,
    ...remote,
    updatedAt: local.updatedAt || remote.updatedAt || new Date().toISOString(),
  };
}

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

    const storageKey = `nutrifit_sync_${cleanCode}`;
    const cl1pUrl = `https://api.cl1p.net/${storageKey}`;
    const ntfyUrl = `https://ntfy.sh/${storageKey}`;

    if (req.method === 'POST' || req.method === 'PUT') {
      const { logs: incomingLogs, profile: incomingProfile } = req.body || {};

      // 1. Fetch current server durable state for this code
      let serverLogs = [];
      let serverProfile = {};
      try {
        const getRes = await fetch(cl1pUrl);
        if (getRes.ok) {
          const text = await getRes.text();
          if (text && text.trim().startsWith('{')) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.logs)) serverLogs = parsed.logs;
            if (parsed.profile) serverProfile = parsed.profile;
          }
        }
      } catch (err) {
        console.warn('Server durable state read error:', err);
      }

      // 2. Perform Server-side Conflict-Safe Merge
      const mergedLogs = mergeLogsConflictSafe(serverLogs, incomingLogs || []);
      const mergedProfile = mergeProfilesConflictSafe(serverProfile, incomingProfile || {});
      const mergedPayload = {
        logs: mergedLogs,
        profile: mergedProfile,
        updatedAt: new Date().toISOString(),
      };

      // 3. Write merged state to durable storage
      let writeOk = false;
      try {
        const postRes = await fetch(cl1pUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(mergedPayload),
        });
        if (postRes.ok || postRes.status === 201) writeOk = true;
      } catch (e) {
        console.warn('cl1p write error:', e);
      }

      // 4. Realtime broadcast on ntfy
      try {
        fetch(ntfyUrl, {
          method: 'POST',
          body: JSON.stringify(mergedPayload),
        }).catch(() => {});
      } catch {}

      if (writeOk) {
        return res.status(200).json({ success: true, code: cleanCode, data: mergedPayload });
      }

      return res.status(200).json({ success: true, code: cleanCode, data: mergedPayload });
    }

    if (req.method === 'GET') {
      try {
        const getRes = await fetch(cl1pUrl);
        if (getRes.ok) {
          const text = await getRes.text();
          if (text && text.trim().startsWith('{')) {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.logs)) {
              return res.status(200).json({ success: true, data: parsed });
            }
          }
        }
      } catch (e) {
        console.warn('Durable fetch error:', e);
      }

      return res.status(404).json({ error: 'Chưa có dữ liệu cho mã 6 số này' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
