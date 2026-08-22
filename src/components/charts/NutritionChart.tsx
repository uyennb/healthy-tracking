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

interface NutritionChartProps {
  data: AggregatedData[];
  mode: DisplayMode;
}

export const NutritionChart: React.FC<NutritionChartProps> = ({ data, mode }) => {
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
                <span className="font-extrabold">{p.value} g</span>
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
            Biểu Đồ So Sánh Các Chất Dinh Dưỡng
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">
            Protein (Đạm), Carbs (Tinh bột), Fats (Chất béo), Fiber (Chất xơ)
          </p>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis unit="g" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              <Bar dataKey="protein" name="Protein" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="carbs" name="Carbs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="fats" name="Fats" fill="#ec4899" radius={[4, 4, 0, 0]} />
              <Bar dataKey="fiber" name="Fiber" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis unit="g" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              <Line type="monotone" dataKey="protein" name="Protein" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="carbs" name="Carbs" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="fats" name="Fats" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="fiber" name="Fiber" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
