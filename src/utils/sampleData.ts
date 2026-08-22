import { DailyLog } from '../types/health';
import { format, subDays } from 'date-fns';

export function generateSampleData(days: number = 60): DailyLog[] {
  const logs: DailyLog[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const targetDate = subDays(today, i);
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    
    // Create subtle realistic fluctuations
    const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
    const baseCalo = isWeekend ? 2350 : 2100;
    const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    const workoutDuration = Math.random() > 0.15 ? rand(30, 75) : 0;
    const workoutCalo = workoutDuration > 0 ? Math.round(workoutDuration * rand(6, 9)) : 0;
    const caloIn = baseCalo + rand(-150, 250);
    const caloOut = 2150 + (workoutCalo > 0 ? workoutCalo + rand(50, 150) : rand(-50, 50));

    logs.push({
      id: `sample-${dateStr}`,
      date: dateStr,
      caloIn,
      protein: rand(110, 165),
      carbs: rand(190, 280),
      fats: rand(45, 75),
      fiber: rand(20, 38),
      workoutDuration,
      workoutCalo,
      caloOut,
      note: isWeekend ? 'Cuối tuần ăn nhẹ nhàng & đi dạo' : 'Tập gym & chạy bộ',
    });
  }

  return logs;
}
