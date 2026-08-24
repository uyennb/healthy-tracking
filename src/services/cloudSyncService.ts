import { DailyLog, UserProfile, SyncStatus } from '../types/health';
import { sanitizeLog, saveLogsWithTombstones, saveProfile, saveLastSyncTime, getAllStoredLogsWithTombstones, getStoredProfile } from '../utils/storageUtils';

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
 * Compare two ISO-8601 timestamps safely
 */
function getTimestampMs(isoString?: string | null): number {
  if (!isoString) return 0;
  const parsed = new Date(isoString).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Conflict-Safe Log Merge based on per-record updatedAt and deletedAt (tombstones)
 * DOES NOT bias toward local or remote; the newer updatedAt strictly wins.
 */
export function mergeLogsConflictSafe(local: DailyLog[] = [], remote: DailyLog[] = []): DailyLog[] {
  const safeLocal = (Array.isArray(local) ? local : []).map(sanitizeLog).filter((l): l is DailyLog => l !== null);
  const safeRemote = (Array.isArray(remote) ? remote : []).map(sanitizeLog).filter((l): l is DailyLog => l !== null);

  const map = new Map<string, DailyLog>();

  // Process all local records
  safeLocal.forEach(localLog => {
    map.set(localLog.date, localLog);
  });

  // Merge remote records against local records per date
  safeRemote.forEach(remoteLog => {
    const existing = map.get(remoteLog.date);
    if (!existing) {
      map.set(remoteLog.date, remoteLog);
      return;
    }

    const localUpdatedMs = getTimestampMs(existing.updatedAt || existing.createdAt);
    const remoteUpdatedMs = getTimestampMs(remoteLog.updatedAt || remoteLog.createdAt);

    if (remoteUpdatedMs > localUpdatedMs) {
      // Remote is strictly newer -> remote wins
      map.set(remoteLog.date, remoteLog);
    } else if (remoteUpdatedMs < localUpdatedMs) {
      // Local is strictly newer -> local wins (keep existing)
    } else {
      // Tie-breaker: If one is deleted, tombstone wins. Otherwise, deterministic id compare.
      if (remoteLog.deletedAt && !existing.deletedAt) {
        map.set(remoteLog.date, remoteLog);
      } else if (!remoteLog.deletedAt && existing.deletedAt) {
        // keep existing tombstone
      } else {
        // Merge field values deterministically
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

/**
 * Merge legacy alias for compatibility
 */
export function mergeLogs(local: DailyLog[] = [], remote: DailyLog[] = []): DailyLog[] {
  return mergeLogsConflictSafe(local, remote);
}

/**
 * Conflict-Safe User Profile Merge based on updatedAt
 */
export function mergeProfilesConflictSafe(local?: UserProfile | null, remote?: UserProfile | null): UserProfile {
  if (!remote && !local) {
    return {
      name: 'Bảo Uyên',
      gender: 'female',
      birthDate: '1998-05-15',
      height: 162,
      weight: 54,
      updatedAt: new Date().toISOString(),
    };
  }
  if (!remote) return local!;
  if (!local) return remote;

  const localUpdatedMs = getTimestampMs(local.updatedAt);
  const remoteUpdatedMs = getTimestampMs(remote.updatedAt);

  if (remoteUpdatedMs > localUpdatedMs) {
    return { ...remote };
  } else if (localUpdatedMs > remoteUpdatedMs) {
    return { ...local };
  }

  // Same timestamp tie-breaker
  return {
    name: local.name || remote.name || 'Bảo Uyên',
    gender: local.gender || remote.gender || 'female',
    birthDate: local.birthDate || remote.birthDate || '1998-05-15',
    height: local.height || remote.height || 162,
    weight: local.weight || remote.weight || 54,
    avatarUrl: local.avatarUrl || remote.avatarUrl,
    updatedAt: local.updatedAt || remote.updatedAt || new Date().toISOString(),
    deviceId: local.deviceId || remote.deviceId,
  };
}

export function mergeProfiles(local: UserProfile, remote?: UserProfile): UserProfile {
  return mergeProfilesConflictSafe(local, remote);
}

/**
 * Push data to durable cloud backend with server-side conflict resolution
 * Returns true ONLY when persistent durable backend confirms write!
 */
export async function pushDataToCloud(
  syncCode: string,
  logs: DailyLog[],
  profile: UserProfile
): Promise<boolean> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits || digits.length !== 6) return false;

  const payload: CloudSyncPayload = {
    logs: logs.map(l => sanitizeLog(l)).filter((l): l is DailyLog => l !== null),
    profile,
    updatedAt: new Date().toISOString(),
  };

  let durableWriteSuccess = false;

  // 1. Primary: Serverless Sync API (Performs Server-side conflict-safe merge & durable persistence)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: digits,
        logs: payload.logs,
        profile: payload.profile,
        updatedAt: payload.updatedAt,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      durableWriteSuccess = true;
      try {
        const json = await res.json();
        if (json && json.data && Array.isArray(json.data.logs)) {
          // Update local with server-merged state
          saveLogsWithTombstones(json.data.logs);
          if (json.data.profile) saveProfile(json.data.profile);
        }
      } catch {}
    }
  } catch (err) {
    console.warn('/api/sync push error:', err);
  }

  // 2. Direct Durable Key-Value Store (cl1p.net persistent backend)
  try {
    const cl1pKey = `nutrifit_sync_${digits}`;
    const cl1pRes = await fetch(`https://api.cl1p.net/${cl1pKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });
    if (cl1pRes.ok || cl1pRes.status === 201) {
      durableWriteSuccess = true;
    }
  } catch (err) {
    console.warn('cl1p.net durable push error:', err);
  }

  // 3. Realtime Notification Transport (ntfy.sh event broadcast)
  try {
    fetch(`https://ntfy.sh/nutrifit_sync_${digits}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}

  if (durableWriteSuccess) {
    saveLastSyncTime(new Date().toISOString());
    return true;
  }

  return false;
}

/**
 * Fetch remote state from durable cloud backend
 */
export async function fetchCloudData(syncCode: string): Promise<CloudSyncPayload | null> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits || digits.length !== 6) return null;

  // 1. Fetch from Serverless Sync API FIRST
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`/api/sync?code=${digits}&t=${Date.now()}`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && json.data && Array.isArray(json.data.logs)) {
        const cleanLogs = json.data.logs.map((l: any) => sanitizeLog(l)).filter((l: DailyLog | null): l is DailyLog => l !== null);
        return {
          logs: cleanLogs,
          profile: json.data.profile || {},
          updatedAt: json.data.updatedAt || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('/api/sync fetch error:', err);
  }

  // 2. Fetch from Direct Durable Key-Value Store (cl1p.net)
  try {
    const cl1pKey = `nutrifit_sync_${digits}`;
    const cl1pRes = await fetch(`https://api.cl1p.net/${cl1pKey}`);
    if (cl1pRes.ok) {
      const text = await cl1pRes.text();
      if (text && text.trim().startsWith('{')) {
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.logs)) {
          const cleanLogs = parsed.logs.map((l: any) => sanitizeLog(l)).filter((l: DailyLog | null): l is DailyLog => l !== null);
          return {
            logs: cleanLogs,
            profile: parsed.profile || {},
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
        }
      }
    }
  } catch (err) {
    console.warn('cl1p.net fetch error:', err);
  }

  return null;
}

/**
 * Startup 2-way Synchronization:
 * Reads remote state first, merges conflict-safe without destroying local newer edits,
 * and pushes back to cloud only if local has newer records.
 */
export async function syncOnStartup(
  syncCode: string,
  localLogs: DailyLog[],
  localProfile: UserProfile
): Promise<{ logs: DailyLog[]; profile: UserProfile; status: SyncStatus }> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits || digits.length !== 6) {
    return {
      logs: localLogs.filter(l => !l.deletedAt),
      profile: localProfile,
      status: 'pending',
    };
  }

  try {
    const remote = await fetchCloudData(digits);
    if (!remote) {
      // Remote does not exist yet (brand new code) -> Push initial local state
      const pushOk = await pushDataToCloud(digits, localLogs, localProfile);
      return {
        logs: localLogs.filter(l => !l.deletedAt),
        profile: localProfile,
        status: pushOk ? 'synced' : 'pending',
      };
    }

    // Two-way Conflict-Safe Merge
    const mergedLogsAll = mergeLogsConflictSafe(localLogs, remote.logs);
    const mergedProfile = mergeProfilesConflictSafe(localProfile, remote.profile);

    // Save merged state locally
    saveLogsWithTombstones(mergedLogsAll);
    saveProfile(mergedProfile);
    saveLastSyncTime(new Date().toISOString());

    // Check if local had newer changes that server needs to store
    const localHasNewer = mergedLogsAll.some(m => {
      const remoteMatch = remote.logs.find(r => r.date === m.date);
      if (!remoteMatch) return true;
      return getTimestampMs(m.updatedAt) > getTimestampMs(remoteMatch.updatedAt);
    });

    if (localHasNewer) {
      await pushDataToCloud(digits, mergedLogsAll, mergedProfile);
    }

    return {
      logs: mergedLogsAll.filter(l => !l.deletedAt),
      profile: mergedProfile,
      status: 'synced',
    };
  } catch (err) {
    console.warn('Startup sync error:', err);
    return {
      logs: localLogs.filter(l => !l.deletedAt),
      profile: localProfile,
      status: 'error',
    };
  }
}

/**
 * Subscribe to realtime Cloud sync updates using event transport
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

  const intervalId = setInterval(checkUpdates, pollIntervalMs);
  return () => clearInterval(intervalId);
}

/**
 * Encode logs & profile into compact Base64URL string for link/QR transfer
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

export async function decodeDataFromBase64Async(str: string): Promise<{ logs?: DailyLog[]; profile?: UserProfile } | null> {
  if (!str) return null;
  try {
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
