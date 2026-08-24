import { DailyLog, UserGoals, UserProfile, Language } from '../types/health';
import { generateSampleData } from './sampleData';
import { sanitizeLog, isExactSampleLog, generateSecureToken } from './syncEngine';

export { sanitizeLog, isExactSampleLog, generateSecureToken };

const LOGS_STORAGE_KEY = 'nutrifit_daily_logs_v2';
const LEGACY_LOGS_KEY = 'nutrifit_daily_logs_v1';
const PROFILE_STORAGE_KEY = 'nutrifit_user_profile_v2';
const LEGACY_PROFILE_KEY = 'nutrifit_user_profile_v1';
const LANGUAGE_STORAGE_KEY = 'nutrifit_language_v1';
const SYNC_CODE_STORAGE_KEY = 'nutrifit_sync_code_v1';
const SYNC_TOKEN_STORAGE_KEY = 'nutrifit_sync_token_v1';
const DEVICE_ID_STORAGE_KEY = 'nutrifit_device_id_v1';
const LAST_SYNC_TIME_KEY = 'nutrifit_last_sync_time_v1';

export const DEFAULT_GOALS: UserGoals = {
  targetCaloIn: 2200,
  targetCaloOut: 2300,
  targetProtein: 140,
  targetCarbs: 230,
  targetFats: 60,
  targetFiber: 30,
  targetWorkoutMinutes: 45,
};

/**
 * Get or generate persistent unique device ID
 */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id = `dev-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'dev-fallback-unknown';
  }
}

/**
 * Get stored pairing secret token (256-bit high-entropy auth token)
 */
export function getStoredSyncToken(): string {
  try {
    let token = localStorage.getItem(SYNC_TOKEN_STORAGE_KEY);
    if (!token) {
      token = generateSecureToken();
      localStorage.setItem(SYNC_TOKEN_STORAGE_KEY, token);
    }
    return token;
  } catch {
    return generateSecureToken();
  }
}

export function saveSyncToken(token: string): void {
  try {
    localStorage.setItem(SYNC_TOKEN_STORAGE_KEY, token);
  } catch {}
}

/**
 * Get raw stored logs including tombstoned records with safe legacy migration
 */
export function getAllStoredLogsWithTombstones(): DailyLog[] {
  try {
    let raw = localStorage.getItem(LOGS_STORAGE_KEY);

    // Safe migration from v1 storage key if v2 not found
    if (raw === null) {
      const legacyRaw = localStorage.getItem(LEGACY_LOGS_KEY);
      if (legacyRaw !== null) {
        try {
          const parsedLegacy = JSON.parse(legacyRaw);
          if (Array.isArray(parsedLegacy)) {
            const migrated = parsedLegacy.map(legacyItem => {
              const isSample = isExactSampleLog(legacyItem);
              return sanitizeLog({
                ...legacyItem,
                timestampConfidence: isSample ? 'sample' : 'legacy_inferred',
                createdAt: legacyItem.createdAt || (isSample ? '1970-01-01T00:00:00.000Z' : '2026-08-20T00:00:00.000Z'),
                updatedAt: legacyItem.updatedAt || (isSample ? '1970-01-01T00:00:00.000Z' : '2026-08-20T00:00:00.000Z'),
                deletedAt: null,
              });
            }).filter((l): l is DailyLog => l !== null);

            localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(migrated));
            return migrated;
          }
        } catch {}
      }

      // If user has never had any storage key before (completely fresh install), seed initial sample data
      const initial = generateSampleData(10).map(l => sanitizeLog({
        ...l,
        timestampConfidence: 'sample',
        createdAt: '1970-01-01T00:00:00.000Z',
        updatedAt: '1970-01-01T00:00:00.000Z',
        deletedAt: null,
      })).filter((l): l is DailyLog => l !== null);

      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(sanitizeLog).filter((l): l is DailyLog => l !== null);
    }
    return [];
  } catch (err) {
    console.error('Error reading logs from LocalStorage', err);
    return [];
  }
}

/**
 * Get active non-deleted logs for UI display
 */
export function getStoredLogs(): DailyLog[] {
  const allLogs = getAllStoredLogsWithTombstones();
  return allLogs
    .filter(l => !l.deletedAt)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/**
 * Save full logs array (including tombstones) to LocalStorage
 */
export function saveLogsWithTombstones(logs: DailyLog[]): void {
  try {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const valid = safeLogs.map(sanitizeLog).filter((l): l is DailyLog => l !== null);
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(valid));
  } catch (err) {
    console.error('Error saving logs to LocalStorage', err);
  }
}

/**
 * Save active logs list while preserving existing tombstones in storage
 */
export function saveLogs(activeLogs: DailyLog[]): void {
  try {
    const existing = getAllStoredLogsWithTombstones();
    const tombstones = existing.filter(l => l.deletedAt);

    const map = new Map<string, DailyLog>();
    tombstones.forEach(t => map.set(t.date, t));
    activeLogs.forEach(a => map.set(a.date, a));

    saveLogsWithTombstones(Array.from(map.values()));
  } catch (err) {
    console.error('Error saving logs to LocalStorage', err);
  }
}

/**
 * Add or update a single daily log with authoritative updatedAt timestamp
 */
export function upsertLog(newLog: Omit<DailyLog, 'id'> & { id?: string }): DailyLog[] {
  const allLogs = getAllStoredLogsWithTombstones();
  const now = new Date().toISOString();
  const devId = getDeviceId();

  const existingIndex = allLogs.findIndex(l => l.date === newLog.date || (newLog.id && l.id === newLog.id));
  const finalId = newLog.id || `log-${newLog.date}-${Date.now().toString(36)}`;
  const createdAt = existingIndex >= 0 ? (allLogs[existingIndex].createdAt || now) : now;

  const fullLog: DailyLog = {
    ...newLog,
    id: finalId,
    createdAt,
    updatedAt: now,
    deletedAt: null,
    deviceId: devId,
    timestampConfidence: 'authoritative',
  };

  const sanitized = sanitizeLog(fullLog);
  if (!sanitized) return getStoredLogs();

  let updatedAll: DailyLog[];
  if (existingIndex >= 0) {
    updatedAll = [...allLogs];
    updatedAll[existingIndex] = sanitized;
  } else {
    updatedAll = [sanitized, ...allLogs];
  }

  saveLogsWithTombstones(updatedAll);
  return getStoredLogs();
}

/**
 * Safe multi-device deletion by applying tombstone (deletedAt)
 */
export function deleteLog(idOrDate: string): DailyLog[] {
  const allLogs = getAllStoredLogsWithTombstones();
  const now = new Date().toISOString();
  const devId = getDeviceId();

  const updatedAll = allLogs.map(l => {
    if (l.id === idOrDate || l.date === idOrDate) {
      return {
        ...l,
        updatedAt: now,
        deletedAt: now,
        deviceId: devId,
        timestampConfidence: 'authoritative' as const,
      };
    }
    return l;
  });

  saveLogsWithTombstones(updatedAll);
  return getStoredLogs();
}

export function resetToSampleData(): DailyLog[] {
  const samples = generateSampleData(8).map(l => sanitizeLog({
    ...l,
    timestampConfidence: 'sample',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
    deletedAt: null,
  })).filter((l): l is DailyLog => l !== null);

  saveLogsWithTombstones(samples);
  return samples;
}

export function clearAllLogs(): DailyLog[] {
  const now = new Date().toISOString();
  const existing = getAllStoredLogsWithTombstones();
  const tombstones = existing.map(l => ({
    ...l,
    updatedAt: now,
    deletedAt: now,
    deviceId: getDeviceId(),
    timestampConfidence: 'authoritative' as const,
  }));
  saveLogsWithTombstones(tombstones);
  return [];
}

export function getStoredProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY) || localStorage.getItem(LEGACY_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          name: parsed.name || 'Bảo Uyên',
          gender: parsed.gender || 'female',
          birthDate: parsed.birthDate || '1998-05-15',
          height: Number(parsed.height) || 162,
          weight: Number(parsed.weight) || 54,
          avatarUrl: parsed.avatarUrl,
          updatedAt: parsed.updatedAt || '2026-08-20T00:00:00.000Z',
          deviceId: parsed.deviceId,
        };
      }
    }
  } catch {}
  return {
    name: 'Bảo Uyên',
    gender: 'female',
    birthDate: '1998-05-15',
    height: 162,
    weight: 54,
    updatedAt: '2026-08-20T00:00:00.000Z',
  };
}

export function saveProfile(profile: UserProfile): void {
  try {
    const profileWithMeta: UserProfile = {
      ...profile,
      updatedAt: profile.updatedAt || new Date().toISOString(),
      deviceId: profile.deviceId || getDeviceId(),
    };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileWithMeta));
  } catch {}
}

export function getStoredLanguage(): Language {
  try {
    const lang = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (lang === 'en' || lang === 'vi') return lang;
  } catch {}
  return 'vi';
}

export function saveLanguage(lang: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {}
}

export function getStoredSyncCode(): string {
  try {
    return localStorage.getItem(SYNC_CODE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveSyncCode(code: string): void {
  try {
    localStorage.setItem(SYNC_CODE_STORAGE_KEY, code);
  } catch {}
}

export function clearSyncCode(): void {
  try {
    localStorage.removeItem(SYNC_CODE_STORAGE_KEY);
    localStorage.removeItem(SYNC_TOKEN_STORAGE_KEY);
  } catch {}
}

export function getLastSyncTime(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_TIME_KEY);
  } catch {
    return null;
  }
}

export function saveLastSyncTime(isoTime: string): void {
  try {
    localStorage.setItem(LAST_SYNC_TIME_KEY, isoTime);
  } catch {}
}

export function exportLogsToJSON(logs: DailyLog[]): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `nutrifit_logs_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportFullBackup(logs: DailyLog[], profile: UserProfile): void {
  const backupObj = {
    app: 'NutriFit',
    version: '4.0',
    exportDate: new Date().toISOString(),
    logs,
    profile,
  };
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `nutrifit_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importFullBackup(jsonStr: string): { logs?: DailyLog[]; profile?: UserProfile } | null {
  try {
    const parsed = JSON.parse(jsonStr);
    let logs: DailyLog[] = [];
    let profile: UserProfile | undefined = undefined;

    if (Array.isArray(parsed)) {
      logs = parsed;
    } else if (parsed && Array.isArray(parsed.logs)) {
      logs = parsed.logs;
      if (parsed.profile) profile = parsed.profile;
    }

    if (logs && logs.length > 0) {
      const sanitized = logs.map(l => sanitizeLog({
        ...l,
        timestampConfidence: 'authoritative',
        updatedAt: new Date().toISOString(),
      })).filter((l): l is DailyLog => l !== null);
      return { logs: sanitized, profile };
    }
    return null;
  } catch (err) {
    console.error('Error importing backup JSON:', err);
    return null;
  }
}

export function exportLogsToCSV(logs: DailyLog[]): void {
  const headers = ['Ngay', 'CaloIn', 'Protein(g)', 'Carbs(g)', 'Fats(g)', 'Fiber(g)', 'Tap(phut)', 'CaloTap', 'CaloOut(TDEE)', 'GhiChu'];
  const rows = logs.map(l => [
    l.date,
    l.caloIn,
    l.protein,
    l.carbs,
    l.fats,
    l.fiber,
    l.workoutDuration,
    l.workoutCalo,
    l.caloOut,
    `"${(l.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', encodeURI(csvContent));
  downloadAnchor.setAttribute('download', `nutrifit_logs_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
