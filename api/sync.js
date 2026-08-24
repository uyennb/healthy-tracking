// Vercel Serverless Function for NutriFit Conflict-Safe Multi-Device Cloud Sync
// Powered by Upstash Redis with Atomic Lua CAS & Strict 256-bit Auth Token Enforcement

import { defaultKvAdapter, KvAdapter } from './kvAdapter.js';

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

export function mergeLogsConflictSafe(local = [], remote = []) {
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
      // Keep existing local
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

export function mergeProfilesConflictSafe(local, remote) {
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

export function createSyncHandler(kv = defaultKvAdapter) {
  return async function handler(req, res) {
    // CORS Headers
    if (res.setHeader) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-sync-token'
      );
    }

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    try {
      const code = req.query?.code || req.body?.code;
      if (!code) {
        return res.status(400).json({ success: false, error: 'Mã kết nối là bắt buộc' });
      }

      const cleanCode = String(code).trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (!cleanCode || cleanCode.length < 4) {
        return res.status(400).json({ success: false, error: 'Mã kết nối không hợp lệ (tối thiểu 4 ký tự)' });
      }

      const storageKey = `nutrifit_sync_${cleanCode}`;
      const incomingToken = String(
        req.headers?.['x-sync-token'] || req.query?.token || req.body?.token || ''
      ).trim();

      // Check persistent database configuration
      if (!kv.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'Cơ sở dữ liệu bền vững chưa được cấu hình. Vui lòng thiết lập biến môi trường KV_REST_API_URL và KV_REST_API_TOKEN trên Vercel.',
        });
      }

      if (req.method === 'POST' || req.method === 'PUT') {
        const { logs: incomingLogs, profile: incomingProfile } = req.body || {};

        const MAX_RETRIES = 5;
        let writeSucceeded = false;
        let finalCandidate = null;

        // Optimistic Concurrency Control (Version + CAS) Retry Loop
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          const currentRes = await kv.getState(storageKey);
          if (currentRes.error) {
            return res.status(500).json({ success: false, error: `Lỗi đọc dữ liệu Cloud: ${currentRes.error}` });
          }

          const currentState = currentRes.data;

          // Strict Auth Token Enforcement:
          // If namespace exists and is protected, missing or wrong token -> 403 Forbidden
          if (currentState && currentState.authToken && currentState.authToken !== '') {
            if (!incomingToken || incomingToken !== currentState.authToken) {
              return res.status(403).json({
                success: false,
                error: 'Mã xác thực token không hợp lệ (403 Forbidden)',
              });
            }
          } else if (!currentState) {
            // New namespace creation requires a valid high-entropy token
            if (!incomingToken || incomingToken === '') {
              return res.status(401).json({
                success: false,
                error: 'Token bảo mật là bắt buộc khi tạo không gian đồng bộ mới (401 Unauthorized)',
              });
            }
          }

          const serverLogs = currentState?.logs || [];
          const serverProfile = currentState?.profile || {};
          const authToken = currentState?.authToken || incomingToken;

          const mergedLogs = mergeLogsConflictSafe(serverLogs, incomingLogs || []);
          const mergedProfile = mergeProfilesConflictSafe(serverProfile, incomingProfile || {});
          const expectedVersion = Number(currentState?.version) || 0;

          finalCandidate = {
            logs: mergedLogs,
            profile: mergedProfile,
            authToken,
            version: expectedVersion + 1,
            updatedAt: new Date().toISOString(),
          };

          const casResult = await kv.atomicCompareAndSet(storageKey, expectedVersion, finalCandidate, incomingToken);

          if (casResult.unauthorized) {
            return res.status(403).json({ success: false, error: 'Token không hợp lệ (403 Forbidden)' });
          }

          if (casResult.conflict) {
            // Version race detected! Retry merge with updated state
            continue;
          }

          if (casResult.success) {
            writeSucceeded = true;
            break;
          }

          return res.status(500).json({
            success: false,
            error: `Ghi dữ liệu bền vững thất bại: ${casResult.error || 'Unknown CAS error'}`,
          });
        }

        if (!writeSucceeded || !finalCandidate) {
          return res.status(409).json({
            success: false,
            error: 'Xung đột phiên bản đồng thời vượt quá số lần thử lại (409 Conflict)',
          });
        }

        return res.status(200).json({
          success: true,
          code: cleanCode,
          data: {
            logs: finalCandidate.logs,
            profile: finalCandidate.profile,
            updatedAt: finalCandidate.updatedAt,
            version: finalCandidate.version,
          },
        });
      }

      if (req.method === 'GET') {
        const currentRes = await kv.getState(storageKey);
        if (currentRes.error) {
          return res.status(500).json({ success: false, error: `Lỗi đọc dữ liệu Cloud: ${currentRes.error}` });
        }

        const data = currentRes.data;
        if (!data || !Array.isArray(data.logs)) {
          return res.status(404).json({ success: false, error: 'Chưa có dữ liệu cho mã này' });
        }

        // Strict Auth Token Enforcement for GET:
        if (data.authToken && data.authToken !== '') {
          if (!incomingToken || incomingToken !== data.authToken) {
            return res.status(403).json({
              success: false,
              error: 'Mã xác thực token không hợp lệ hoặc thiếu token (403 Forbidden)',
            });
          }
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
      return res.status(500).json({ success: false, error: err?.message || 'Server error' });
    }
  };
}

export default createSyncHandler(defaultKvAdapter);
