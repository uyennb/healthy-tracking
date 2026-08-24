import { DailyLog, UserProfile } from '../types/health';
import { USER_REAL_LOGS } from './sampleData';

/**
 * Generate a cryptographically secure 256-bit (32 bytes) high-entropy token
 */
export function generateSecureToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  // Node.js fallback
  try {
    const nodeCrypto = require('crypto');
    return nodeCrypto.randomBytes(32).toString('hex');
  } catch {
    const arr = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

export function getTimestampMs(isoString?: string | null): number {
  if (!isoString) return 0;
  const parsed = new Date(isoString).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Check if a log matches the untouched default sample data template
 */
export function isExactSampleLog(log: any): boolean {
  if (!log || typeof log !== 'object') return false;
  if (log.timestampConfidence === 'sample') return true;

  const sampleMatch = USER_REAL_LOGS.find(s => s.date === log.date);
  if (!sampleMatch) return false;

  // Compare key values to verify if it is untouched default sample data
  const isMatch = (
    Number(log.caloIn) === sampleMatch.caloIn &&
    Number(log.caloOut) === sampleMatch.caloOut &&
    Number(log.protein) === sampleMatch.protein &&
    Number(log.carbs) === sampleMatch.carbs &&
    Number(log.fats) === sampleMatch.fats &&
    Number(log.workoutDuration) === sampleMatch.workoutDuration &&
    String(log.note || '') === String(sampleMatch.note || '')
  );

  return isMatch;
}

/**
 * Robust sanitizer for DailyLog with timestamp confidence tracking
 */
export function sanitizeLog(log: any): DailyLog | null {
  if (!log || typeof log !== 'object') return null;
  const date = String(log.date || '').trim();
  if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) return null;

  const isSample = isExactSampleLog(log);
  let confidence: 'authoritative' | 'legacy_inferred' | 'sample' = log.timestampConfidence;

  if (!confidence) {
    if (isSample) {
      confidence = 'sample';
    } else if (log.updatedAt && log.updatedAt !== '1970-01-01T00:00:00.000Z' && log.updatedAt !== '2026-08-20T00:00:00.000Z') {
      confidence = 'authoritative';
    } else {
      confidence = 'legacy_inferred';
    }
  }

  const baselineTime = confidence === 'sample' 
    ? '1970-01-01T00:00:00.000Z' 
    : (confidence === 'legacy_inferred' ? '2026-08-20T00:00:00.000Z' : new Date().toISOString());

  const createdAt = log.createdAt && typeof log.createdAt === 'string' ? log.createdAt : baselineTime;
  const updatedAt = log.updatedAt && typeof log.updatedAt === 'string' ? log.updatedAt : createdAt;
  const deletedAt = log.deletedAt && typeof log.deletedAt === 'string' ? log.deletedAt : null;
  const deviceId = log.deviceId && typeof log.deviceId === 'string' ? log.deviceId : undefined;

  return {
    id: String(log.id || `log-${date}-${Math.random().toString(36).substring(2, 7)}`),
    date,
    caloIn: Math.max(0, Number(log.caloIn) || 0),
    caloOut: Math.max(0, Number(log.caloOut) || 0),
    protein: Math.max(0, Number(log.protein) || 0),
    carbs: Math.max(0, Number(log.carbs) || 0),
    fats: Math.max(0, Number(log.fats) || 0),
    fiber: Math.max(0, Number(log.fiber) || 0),
    workoutDuration: Math.max(0, Number(log.workoutDuration) || 0),
    workoutCalo: Math.max(0, Number(log.workoutCalo) || 0),
    note: String(log.note || ''),
    createdAt,
    updatedAt,
    deletedAt,
    deviceId,
    timestampConfidence: confidence,
  };
}

/**
 * Confidence rank: authoritative (3) > legacy_inferred (2) > sample (1)
 */
function getConfidenceScore(confidence?: string): number {
  if (confidence === 'authoritative') return 3;
  if (confidence === 'legacy_inferred') return 2;
  return 1;
}

/**
 * Merge two conflicting legacy records where neither has an authoritative timestamp.
 * Deterministically combines custom user data to avoid silent loss.
 */
export function mergeConflictingLegacyLogs(logA: DailyLog, logB: DailyLog): DailyLog {
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

/**
 * Conflict-Safe Log Merge based on confidence levels and updatedAt timestamps.
 */
export function mergeLogsConflictSafe(local: DailyLog[] = [], remote: DailyLog[] = []): DailyLog[] {
  const safeLocal = (Array.isArray(local) ? local : []).map(sanitizeLog).filter((l): l is DailyLog => l !== null);
  const safeRemote = (Array.isArray(remote) ? remote : []).map(sanitizeLog).filter((l): l is DailyLog => l !== null);

  const map = new Map<string, DailyLog>();

  // Add all local records
  safeLocal.forEach(localLog => {
    map.set(localLog.date, localLog);
  });

  // Merge remote records against local records
  safeRemote.forEach(remoteLog => {
    const existing = map.get(remoteLog.date);
    if (!existing) {
      map.set(remoteLog.date, remoteLog);
      return;
    }

    const localScore = getConfidenceScore(existing.timestampConfidence);
    const remoteScore = getConfidenceScore(remoteLog.timestampConfidence);

    // Rule 1: Higher confidence score wins (e.g. customized user data beats sample template)
    if (remoteScore > localScore) {
      map.set(remoteLog.date, remoteLog);
      return;
    }
    if (localScore > remoteScore) {
      return; // Keep existing local
    }

    // Rule 2: If same confidence score, compare updatedAt timestamps
    const localUpdatedMs = getTimestampMs(existing.updatedAt || existing.createdAt);
    const remoteUpdatedMs = getTimestampMs(remoteLog.updatedAt || remoteLog.createdAt);

    if (remoteUpdatedMs > localUpdatedMs) {
      map.set(remoteLog.date, remoteLog);
    } else if (remoteUpdatedMs < localUpdatedMs) {
      // Local is strictly newer -> keep existing
    } else {
      // Rule 3: Tie-breaker with identical timestamps
      if (remoteLog.deletedAt && !existing.deletedAt) {
        map.set(remoteLog.date, remoteLog);
      } else if (!remoteLog.deletedAt && existing.deletedAt) {
        // Keep existing tombstone
      } else if (existing.timestampConfidence === 'legacy_inferred' && remoteLog.timestampConfidence === 'legacy_inferred') {
        // Both are legacy inferred with conflicting custom data -> safe field-level merge
        map.set(remoteLog.date, mergeConflictingLegacyLogs(existing, remoteLog));
      } else {
        // Deterministic field merge
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
      updatedAt: '2026-08-20T00:00:00.000Z',
    };
  }
  if (!remote) return local!;
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
