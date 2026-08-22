import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  badge?: {
    text: string;
    type?: 'positive' | 'negative' | 'neutral';
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-emerald-50',
  iconColor = 'text-emerald-600',
  badge,
}) => {
  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl ${iconBgColor} ${iconColor} flex items-center justify-center flex-shrink-0 font-bold`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-500 line-clamp-1">{title}</span>
        </div>

        {badge && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              badge.type === 'positive'
                ? 'bg-emerald-100 text-emerald-700'
                : badge.type === 'negative'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-extrabold text-slate-800 tracking-tight">{value}</span>
          {unit && <span className="text-xs font-semibold text-slate-400">{unit}</span>}
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{subtitle}</p>}
      </div>
    </div>
  );
};
