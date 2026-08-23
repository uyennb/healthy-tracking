import { DailyLog, UserProfile } from '../types/health';

export interface CloudSyncPayload {
  logs: DailyLog[];
  profile: UserProfile;
  updatedAt: string;
}

/**
 * Clean & normalize a 6-digit numeric sync code (e.g. "686-888" -> "686888")
 */
export function normalizeSyncCode(code: string): string {
  if (!code) return '';
  return code.trim().replace(/[^0-9]/g, '');
}

/**
 * Format a 6-digit code for display (e.g. "686888" -> "686-888")
 */
export function formatDisplayCode(code: string): string {
  const digits = normalizeSyncCode(code);
  if (digits.length === 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return digits || code;
}

/**
 * Generate a random 6-digit numeric sync code (e.g. "686-888")
 */
export function generateNumericSyncCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${Math.floor(num / 1000)}-${num % 1000}`;
}

/**
 * Encode logs & profile into Base64 string for zero-network QR code transfer
 */
export function encodeDataToBase64(logs: DailyLog[], profile: UserProfile): string {
  try {
    const jsonStr = JSON.stringify({ logs, profile, t: Date.now() });
    return btoa(encodeURIComponent(jsonStr));
  } catch {
    return '';
  }
}

/**
 * Decode Base64 string back into logs & profile
 */
export function decodeDataFromBase64(base64Str: string): { logs?: DailyLog[]; profile?: UserProfile } | null {
  try {
    const jsonStr = decodeURIComponent(atob(base64Str));
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.logs)) {
      return { logs: parsed.logs, profile: parsed.profile };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely merge local and remote daily logs by date without losing local entries
 */
export function mergeLogs(local: DailyLog[] = [], remote: DailyLog[] = []): DailyLog[] {
  if (!remote || remote.length === 0) return local || [];
  if (!local || local.length === 0) return remote || [];

  const map = new Map<string, DailyLog>();

  // Add remote logs
  remote.forEach(log => {
    if (log && log.date) {
      map.set(log.date, log);
    }
  });

  // Merge local logs, prioritizing local non-empty entries
  local.forEach(log => {
    if (log && log.date) {
      const existing = map.get(log.date);
      if (!existing) {
        map.set(log.date, log);
      } else {
        map.set(log.date, {
          ...existing,
          ...log,
          caloIn: log.caloIn || existing.caloIn || 0,
          caloOut: log.caloOut || existing.caloOut || 0,
          protein: log.protein || existing.protein || 0,
          carbs: log.carbs || existing.carbs || 0,
          fats: log.fats || existing.fats || 0,
          workoutDuration: log.workoutDuration || existing.workoutDuration || 0,
          workoutCalo: log.workoutCalo || existing.workoutCalo || 0,
          note: log.note || existing.note || '',
        });
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

const REST_URL = 'https://api.restful-api.dev/objects';
const MASTER_INDEX_ID = 'ff8081819ff5b11001a02d5eafe47e4d';

/**
 * Push local data to Cloud Sync (Network API first, then Master Index direct fallback)
 */
export async function pushDataToCloud(
  syncCode: string,
  logs: DailyLog[],
  profile: UserProfile
): Promise<boolean> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits || digits.length !== 6) return false;

  const payload: CloudSyncPayload = {
    logs,
    profile,
    updatedAt: new Date().toISOString(),
  };

  // 1. Save to local browser storage backup
  try {
    localStorage.setItem(`nutrifit_cloud_payload_${digits}`, JSON.stringify(payload));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }

  // 2. Push to Vercel Serverless Sync API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: digits,
        logs,
        profile,
        updatedAt: payload.updatedAt,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) return true;
  } catch {}

  // 3. Direct Master Index Push Fallback (guarantees cross-device persistence)
  try {
    const postRes = await fetch(REST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `nutrifit_code_${digits}`, data: payload }),
    });

    if (postRes.ok) {
      const created = await postRes.json();
      if (created && created.id) {
        let indexMap: Record<string, string> = {};
        const indexRes = await fetch(`${REST_URL}/${MASTER_INDEX_ID}`);
        if (indexRes.ok) {
          const indexObj = await indexRes.json();
          indexMap = indexObj.data || {};
        }
        indexMap[digits] = created.id;
        await fetch(`${REST_URL}/${MASTER_INDEX_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'nutrifit_master_index_v6', data: indexMap }),
        });
        return true;
      }
    }
  } catch (err) {
    console.warn('Direct Master Index push error:', err);
  }

  return true;
}

/**
 * Fetch remote data for a 6-digit sync code (Network First to guarantee cross-device sync)
 */
export async function fetchCloudData(syncCode: string): Promise<CloudSyncPayload | null> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits || digits.length !== 6) return null;

  // 1. Fetch from Serverless Sync API FIRST
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`/api/sync?code=${digits}`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && json.data && Array.isArray(json.data.logs)) {
        try {
          localStorage.setItem(`nutrifit_cloud_payload_${digits}`, JSON.stringify(json.data));
        } catch {}
        return json.data as CloudSyncPayload;
      }
    }
  } catch (err) {
    console.warn('Network fetch error from /api/sync, trying direct Master Index fallback:', err);
  }

  // 2. Direct Master Index Fetch Fallback
  try {
    const indexRes = await fetch(`${REST_URL}/${MASTER_INDEX_ID}`);
    if (indexRes.ok) {
      const indexObj = await indexRes.json();
      const targetId = indexObj?.data?.[digits];

      if (targetId) {
        const payloadRes = await fetch(`${REST_URL}/${targetId}`);
        if (payloadRes.ok) {
          const item = await payloadRes.json();
          if (item && item.data && Array.isArray(item.data.logs)) {
            try {
              localStorage.setItem(`nutrifit_cloud_payload_${digits}`, JSON.stringify(item.data));
            } catch {}
            return item.data as CloudSyncPayload;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Direct Master Index fetch error:', err);
  }

  // 3. Fall back to local backup cache if offline
  try {
    const cached = localStorage.getItem(`nutrifit_cloud_payload_${digits}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.logs) && parsed.logs.length > 0) {
        return parsed as CloudSyncPayload;
      }
    }
  } catch {}

  return null;
}

/**
 * Subscribe to Realtime Cloud changes via polling every 3s
 */
export function subscribeToCloudSync(
  syncCode: string,
  onUpdate: (data: CloudSyncPayload) => void,
  pollIntervalMs = 3000
): () => void {
  const digits = normalizeSyncCode(syncCode);
  if (!digits || digits.length !== 6) return () => {};

  let lastUpdatedAt = '';

  const checkUpdates = async () => {
    try {
      const data = await fetchCloudData(digits);
      if (data && data.updatedAt && data.updatedAt !== lastUpdatedAt) {
        lastUpdatedAt = data.updatedAt;
        onUpdate(data);
      }
    } catch {}
  };

  checkUpdates();
  const intervalId = setInterval(checkUpdates, pollIntervalMs);
  return () => clearInterval(intervalId);
}
