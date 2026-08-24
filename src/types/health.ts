export interface DailyLog {
  id: string;
  date: string; // ISO format 'YYYY-MM-DD'
  caloIn: number; // kcal
  protein: number; // grams
  carbs: number; // grams
  fats: number; // grams
  fiber: number; // grams
  workoutDuration: number; // seconds
  workoutCalo: number; // kcal
  caloOut: number; // TDEE in kcal
  note?: string;
  createdAt?: string; // ISO 8601 format
  updatedAt?: string; // ISO 8601 format
  deletedAt?: string | null; // ISO 8601 format tombstone
  deviceId?: string;
  timestampConfidence?: 'authoritative' | 'legacy_inferred' | 'sample';
}

export type PeriodType = 'all' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export type DisplayMode = 'bar' | 'line' | 'table';

export type ChartCategory = 'nutrition' | 'energy' | 'workout';

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

export interface CustomDateRange {
  startDate: string;
  endDate: string;
}

export interface AggregatedData {
  label: string; // Date or range label
  dateStr: string;
  caloIn: number;
  caloOut: number;
  deficit: number; // caloIn - caloOut
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  workoutDuration: number;
  workoutCalo: number;
  count: number; // number of days included
}

export interface UserGoals {
  targetCaloIn: number;
  targetCaloOut: number;
  targetProtein: number;
  targetCarbs: number;
  targetFats: number;
  targetFiber: number;
  targetWorkoutMinutes: number;
}

export type Language = 'vi' | 'en';

export interface UserProfile {
  name: string;
  avatarUrl?: string;
  gender: 'male' | 'female' | 'other';
  birthDate: string; // YYYY-MM-DD
  height: number; // cm
  weight: number; // kg
  updatedAt?: string; // ISO 8601 format
  deviceId?: string;
}
