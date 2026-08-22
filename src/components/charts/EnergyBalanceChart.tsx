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

interface EnergyBalanceChartProps {
  data: AggregatedData[];
  mode: DisplayMode;
}

export const EnergyBalanceChart: React.FC<EnergyBalanceChartProps> = ({ data, mode }) => {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        Không có dữ liệu trong khoảng thời gian đã chọn
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const caloIn = payload.find((p: any) => p.dataKey === 'caloIn')?.value || 0;
      const caloOut = payload.find((p: any) => p.dataKey === 'caloOut')?.value || 0;
      const diff = caloIn - caloOut;

      return (
        <div className="bg-slate-900/90 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700/50">
          <p className="font-bold text-slate-300 mb-1.5 border-b border-slate-700/80 pb-1">{label}</p>
          <div className="space-y-1 font-medium">
            <div className="flex items-center justify-between gap-4">
              <span className="text-indigo-400">Calo Nạp Vẫn (Calo-In):</span>
              <span className="font-extrabold">{caloIn.toLocaleString('vi-VN')} kcal</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-rose-400">Calo Tiêu Thụ (TDEE):</span>
              <span className="font-extrabold">{caloOut.toLocaleString('vi-VN')} kcal</span>
            </div>
            <div className="pt-1.5 border-t border-slate-700/80 flex items-center justify-between gap-4">
              <span>Chênh lệch (Net):</span>
              <span className={`font-black ${diff <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {diff <= 0 ? `Thâm hụt ${Math.abs(diff)} kcal` : `Dư thừa +${diff} kcal`}
              </span>
            </div>
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
            Biểu Đồ So Sánh Calo-In vs Calo-Out (TDEE)
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">
            Theo dõi sự cân bằng năng lượng và mức thâm hụt calo hàng ngày
          </p>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis unit=" kcal" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              <Bar dataKey="caloIn" name="Calo Nạp Vẫn (In)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="caloOut" name="Calo Tiêu Thụ (TDEE Out)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis unit=" kcal" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
              <Line type="monotone" dataKey="caloIn" name="Calo Nạp Vẫn (In)" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="caloOut" name="Calo Tiêu Thụ (TDEE Out)" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
