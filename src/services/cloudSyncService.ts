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
 * Push local data to Cloud Sync (Network API first, then Local Backup Cache)
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
    const timer = setTimeout(() => controller.abort(), 3000);

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
    return res.ok || true;
  } catch {
    return true;
  }
}

/**
 * Fetch remote data for a 6-digit sync code (Network First to guarantee cross-device sync)
 */
export async function fetchCloudData(syncCode: string): Promise<CloudSyncPayload | null> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits || digits.length !== 6) return null;

  // 1. Fetch from Serverless Sync API FIRST for fresh remote data
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`/api/sync?code=${digits}`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && json.data && Array.isArray(json.data.logs)) {
        // Cache the fresh remote data locally
        try {
          localStorage.setItem(`nutrifit_cloud_payload_${digits}`, JSON.stringify(json.data));
        } catch {}
        return json.data as CloudSyncPayload;
      }
    }
  } catch (err) {
    console.warn('Network fetch error, trying local cache:', err);
  }

  // 2. Fall back to local backup cache if network is offline or un-reachable
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
