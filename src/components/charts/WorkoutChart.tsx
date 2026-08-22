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
import { DisplayMode, AggregatedData } from '../../types/health';

interface WorkoutChartProps {
  data: AggregatedData[];
  mode: DisplayMode;
}

export const WorkoutChart: React.FC<WorkoutChartProps> = ({ data, mode }) => {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        Không có dữ liệu trong khoảng thời gian đã chọn
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700/50">
          <p className="font-bold text-slate-300 mb-1.5 border-b border-slate-700/80 pb-1">{label}</p>
          <div className="space-y-1 font-medium">
            {payload.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5" style={{ color: p.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}:
                </span>
                <span className="font-extrabold">
                  {p.value} {p.dataKey === 'workoutDuration' ? 'phút' : 'kcal'}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-extrabold text-slate-800 text-sm">
            Biểu Đồ Theo Dõi Luyện Tập
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">
            Thời gian luyện tập (phút - trục trái) & Calo đốt bài tập (kcal - trục phải)
          </p>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis yAxisId="left" unit=" p" tick={{ fontSize: 10, fill: '#8b5cf6' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" unit=" kcal" tick={{ fontSize: 10, fill: '#06b6d4' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              <Bar yAxisId="left" dataKey="workoutDuration" name="Thời gian tập (phút)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="workoutCalo" name="Calo bài tập (kcal)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis yAxisId="left" unit=" p" tick={{ fontSize: 10, fill: '#8b5cf6' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" unit=" kcal" tick={{ fontSize: 10, fill: '#06b6d4' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              <Line yAxisId="left" type="monotone" dataKey="workoutDuration" name="Thời gian tập (phút)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="workoutCalo" name="Calo bài tập (kcal)" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
