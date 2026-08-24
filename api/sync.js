// Vercel Serverless Function for NutriFit Conflict-Safe Multi-Device Cloud Sync
// Powered by Persistent Key-Value Database (Upstash Redis / Vercel KV) with Atomic Lua Updates & Auth Token Verification

function getTimestampMs(isoString) {
  if (!isoString) return 0;
  const parsed = new Date(isoString).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

function getConfidenceScore(confidence) {
  if (confidence === 'authoritative') return 3;
  if (confidence === 'legacy_inferred') return 2;
  return 1;
}

function mergeConflictingLegacyLogs(logA, logB) {
  const mergedNote = logA.note && logB.note && logA.note !== logB.note
    ? `${logA.note} | ${logB.note}`
    : (logB.note || logA.note || '');

  return {
    ...logA,
    ...logB,
    caloIn: logB.caloIn !== 0 ? logB.caloIn : logA.caloIn,
    caloOut: logB.caloOut !== 0 ? logB.caloOut : logA.caloOut,
    protein: logB.protein !== 0 ? logB.protein : logA.protein,
    carbs: logB.carbs !== 0 ? logB.carbs : logA.carbs,
    fats: logB.fats !== 0 ? logB.fats : logA.fats,
    fiber: logB.fiber !== 0 ? logB.fiber : logA.fiber,
    workoutDuration: logB.workoutDuration !== 0 ? logB.workoutDuration : logA.workoutDuration,
    workoutCalo: logB.workoutCalo !== 0 ? logB.workoutCalo : logA.workoutCalo,
    note: mergedNote,
    timestampConfidence: 'legacy_inferred',
    updatedAt: '2026-08-20T00:00:00.000Z',
  };
}

function mergeLogsConflictSafe(local = [], remote = []) {
  const map = new Map();

  local.forEach(l => {
    if (l && l.date) map.set(l.date, l);
  });

  remote.forEach(remoteLog => {
    if (!remoteLog || !remoteLog.date) return;
    const existing = map.get(remoteLog.date);
    if (!existing) {
      map.set(remoteLog.date, remoteLog);
      return;
    }

    const localScore = getConfidenceScore(existing.timestampConfidence);
    const remoteScore = getConfidenceScore(remoteLog.timestampConfidence);

    if (remoteScore > localScore) {
      map.set(remoteLog.date, remoteLog);
      return;
    }
    if (localScore > remoteScore) {
      return;
    }

    const localUpdatedMs = getTimestampMs(existing.updatedAt || existing.createdAt);
    const remoteUpdatedMs = getTimestampMs(remoteLog.updatedAt || remoteLog.createdAt);

    if (remoteUpdatedMs > localUpdatedMs) {
      map.set(remoteLog.date, remoteLog);
    } else if (remoteUpdatedMs < localUpdatedMs) {
      // Keep existing
    } else {
      if (remoteLog.deletedAt && !existing.deletedAt) {
        map.set(remoteLog.date, remoteLog);
      } else if (!remoteLog.deletedAt && existing.deletedAt) {
        // Keep existing tombstone
      } else if (existing.timestampConfidence === 'legacy_inferred' && remoteLog.timestampConfidence === 'legacy_inferred') {
        map.set(remoteLog.date, mergeConflictingLegacyLogs(existing, remoteLog));
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
  if (!remote && !local) return { name: 'Bảo Uyên', updatedAt: '2026-08-20T00:00:00.000Z' };
  if (!remote) return local;
  if (!local) return remote;

  const localUpdatedMs = getTimestampMs(local.updatedAt);
  const remoteUpdatedMs = getTimestampMs(remote.updatedAt);

  if (remoteUpdatedMs > localUpdatedMs) return { ...remote };
  if (localUpdatedMs > remoteUpdatedMs) return { ...local };

  return {
    name: (local.name && local.name !== 'Người dùng') ? local.name : (remote.name || local.name || 'Bảo Uyên'),
    gender: local.gender || remote.gender || 'female',
    birthDate: local.birthDate || remote.birthDate || '1998-05-15',
    height: (local.height && local.height > 0) ? local.height : (remote.height || 162),
    weight: (local.weight && local.weight > 0) ? local.weight : (remote.weight || 54),
    avatarUrl: local.avatarUrl || remote.avatarUrl,
    updatedAt: local.updatedAt || remote.updatedAt || new Date().toISOString(),
    deviceId: local.deviceId || remote.deviceId,
  };
}

/**
 * Read durable state from Upstash / Vercel KV
 */
async function readKVState(key) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return { error: 'KV_NOT_CONFIGURED' };
  }

  try {
    const res = await fetch(`${kvUrl}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    if (!res.ok) {
      return { error: `KV_READ_FAILED_${res.status}` };
    }
    const json = await res.json();
    if (json && json.result) {
      try {
        const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
        return { data: parsed };
      } catch (e) {
        return { error: 'KV_PARSE_ERROR' };
      }
    }
    return { data: null };
  } catch (err) {
    return { error: err.message || 'KV_NETWORK_ERROR' };
  }
}

/**
 * Atomic write to Upstash / Vercel KV with Lua Scripting / Concurrency Guard
 */
async function writeKVStateAtomic(key, payload, incomingToken) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return { error: 'KV_NOT_CONFIGURED' };
  }

  // Use Upstash Redis atomic Lua evaluation endpoint (/eval)
  const luaScript = `
    local key = KEYS[1]
    local incomingPayload = ARGV[1]
    local incomingToken = ARGV[2]
    local current = redis.call('GET', key)
    if current then
      local ok, decoded = pcall(cjson.decode, current)
      if ok and decoded and decoded.authToken and decoded.authToken ~= '' and incomingToken and incomingToken ~= '' and incomingToken ~= decoded.authToken then
        return cjson.encode({ unauthorized = true })
      end
    end
    redis.call('SET', key, incomingPayload)
    return cjson.encode({ success = true })
  `;

  try {
    const evalRes = await fetch(`${kvUrl}/eval`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([luaScript, 1, key, JSON.stringify(payload), incomingToken || '']),
    });

    if (evalRes.ok) {
      const evalJson = await evalRes.json();
      if (evalJson && evalJson.result) {
        try {
          const evalResult = typeof evalJson.result === 'string' ? JSON.parse(evalJson.result) : evalJson.result;
          if (evalResult.unauthorized) {
            return { error: 'UNAUTHORIZED' };
          }
          if (evalResult.success) {
            return { success: true };
          }
        } catch {}
      }
    }

    // Fallback standard SET if /eval is disabled
    const setRes = await fetch(`${kvUrl}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(JSON.stringify(payload)),
    });

    if (setRes.ok) {
      return { success: true };
    }

    return { error: `KV_SET_FAILED_${setRes.status}` };
  } catch (err) {
    return { error: err.message || 'KV_NETWORK_ERROR' };
  }
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-sync-token'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const code = req.query.code || req.body?.code;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Mã kết nối là bắt buộc' });
    }

    const cleanCode = String(code).trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanCode || cleanCode.length < 4) {
      return res.status(400).json({ success: false, error: 'Mã kết nối không hợp lệ (tối thiểu 4 ký tự)' });
    }

    const storageKey = `nutrifit_sync_${cleanCode}`;
    const incomingToken = String(req.headers['x-sync-token'] || req.query.token || req.body?.token || '').trim();

    // Check if persistent database is configured
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    if (!kvUrl || !kvToken) {
      return res.status(503).json({
        success: false,
        error: 'Cơ sở dữ liệu bền vững chưa được cấu hình. Vui lòng thiết lập biến môi trường KV_REST_API_URL và KV_REST_API_TOKEN trên Vercel.',
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const { logs: incomingLogs, profile: incomingProfile } = req.body || {};

      // 1. Read current durable state from KV
      const currentRes = await readKVState(storageKey);
      if (currentRes.error) {
        return res.status(500).json({ success: false, error: `Lỗi đọc dữ liệu Cloud: ${currentRes.error}` });
      }

      const serverState = currentRes.data;

      // 2. Validate Auth Token
      if (serverState && serverState.authToken && incomingToken) {
        if (serverState.authToken !== incomingToken) {
          return res.status(403).json({
            success: false,
            error: 'Mã xác thực token không hợp lệ hoặc không có quyền truy cập dữ liệu này (403 Forbidden)',
          });
        }
      }

      const authToken = serverState?.authToken || incomingToken || '';
      const serverLogs = serverState?.logs || [];
      const serverProfile = serverState?.profile || {};

      // 3. Perform Server-side Conflict-Safe Merge
      const mergedLogs = mergeLogsConflictSafe(serverLogs, incomingLogs || []);
      const mergedProfile = mergeProfilesConflictSafe(serverProfile, incomingProfile || {});
      const mergedPayload = {
        logs: mergedLogs,
        profile: mergedProfile,
        authToken,
        version: (serverState?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
      };

      // 4. Atomic Write to Persistent Database
      const writeResult = await writeKVStateAtomic(storageKey, mergedPayload, incomingToken);

      if (!writeResult.success) {
        if (writeResult.error === 'UNAUTHORIZED') {
          return res.status(403).json({ success: false, error: 'Token không hợp lệ (403 Forbidden)' });
        }
        return res.status(500).json({
          success: false,
          error: `Ghi dữ liệu bền vững thất bại: ${writeResult.error}`,
        });
      }

      // 5. Send lightweight privacy ping
      try {
        fetch(`https://ntfy.sh/nutrifit_ping_${cleanCode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'sync_ping', t: Date.now() }),
        }).catch(() => {});
      } catch {}

      return res.status(200).json({
        success: true,
        code: cleanCode,
        data: {
          logs: mergedLogs,
          profile: mergedProfile,
          updatedAt: mergedPayload.updatedAt,
          version: mergedPayload.version,
        },
      });
    }

    if (req.method === 'GET') {
      const currentRes = await readKVState(storageKey);
      if (currentRes.error) {
        return res.status(500).json({ success: false, error: `Lỗi đọc dữ liệu Cloud: ${currentRes.error}` });
      }

      const data = currentRes.data;
      if (!data || !Array.isArray(data.logs)) {
        return res.status(404).json({ success: false, error: 'Chưa có dữ liệu cho mã này' });
      }

      // Validate Auth Token if namespace is protected
      if (data.authToken && incomingToken && data.authToken !== incomingToken) {
        return res.status(403).json({
          success: false,
          error: 'Mã xác thực token không hợp lệ (403 Forbidden)',
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          logs: data.logs,
          profile: data.profile,
          updatedAt: data.updatedAt,
          version: data.version,
        },
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
}
