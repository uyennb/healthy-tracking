import { DailyLog, UserGoals, UserProfile, Language } from '../types/health';
import { generateSampleData } from './sampleData';

const LOGS_STORAGE_KEY = 'nutrifit_daily_logs_v1';
const GOALS_STORAGE_KEY = 'nutrifit_user_goals_v1';
const PROFILE_STORAGE_KEY = 'nutrifit_user_profile_v1';
const LANGUAGE_STORAGE_KEY = 'nutrifit_language_v1';
const SYNC_CODE_STORAGE_KEY = 'nutrifit_sync_code_v1';

export const DEFAULT_GOALS: UserGoals = {
  targetCaloIn: 2200,
  targetCaloOut: 2300,
  targetProtein: 140,
  targetCarbs: 230,
  targetFats: 60,
  targetFiber: 30,
  targetWorkoutMinutes: 45,
};

const REAL_DATA_MIGRATION_KEY = 'nutrifit_migrated_v3_real_8days';

export function getStoredLogs(): DailyLog[] {
  try {
    const isMigrated = localStorage.getItem(REAL_DATA_MIGRATION_KEY);
    if (!isMigrated) {
      const realLogs = generateSampleData(8);
      // Ensure 2026-08-22 is removed
      const cleanRealLogs = realLogs.filter(l => l.date !== '2026-08-22');
      saveLogs(cleanRealLogs);
      localStorage.setItem(REAL_DATA_MIGRATION_KEY, 'true');
      return cleanRealLogs;
    }

    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) {
      const realLogs = generateSampleData(8).filter(l => l.date !== '2026-08-22');
      saveLogs(realLogs);
      return realLogs;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Remove any sample 2026-08-22 log
      const filtered = parsed.filter((l: DailyLog) => l.date !== '2026-08-22');
      if (filtered.length !== parsed.length) {
        saveLogs(filtered);
      }
      return filtered.sort((a: DailyLog, b: DailyLog) => b.date.localeCompare(a.date));
    }
    const realLogs = generateSampleData(8).filter(l => l.date !== '2026-08-22');
    saveLogs(realLogs);
    return realLogs;
  } catch (err) {
    console.error('Error reading logs from LocalStorage', err);
    return generateSampleData(8).filter(l => l.date !== '2026-08-22');
  }
}

export function saveLogs(logs: DailyLog[]): void {
  try {
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(sorted));
  } catch (err) {
    console.error('Error saving logs to LocalStorage', err);
  }
}

export function upsertLog(newLog: Omit<DailyLog, 'id'> & { id?: string }): DailyLog[] {
  const currentLogs = getStoredLogs();
  const existingIndex = currentLogs.findIndex(l => l.date === newLog.date || (newLog.id && l.id === newLog.id));

  let updatedLogs: DailyLog[];
  const finalId = newLog.id || `log-${newLog.date}-${Date.now()}`;
  const fullLog: DailyLog = { ...newLog, id: finalId };

  if (existingIndex >= 0) {
    updatedLogs = [...currentLogs];
    updatedLogs[existingIndex] = fullLog;
  } else {
    updatedLogs = [fullLog, ...currentLogs];
  }

  saveLogs(updatedLogs);
  return getStoredLogs();
}

export function deleteLog(id: string): DailyLog[] {
  const currentLogs = getStoredLogs();
  const filtered = currentLogs.filter(l => l.id !== id);
  saveLogs(filtered);
  return getStoredLogs();
}

export function resetToSampleData(): DailyLog[] {
  const samples = generateSampleData(60);
  saveLogs(samples);
  return samples;
}

export function clearAllLogs(): DailyLog[] {
  saveLogs([]);
  return [];
}

// User Profile & Language Storage
export const DEFAULT_PROFILE: UserProfile = {
  name: 'Bảo Uyên',
  gender: 'female',
  birthDate: '1998-08-15',
  height: 165,
  weight: 54,
  avatarUrl: '',
};

export function getStoredProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Error saving profile', err);
  }
}

export function getStoredLanguage(): Language {
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
    return raw === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

export function saveLanguage(lang: Language): void {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

// Sync Code Storage
export function getStoredSyncCode(): string {
  try {
    return localStorage.getItem(SYNC_CODE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveSyncCode(code: string): void {
  try {
    localStorage.setItem(SYNC_CODE_STORAGE_KEY, code.trim());
  } catch (err) {
    console.error('Error saving sync code', err);
  }
}

export function clearSyncCode(): void {
  try {
    localStorage.removeItem(SYNC_CODE_STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing sync code', err);
  }
}

export function exportLogsToCSV(logs: DailyLog[]): void {
  const headers = ['Date', 'CaloIn', 'Protein(g)', 'Carbs(g)', 'Fats(g)', 'Fiber(g)', 'WorkoutDuration(min)', 'WorkoutCalo(kcal)', 'TDEE(kcal)', 'Notes'];
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

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `nutrifit-health-logs-${new Date().toISOString().slice(0, 10)}.csv`);
  link.click();
}

export function exportLogsToJSON(logs: DailyLog[]): void {
  const jsonContent = JSON.stringify(logs, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `nutrifit-backup-${new Date().toISOString().slice(0, 10)}.json`);
  link.click();
}
