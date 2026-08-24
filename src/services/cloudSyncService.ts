import { DailyLog, UserProfile, SyncStatus } from '../types/health';
import {
  saveLogsWithTombstones,
  saveProfile,
  saveLastSyncTime,
  getStoredSyncToken,
  saveSyncToken,
  getAllStoredLogsWithTombstones,
  getStoredProfile,
} from '../utils/storageUtils';
import {
  mergeLogsConflictSafe,
  mergeProfilesConflictSafe,
  sanitizeLog,
  getTimestampMs,
  generateSecureToken,
} from '../utils/syncEngine';

export { mergeLogsConflictSafe, mergeProfilesConflictSafe, generateSecureToken };

export interface CloudSyncPayload {
  logs: DailyLog[];
  profile: UserProfile;
  updatedAt: string;
  version?: number;
}

export interface SyncPushResult {
  success: boolean;
  statusCode?: number;
  data?: {
    logs: DailyLog[];
    profile: UserProfile;
    updatedAt: string;
    version?: number;
  };
  error?: string;
  isAuthError?: boolean;
}

export interface FetchCloudResult {
  success: boolean;
  statusCode?: number;
  data?: CloudSyncPayload;
  error?: string;
  isAuthError?: boolean;
}

export function normalizeSyncCode(code: string): string {
  if (!code) return '';
  return code.trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

export function formatDisplayCode(code: string): string {
  const digits = normalizeSyncCode(code);
  if (digits.length === 6 && /^\d+$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return digits || code;
}

export function generateNumericSyncCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${Math.floor(num / 1000)}-${num % 1000}`;
}

export function mergeLogs(local: DailyLog[] = [], remote: DailyLog[] = []): DailyLog[] {
  return mergeLogsConflictSafe(local, remote);
}

export function mergeProfiles(local: UserProfile, remote?: UserProfile): UserProfile {
  return mergeProfilesConflictSafe(local, remote);
}

/**
 * Push data to canonical persistent database backend.
 * Returns success: true ONLY when persistent backend confirms write!
 */
export async function pushDataToCloud(
  syncCode: string,
  logs: DailyLog[],
  profile: UserProfile,
  overrideToken?: string
): Promise<SyncPushResult> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits) return { success: false, error: 'Mã kết nối không hợp lệ' };

  const sanitizedLogs = logs.map(l => sanitizeLog(l)).filter((l): l is DailyLog => l !== null);
  const syncToken = overrideToken || getStoredSyncToken();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-token': syncToken,
      },
      body: JSON.stringify({
        code: digits,
        logs: sanitizedLogs,
        profile,
        token: syncToken,
        updatedAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data && Array.isArray(json.data.logs)) {
        const canonicalLogs = json.data.logs.map((l: any) => sanitizeLog(l)).filter((l: DailyLog | null): l is DailyLog => l !== null);
        const canonicalProfile = json.data.profile || profile;

        saveLogsWithTombstones(canonicalLogs);
        saveProfile(canonicalProfile);
        saveLastSyncTime(new Date().toISOString());

        return {
          success: true,
          statusCode: res.status,
          data: {
            logs: canonicalLogs,
            profile: canonicalProfile,
            updatedAt: json.data.updatedAt || new Date().toISOString(),
            version: json.data.version,
          },
        };
      }
    }

    const isAuth = res.status === 401 || res.status === 403;
    let errorDetail = isAuth
      ? 'Thiết bị này chưa được ghép nối đúng. Hãy dùng Link đồng bộ có Token từ thiết bị chính (hoặc quét mã QR).'
      : 'Lỗi máy chủ khi đồng bộ';

    try {
      const errJson = await res.json();
      if (errJson && errJson.error) {
        errorDetail = isAuth
          ? 'Thiết bị này chưa được ghép nối đúng. Hãy dùng Link đồng bộ có Token từ thiết bị chính (hoặc quét mã QR).'
          : errJson.error;
      }
    } catch {}

    return {
      success: false,
      statusCode: res.status,
      isAuthError: isAuth,
      error: errorDetail,
    };
  } catch (err: any) {
    console.warn('Sync push network error:', err);
    return { success: false, error: err?.message || 'Lỗi mạng khi kết nối máy chủ' };
  }
}

/**
 * Fetch remote state from canonical persistent backend with detailed HTTP status inspection
 */
export async function fetchCloudDataDetailed(syncCode: string, overrideToken?: string): Promise<FetchCloudResult> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits) return { success: false, error: 'Mã không hợp lệ' };

  // Only use existing stored token or explicit overrideToken (never generate a random token for fetching existing space)
  const syncToken = overrideToken !== undefined ? overrideToken : (localStorage.getItem('nutrifit_sync_token_v1') || '');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`/api/sync?code=${encodeURIComponent(digits)}&token=${encodeURIComponent(syncToken)}&t=${Date.now()}`, {
      headers: { 'x-sync-token': syncToken },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data && Array.isArray(json.data.logs)) {
        const cleanLogs = json.data.logs.map((l: any) => sanitizeLog(l)).filter((l: DailyLog | null): l is DailyLog => l !== null);
        return {
          success: true,
          statusCode: res.status,
          data: {
            logs: cleanLogs,
            profile: json.data.profile || {},
            updatedAt: json.data.updatedAt || new Date().toISOString(),
            version: json.data.version,
          },
        };
      }
    }

    const isAuth = res.status === 401 || res.status === 403;
    let errorDetail = isAuth
      ? 'Thiết bị này chưa được ghép nối đúng. Hãy dùng Link đồng bộ có Token từ thiết bị chính (hoặc quét mã QR).'
      : 'Không thể tải dữ liệu từ Cloud';

    try {
      const errJson = await res.json();
      if (errJson && errJson.error) {
        errorDetail = isAuth
          ? 'Thiết bị này chưa được ghép nối đúng. Hãy dùng Link đồng bộ có Token từ thiết bị chính (hoặc quét mã QR).'
          : errJson.error;
      }
    } catch {}

    return {
      success: false,
      statusCode: res.status,
      isAuthError: isAuth,
      error: errorDetail,
    };
  } catch (err: any) {
    console.warn('/api/sync fetch error:', err);
    return {
      success: false,
      error: err?.message || 'Lỗi mạng khi tải dữ liệu Cloud',
    };
  }
}

export async function fetchCloudData(syncCode: string, overrideToken?: string): Promise<CloudSyncPayload | null> {
  const res = await fetchCloudDataDetailed(syncCode, overrideToken);
  return res.success && res.data ? res.data : null;
}

/**
 * Dedicated GET-ONLY Pull Function:
 * Strictly downloads canonical Cloud state and merges into LocalStorage.
 * NEVER performs any Cloud Push or upload!
 */
export async function pullFromCloud(
  syncCode: string,
  localLogs: DailyLog[],
  localProfile: UserProfile,
  overrideToken?: string
): Promise<{
  success: boolean;
  logs?: DailyLog[];
  profile?: UserProfile;
  lastSyncTime?: string;
  error?: string;
  isAuthError?: boolean;
}> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits) return { success: false, error: 'Mã kết nối không hợp lệ' };

  const fetchRes = await fetchCloudDataDetailed(digits, overrideToken);

  if (fetchRes.isAuthError || fetchRes.statusCode === 401 || fetchRes.statusCode === 403) {
    return {
      success: false,
      isAuthError: true,
      error: 'Thiết bị này chưa được ghép nối đúng. Hãy dùng Link đồng bộ có Token từ thiết bị chính (hoặc quét mã QR).',
    };
  }

  if (fetchRes.statusCode === 404 || !fetchRes.data) {
    return {
      success: false,
      error: 'Chưa có dữ liệu nào trên Cloud cho mã kết nối này.',
    };
  }

  if (!fetchRes.success || !fetchRes.data) {
    return {
      success: false,
      error: fetchRes.error || 'Lỗi kết nối máy chủ Cloud.',
    };
  }

  // GET-Only merge: Apply remote logs into local storage safely without any Push
  const mergedLogsAll = mergeLogsConflictSafe(localLogs, fetchRes.data.logs);
  const mergedProfile = mergeProfilesConflictSafe(localProfile, fetchRes.data.profile);

  saveLogsWithTombstones(mergedLogsAll);
  saveProfile(mergedProfile);
  const syncTime = fetchRes.data.updatedAt || new Date().toISOString();
  saveLastSyncTime(syncTime);

  return {
    success: true,
    logs: mergedLogsAll.filter(l => !l.deletedAt),
    profile: mergedProfile,
    lastSyncTime: syncTime,
  };
}

/**
 * Centralized Canonical Reconciliation Function:
 * Used for background sync and startup.
 * Reconciles local and remote state, pushes local newer edits, and only sets 'synced' on confirmed durable write!
 */
export async function reconcileWithCloud(
  syncCode: string,
  localLogs: DailyLog[],
  localProfile: UserProfile,
  overrideToken?: string
): Promise<{ logs: DailyLog[]; profile: UserProfile; status: SyncStatus; error?: string; isAuthError?: boolean }> {
  const digits = normalizeSyncCode(syncCode);
  if (!digits) {
    return {
      logs: localLogs.filter(l => !l.deletedAt),
      profile: localProfile,
      status: 'pending',
    };
  }

  try {
    const fetchRes = await fetchCloudDataDetailed(digits, overrideToken);

    if (fetchRes.isAuthError || fetchRes.statusCode === 401 || fetchRes.statusCode === 403) {
      return {
        logs: localLogs.filter(l => !l.deletedAt),
        profile: localProfile,
        status: 'error',
        isAuthError: true,
        error: 'Thiết bị này chưa được ghép nối đúng. Hãy dùng Link đồng bộ có Token từ thiết bị chính (hoặc quét mã QR).',
      };
    }

    if (fetchRes.statusCode === 404 || !fetchRes.data) {
      // Remote does not exist yet (brand new sync space) -> Push local initial state
      const pushRes = await pushDataToCloud(digits, localLogs, localProfile, overrideToken);
      if (pushRes.success && pushRes.data) {
        return {
          logs: pushRes.data.logs.filter(l => !l.deletedAt),
          profile: pushRes.data.profile,
          status: 'synced',
        };
      }
      return {
        logs: localLogs.filter(l => !l.deletedAt),
        profile: localProfile,
        status: 'pending',
        isAuthError: pushRes.isAuthError,
        error: pushRes.error,
      };
    }

    const remote = fetchRes.data;

    // Conflict-Safe Merge
    const mergedLogsAll = mergeLogsConflictSafe(localLogs, remote.logs);
    const mergedProfile = mergeProfilesConflictSafe(localProfile, remote.profile);

    // Save merged state locally
    saveLogsWithTombstones(mergedLogsAll);
    saveProfile(mergedProfile);

    // Detect if local has records or profile newer than remote
    const localHasNewerLogs = mergedLogsAll.some(m => {
      const remoteMatch = remote.logs.find(r => r.date === m.date);
      if (!remoteMatch) return true;
      return getTimestampMs(m.updatedAt) > getTimestampMs(remoteMatch.updatedAt);
    });
    const localHasNewerProfile = getTimestampMs(localProfile.updatedAt) > getTimestampMs(remote.profile?.updatedAt);
    const needsUpload = localHasNewerLogs || localHasNewerProfile;

    if (needsUpload) {
      const pushRes = await pushDataToCloud(digits, mergedLogsAll, mergedProfile, overrideToken);
      if (pushRes.success && pushRes.data) {
        return {
          logs: pushRes.data.logs.filter(l => !l.deletedAt),
          profile: pushRes.data.profile,
          status: 'synced',
        };
      } else {
        return {
          logs: mergedLogsAll.filter(l => !l.deletedAt),
          profile: mergedProfile,
          status: 'pending',
          isAuthError: pushRes.isAuthError,
          error: pushRes.error,
        };
      }
    }

    // Remote was up-to-date and local had no un-synced edits
    saveLastSyncTime(new Date().toISOString());
    return {
      logs: mergedLogsAll.filter(l => !l.deletedAt),
      profile: mergedProfile,
      status: 'synced',
    };
  } catch (err: any) {
    console.warn('Reconciliation error:', err);
    return {
      logs: localLogs.filter(l => !l.deletedAt),
      profile: localProfile,
      status: 'error',
      error: err?.message || 'Lỗi kết nối máy chủ',
    };
  }
}

export async function syncOnStartup(
  syncCode: string,
  localLogs: DailyLog[],
  localProfile: UserProfile
): Promise<{ logs: DailyLog[]; profile: UserProfile; status: SyncStatus }> {
  return reconcileWithCloud(syncCode, localLogs, localProfile);
}

/**
 * Subscribe to realtime Cloud sync updates via polling and visibility change with canonical reconciliation
 */
export function subscribeToCloudSync(
  syncCode: string,
  onReconciled: (result: { logs: DailyLog[]; profile: UserProfile; status: SyncStatus }) => void,
  pollIntervalMs = 15000
): () => void {
  const digits = normalizeSyncCode(syncCode);
  if (!digits) return () => {};

  let isSubscribed = true;

  const performSyncCheck = async () => {
    if (!isSubscribed) return;
    try {
      const currentLocal = getAllStoredLogsWithTombstones();
      const currentProfile = getStoredProfile();
      const result = await reconcileWithCloud(digits, currentLocal, currentProfile);
      if (isSubscribed) {
        onReconciled(result);
      }
    } catch {}
  };

  const intervalId = setInterval(performSyncCheck, pollIntervalMs);

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      performSyncCheck();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return () => {
    isSubscribed = false;
    clearInterval(intervalId);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
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
