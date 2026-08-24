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
 * Encode logs & profile into compact GZIP Base64URL string (~300 chars) for instant, loss-free link/QR transfer
 */
export async function encodeDataToBase64Async(logs: DailyLog[], profile: UserProfile): Promise<string> {
  try {
    const jsonStr = JSON.stringify({ logs, profile, t: Date.now() });
    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'));
      const response = new Response(stream);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return btoa(encodeURIComponent(jsonStr));
  } catch {
    return '';
  }
}

/**
 * Decode compressed GZIP or Base64 string back into exact logs & profile
 */
export async function decodeDataFromBase64Async(str: string): Promise<{ logs?: DailyLog[]; profile?: UserProfile } | null> {
  if (!str) return null;
  try {
    // 1. Try GZIP decompression first
    if (typeof DecompressionStream !== 'undefined') {
      try {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        const response = new Response(stream);
        const text = await response.text();
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.logs)) {
          return { logs: parsed.logs, profile: parsed.profile };
        }
      } catch {}
    }

    // 2. Fallback uncompressed decode
    const jsonStr = decodeURIComponent(atob(str));
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.logs)) {
      return { logs: parsed.logs, profile: parsed.profile };
    }
    return null;
  } catch {
    return null;
  }
}

export function encodeDataToBase64(logs: DailyLog[], profile: UserProfile): string {
  try {
    const jsonStr = JSON.stringify({ logs, profile, t: Date.now() });
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decodeDataFromBase64(base64Str: string): { logs?: DailyLog[]; profile?: UserProfile } | null {
  if (!base64Str) return null;
  try {
    let base64 = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const jsonStr = decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.logs)) {
      return { logs: parsed.logs, profile: parsed.profile };
    }
    return null;
  } catch {
    try {
      const jsonStr = decodeURIComponent(atob(base64Str));
      const parsed = JSON.parse(jsonStr);
      if (parsed && Array.isArray(parsed.logs)) {
        return { logs: parsed.logs, profile: parsed.profile };
      }
    } catch {}
    return null;
  }
}

export function isSampleLog(log: DailyLog): boolean {
  if (!log) return false;
  if (log.id && (log.id.startsWith('sample') || log.id.includes('sample'))) return true;
  return false;
}

export function mergeSingleLog(logA: DailyLog, logB: DailyLog): DailyLog {
  const isA = isSampleLog(logA);
  const isB = isSampleLog(logB);

  // If one is sample log and one is real user log, ALWAYS prefer real user log!
  if (isA && !isB) return logB;
  if (!isA && isB) return logA;

  // If both are real logs or both sample, merge fields with logB overriding logA
  return {
    ...logA,
    ...logB,
    caloIn: logB.caloIn ?? logA.caloIn ?? 0,
    caloOut: logB.caloOut ?? logA.caloOut ?? 0,
    protein: logB.protein ?? logA.protein ?? 0,
    carbs: logB.carbs ?? logA.carbs ?? 0,
    fats: logB.fats ?? logA.fats ?? 0,
    fiber: logB.fiber ?? logA.fiber ?? 0,
    workoutDuration: logB.workoutDuration ?? logA.workoutDuration ?? 0,
    workoutCalo: logB.workoutCalo ?? logA.workoutCalo ?? 0,
    note: logB.note || logA.note || '',
  };
}

import { sanitizeLog } from '../utils/storageUtils';

/**
 * Safely merge local and remote daily logs by date: incoming remote logs (pushed from phone) override matching local dates
 */
export function mergeLogs(local: DailyLog[] = [], remote: DailyLog[] = []): DailyLog[] {
  const safeLocal = (Array.isArray(local) ? local : []).map(sanitizeLog).filter((l): l is DailyLog => l !== null);
  const safeRemote = (Array.isArray(remote) ? remote : []).map(sanitizeLog).filter((l): l is DailyLog => l !== null);

  if (safeRemote.length === 0) return safeLocal;
  if (safeLocal.length === 0) return safeRemote;

  const map = new Map<string, DailyLog>();

  // Add local logs first
  safeLocal.forEach(log => {
    map.set(log.date, log);
  });

  // Incoming remote logs (from Cloud) OVERRIDE matching local dates to guarantee updated user data
  safeRemote.forEach(log => {
    map.set(log.date, log);
  });

  return Array.from(map.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/**
 * Merge local and remote user profiles without resetting custom profile settings
 */
export function mergeProfiles(local: UserProfile, remote?: UserProfile): UserProfile {
  if (!remote) return local;
  if (!local) return remote;

  return {
    name: (local.name && local.name !== 'Người dùng') ? local.name : (remote.name || local.name || 'Bảo Uyên'),
    gender: local.gender || remote.gender || 'female',
    birthDate: local.birthDate || remote.birthDate || '1998-05-15',
    height: (local.height && local.height > 0) ? local.height : (remote.height || 162),
    weight: (local.weight && local.weight > 0) ? local.weight : (remote.weight || 54),
    avatarUrl: local.avatarUrl || remote.avatarUrl,
  };
}

const REST_URL = 'https://api.restful-api.dev/objects';
const MASTER_INDEX_ID = 'ff8081819ff5b11001a02d5eafe47e4d';

/**
 * Push local data to Cloud Sync (ntfy.sh direct + Serverless API fallback)
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

  // 2. Direct ntfy.sh Realtime Cloud Push (0ms latency, zero rate limits)
  try {
    const topic = `nutrifit_sync_${digits}`;
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Direct ntfy.sh push error:', err);
  }

  // 3. Push to Vercel Serverless Sync API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    fetch(`/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: digits,
        logs,
        profile,
        updatedAt: payload.updatedAt,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {}

  return true;
}

/**
 * Fetch remote data for a 6-digit sync code (Network First to guarantee cross-device sync)
 */
export async function fetchCloudData(syncCode: string): Promise<CloudSyncPayload | null> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits || digits.length !== 6) return null;

  // 1. Direct ntfy.sh Realtime Cloud Fetch FIRST (0ms latency, zero rate limits)
  try {
    const topic = `nutrifit_sync_${digits}`;
    const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1`);
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(lines[i]);
          if (parsed.event === 'message' && parsed.message) {
            const payload = JSON.parse(parsed.message);
            if (payload && Array.isArray(payload.logs) && payload.logs.length > 0) {
              try {
                localStorage.setItem(`nutrifit_cloud_payload_${digits}`, JSON.stringify(payload));
              } catch {}
              return payload as CloudSyncPayload;
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('Direct ntfy.sh fetch error:', err);
  }

  // 2. Fetch from Vercel Serverless Sync API Fallback
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`/api/sync?code=${digits}&t=${Date.now()}`, { signal: controller.signal });
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
    console.warn('Network fetch error from /api/sync:', err);
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
 * Subscribe to Realtime Cloud changes via polling every 15s (only when active tab)
 */
export function subscribeToCloudSync(
  syncCode: string,
  onUpdate: (data: CloudSyncPayload) => void,
  pollIntervalMs = 15000
): () => void {
  const digits = normalizeSyncCode(syncCode);
  if (!digits || digits.length !== 6) return () => {};

  let lastUpdatedAt = '';

  const checkUpdates = async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
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
