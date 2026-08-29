import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { DisplayMode, AggregatedData, Language } from '../../types/health';
import { getTranslation } from '../../utils/i18n';
import { formatWorkoutDurationHMS } from '../../utils/dateUtils';

interface WorkoutChartProps {
  data: AggregatedData[];
  mode: DisplayMode;
  language?: Language;
}

export const WorkoutChart: React.FC<WorkoutChartProps> = ({ data, mode, language = 'vi' }) => {
  const t = getTranslation(language);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        {t.tableEmpty}
      </div>
    );
  }

  const chartData = data.map(d => {
    let totalSeconds = Number(d.workoutDuration) || 0;
    if (totalSeconds <= 300 && Number.isInteger(totalSeconds)) {
      totalSeconds = totalSeconds * 60;
    }
    const minutes = Math.round(totalSeconds / 60);
    return {
      ...d,
      workoutMinutes: minutes,
      rawWorkoutSeconds: totalSeconds,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700/50">
          <p className="font-bold text-slate-300 mb-1.5 border-b border-slate-700/80 pb-1">{label}</p>
          <div className="space-y-1 font-medium">
            {payload.map((p: any, i: number) => {
              let displayVal = `${p.value} kcal`;
              if (p.dataKey === 'workoutMinutes') {
                const rawSec = p.payload.rawWorkoutSeconds ?? (p.value * 60);
                displayVal = `${p.value} ${language === 'vi' ? 'phút' : 'min'} (${formatWorkoutDurationHMS(rawSec)})`;
              }
              return (
                <div key={i} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5" style={{ color: p.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}:
                  </span>
                  <span className="font-extrabold">
                    {displayVal}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const minUnit = language === 'vi' ? ' p' : ' m';

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-extrabold text-slate-800 text-sm">
            {t.chartWorkoutTitle}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">
            {t.chartWorkoutSub}
          </p>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis yAxisId="left" unit={minUnit} tick={{ fontSize: 10, fill: '#8b5cf6' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" unit=" kcal" tick={{ fontSize: 10, fill: '#06b6d4' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              <Bar yAxisId="left" dataKey="workoutMinutes" name={t.legendWorkoutDuration} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="workoutCalo" name={t.legendWorkoutCalo} fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis yAxisId="left" unit={minUnit} tick={{ fontSize: 10, fill: '#8b5cf6' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" unit=" kcal" tick={{ fontSize: 10, fill: '#06b6d4' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              <Line yAxisId="left" type="monotone" dataKey="workoutMinutes" name={t.legendWorkoutDuration} stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="workoutCalo" name={t.legendWorkoutCalo} stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
