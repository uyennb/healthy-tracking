import React from 'react';
import { Calendar, Filter } from 'lucide-react';
import { PeriodType, CustomDateRange, Language } from '../../types/health';
import { getTranslation } from '../../utils/i18n';

interface PeriodFilterProps {
  period: PeriodType;
  onChangePeriod: (period: PeriodType) => void;
  customRange: CustomDateRange;
  onChangeCustomRange: (range: CustomDateRange) => void;
  language?: Language;
}

export const PeriodFilter: React.FC<PeriodFilterProps> = ({
  period,
  onChangePeriod,
  customRange,
  onChangeCustomRange,
  language = 'vi',
}) => {
  const t = getTranslation(language);

  const periods: { id: PeriodType; label: string }[] = [
    { id: 'all', label: t.periodAll },
    { id: 'week', label: t.periodWeek },
    { id: 'month', label: t.periodMonth },
    { id: 'quarter', label: t.periodQuarter },
    { id: 'year', label: t.periodYear },
    { id: 'custom', label: t.periodCustom },
  ];

  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t.periodTitle}</span>
        </div>
        {period !== 'custom' && (
          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
            {t.autoUpdate}
          </span>
        )}
      </div>

      {/* Period Selector Tabs - 6 columns including 'All Time' */}
      <div className="grid grid-cols-6 gap-1 bg-slate-100/80 p-1 rounded-xl">
        {periods.map(p => (
          <button
            key={p.id}
            onClick={() => onChangePeriod(p.id)}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all text-center truncate ${
              period === p.id
                ? 'bg-white text-emerald-700 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 animate-fadeIn">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-600" /> {t.fromDate}
            </label>
            <input
              type="date"
              value={customRange.startDate}
              onChange={e => onChangeCustomRange({ ...customRange, startDate: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-600" /> {t.toDate}
            </label>
            <input
              type="date"
              value={customRange.endDate}
              onChange={e => onChangeCustomRange({ ...customRange, endDate: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
