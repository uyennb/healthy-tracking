import { 
  format, 
  parseISO, 
  isWithinInterval, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter, 
  startOfYear, 
  endOfYear,
  subDays,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import { DailyLog, PeriodType, CustomDateRange, AggregatedData, Language } from '../types/health';

/**
 * Filter logs based on period selection
 */
export function filterLogsByPeriod(
  logs: DailyLog[],
  period: PeriodType,
  customRange?: CustomDateRange,
  refDate: Date = new Date()
): DailyLog[] {
  const safeLogs = (Array.isArray(logs) ? logs : []).filter(l => l && typeof l === 'object' && l.date && typeof l.date === 'string');

  if (period === 'all') {
    return [...safeLogs].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  if (period === 'custom' && customRange?.startDate && customRange?.endDate) {
    let start: Date;
    let end: Date;
    try {
      start = startOfDay(parseISO(customRange.startDate));
      end = endOfDay(parseISO(customRange.endDate));
    } catch {
      return safeLogs;
    }
    return safeLogs.filter(log => {
      try {
        const d = parseISO(log.date);
        return !isNaN(d.getTime()) && isWithinInterval(d, { start, end });
      } catch {
        return false;
      }
    }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  let start: Date;
  let end: Date = endOfDay(refDate);

  switch (period) {
    case 'week':
      start = startOfDay(startOfWeek(refDate, { weekStartsOn: 1 }));
      end = endOfDay(endOfWeek(refDate, { weekStartsOn: 1 }));
      break;
    case 'month':
      start = startOfDay(startOfMonth(refDate));
      end = endOfDay(endOfMonth(refDate));
      break;
    case 'quarter':
      start = startOfDay(startOfQuarter(refDate));
      end = endOfDay(endOfQuarter(refDate));
      break;
    case 'year':
      start = startOfDay(startOfYear(refDate));
      end = endOfDay(endOfYear(refDate));
      break;
    default:
      start = startOfDay(subDays(refDate, 30));
      break;
  }

  return safeLogs.filter(log => {
    try {
      const d = parseISO(log.date);
      return !isNaN(d.getTime()) && isWithinInterval(d, { start, end });
    } catch {
      return false;
    }
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/**
 * Prepare data for display in charts or tables
 */
export function processChartData(logs: DailyLog[]): AggregatedData[] {
  const safeLogs = (Array.isArray(logs) ? logs : []).filter(l => l && typeof l === 'object' && l.date && typeof l.date === 'string');
  return safeLogs.map(log => {
    let label = log.date;
    try {
      const dateObj = parseISO(log.date);
      if (!isNaN(dateObj.getTime())) {
        label = format(dateObj, 'dd/MM');
      }
    } catch {}

    return {
      label,
      dateStr: log.date,
      caloIn: Number(log.caloIn) || 0,
      caloOut: Number(log.caloOut) || 0,
      deficit: (Number(log.caloIn) || 0) - (Number(log.caloOut) || 0),
      protein: Number(log.protein) || 0,
      carbs: Number(log.carbs) || 0,
      fats: Number(log.fats) || 0,
      fiber: Number(log.fiber) || 0,
      workoutDuration: Number(log.workoutDuration) || 0,
      workoutCalo: Number(log.workoutCalo) || 0,
      count: 1,
    };
  });
}

/**
 * Calculate totals and averages over filtered logs
 */
export function calculateSummary(logs: DailyLog[]) {
  if (logs.length === 0) {
    return {
      totalDays: 0,
      avgCaloIn: 0,
      avgCaloOut: 0,
      avgDeficit: 0,
      avgProtein: 0,
      avgCarbs: 0,
      avgFats: 0,
      avgFiber: 0,
      totalWorkoutDuration: 0,
      avgWorkoutDuration: 0,
      totalWorkoutCalo: 0,
      avgWorkoutCalo: 0,
    };
  }

  const count = logs.length;
  const sum = logs.reduce((acc, curr) => ({
    caloIn: acc.caloIn + curr.caloIn,
    caloOut: acc.caloOut + curr.caloOut,
    deficit: acc.deficit + (curr.caloIn - curr.caloOut),
    protein: acc.protein + curr.protein,
    carbs: acc.carbs + curr.carbs,
    fats: acc.fats + curr.fats,
    fiber: acc.fiber + curr.fiber,
    workoutDuration: acc.workoutDuration + curr.workoutDuration,
    workoutCalo: acc.workoutCalo + curr.workoutCalo,
  }), {
    caloIn: 0,
    caloOut: 0,
    deficit: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
    workoutDuration: 0,
    workoutCalo: 0,
  });

  return {
    totalDays: count,
    avgCaloIn: Math.round(sum.caloIn / count),
    avgCaloOut: Math.round(sum.caloOut / count),
    avgDeficit: Math.round(sum.deficit / count),
    avgProtein: Math.round(sum.protein / count),
    avgCarbs: Math.round(sum.carbs / count),
    avgFats: Math.round(sum.fats / count),
    avgFiber: Math.round(sum.fiber / count),
    totalWorkoutDuration: sum.workoutDuration,
    avgWorkoutDuration: Math.round(sum.workoutDuration / count),
    totalWorkoutCalo: sum.workoutCalo,
    avgWorkoutCalo: Math.round(sum.workoutCalo / count),
  };
}

export function formatDateLang(dateStr: string, lang: Language = 'vi'): string {
  try {
    const loc = lang === 'en' ? enUS : vi;
    return format(parseISO(dateStr), lang === 'en' ? 'dd/MM/yyyy (EEE)' : 'dd/MM/yyyy (EEEE)', { locale: loc });
  } catch {
    return dateStr;
  }
}

/**
 * Format workout duration seconds/minutes to HH:MM:SS or MM:SS format
 * Example: 6332 -> "1:45:32", 2730 -> "45:30"
 */
export function formatWorkoutDurationHMS(val: number): string {
  if (!val || val <= 0) return '0:00';

  let totalSeconds = val;
  // Backward compatibility: if val is <= 300 and integer, it was saved as minutes in older logs
  if (val <= 300 && Number.isInteger(val)) {
    totalSeconds = val * 60;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Convert hours, minutes, seconds into total seconds
 */
export function toTotalSeconds(h = 0, m = 0, s = 0): number {
  const safeH = Math.max(0, Number(h) || 0);
  const safeM = Math.max(0, Number(m) || 0);
  const safeS = Math.max(0, Number(s) || 0);
  return (safeH * 3600) + (safeM * 60) + safeS;
}

/**
 * Break total seconds into { hours, minutes, seconds }
 */
export function breakSeconds(val: number): { hours: number; minutes: number; seconds: number } {
  if (!val || val <= 0) return { hours: 0, minutes: 0, seconds: 0 };
  let totalSeconds = val;
  if (val <= 300 && Number.isInteger(val)) {
    totalSeconds = val * 60;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return { hours, minutes, seconds };
}
