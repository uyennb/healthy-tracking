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
  eachDayOfInterval,
  isSameDay
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { DailyLog, PeriodType, CustomDateRange, AggregatedData } from '../types/health';

/**
 * Filter logs based on period selection
 */
export function filterLogsByPeriod(
  logs: DailyLog[],
  period: PeriodType,
  customRange?: CustomDateRange,
  refDate: Date = new Date()
): DailyLog[] {
  if (period === 'custom' && customRange?.startDate && customRange?.endDate) {
    const start = parseISO(customRange.startDate);
    const end = parseISO(customRange.endDate);
    return logs.filter(log => {
      const d = parseISO(log.date);
      return isWithinInterval(d, { start, end });
    }).sort((a, b) => a.date.localeCompare(b.date));
  }

  let start: Date;
  let end: Date = refDate;

  switch (period) {
    case 'week':
      start = startOfWeek(refDate, { weekStartsOn: 1 });
      end = endOfWeek(refDate, { weekStartsOn: 1 });
      break;
    case 'month':
      start = startOfMonth(refDate);
      end = endOfMonth(refDate);
      break;
    case 'quarter':
      start = startOfQuarter(refDate);
      end = endOfQuarter(refDate);
      break;
    case 'year':
      start = startOfYear(refDate);
      end = endOfYear(refDate);
      break;
    default:
      start = subDays(refDate, 7);
      break;
  }

  return logs.filter(log => {
    const d = parseISO(log.date);
    return isWithinInterval(d, { start, end });
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Prepare data for display in charts or tables
 */
export function processChartData(logs: DailyLog[]): AggregatedData[] {
  return logs.map(log => {
    const dateObj = parseISO(log.date);
    // Display label: e.g. "22/08" (chỉ ngày, tháng)
    const label = format(dateObj, 'dd/MM');
    return {
      label,
      dateStr: log.date,
      caloIn: log.caloIn,
      caloOut: log.caloOut,
      deficit: log.caloIn - log.caloOut,
      protein: log.protein,
      carbs: log.carbs,
      fats: log.fats,
      fiber: log.fiber,
      workoutDuration: log.workoutDuration,
      workoutCalo: log.workoutCalo,
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

import { enUS } from 'date-fns/locale';
import { Language } from '../types/health';

export function formatDateLang(dateStr: string, lang: Language = 'vi'): string {
  try {
    const loc = lang === 'en' ? enUS : vi;
    return format(parseISO(dateStr), lang === 'en' ? 'dd/MM/yyyy (EEE)' : 'dd/MM/yyyy (EEEE)', { locale: loc });
  } catch {
    return dateStr;
  }
}

