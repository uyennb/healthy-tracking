import { DailyLog } from '../types/health';

export const USER_REAL_LOGS: DailyLog[] = [
  {
    id: 'log-2026-08-21',
    date: '2026-08-21',
    caloIn: 1250,
    protein: 75,
    carbs: 120,
    fats: 55,
    fiber: 15,
    workoutDuration: 2387, // 39:47
    workoutCalo: 77,
    caloOut: 1325,
    note: 'Strength Trainer',
  },
  {
    id: 'log-2026-08-20',
    date: '2026-08-20',
    caloIn: 1248,
    protein: 72,
    carbs: 115,
    fats: 59,
    fiber: 15,
    workoutDuration: 1271, // 21:11
    workoutCalo: 228,
    caloOut: 1642,
    note: 'Running',
  },
  {
    id: 'log-2026-08-19',
    date: '2026-08-19',
    caloIn: 1135,
    protein: 65,
    carbs: 105,
    fats: 53,
    fiber: 11,
    workoutDuration: 6002, // 1:40:02
    workoutCalo: 142,
    caloOut: 1353,
    note: 'Strength Trainer + Dance',
  },
  {
    id: 'log-2026-08-18',
    date: '2026-08-18',
    caloIn: 1332,
    protein: 82,
    carbs: 136,
    fats: 53,
    fiber: 21,
    workoutDuration: 2937, // 48:57
    workoutCalo: 117,
    caloOut: 1350,
    note: 'Strength Trainer',
  },
  {
    id: 'log-2026-08-17',
    date: '2026-08-17',
    caloIn: 1179,
    protein: 66,
    carbs: 78,
    fats: 69,
    fiber: 11,
    workoutDuration: 6251, // 1:44:11
    workoutCalo: 96,
    caloOut: 1246,
    note: 'Walking + Dance',
  },
  {
    id: 'log-2026-08-16',
    date: '2026-08-16',
    caloIn: 1406,
    protein: 77,
    carbs: 139,
    fats: 60,
    fiber: 22,
    workoutDuration: 3662, // 1:01:02
    workoutCalo: 239,
    caloOut: 1472,
    note: 'Strength Trainer',
  },
  {
    id: 'log-2026-08-15',
    date: '2026-08-15',
    caloIn: 2080,
    protein: 151,
    carbs: 138,
    fats: 92,
    fiber: 11,
    workoutDuration: 1770, // 29:30
    workoutCalo: 47,
    caloOut: 1299,
    note: 'Walking',
  },
  {
    id: 'log-2026-08-14',
    date: '2026-08-14',
    caloIn: 1470,
    protein: 99,
    carbs: 172,
    fats: 39,
    fiber: 21,
    workoutDuration: 3234, // 53:54
    workoutCalo: 100,
    caloOut: 1308,
    note: 'Strength Trainer + Yoga',
  },
];

export function generateSampleData(days = 8): DailyLog[] {
  return [...USER_REAL_LOGS];
}
