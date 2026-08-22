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

const REAL_DATA_MIGRATION_KEY = 'nutrifit_migrated_v6_clean';

export function getStoredLogs(): DailyLog[] {
  try {
    const isMigrated = localStorage.getItem(REAL_DATA_MIGRATION_KEY);
    if (!isMigrated) {
      const realLogs = generateSampleData(8);
      saveLogs(realLogs);
      localStorage.setItem(REAL_DATA_MIGRATION_KEY, 'true');
      return realLogs;
    }

    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) {
      const realLogs = generateSampleData(8);
      saveLogs(realLogs);
      return realLogs;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.sort((a: DailyLog, b: DailyLog) => b.date.localeCompare(a.date));
    }
    const realLogs = generateSampleData(8);
    saveLogs(realLogs);
    return realLogs;
  } catch (err) {
    console.error('Error reading logs from LocalStorage', err);
    return generateSampleData(8);
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
  const samples = generateSampleData(8);
  saveLogs(samples);
  return samples;
}

export function clearAllLogs(): DailyLog[] {
  saveLogs([]);
  return [];
}

export function getStoredProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    name: 'Bảo Uyên',
    gender: 'female',
    birthDate: '1998-05-15',
    height: 162,
    weight: 54,
  };
}

export function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
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
