import React from 'react';
import { Edit2, Trash2, Calendar, Zap } from 'lucide-react';
import { DailyLog, Language } from '../../types/health';
import { formatDateLang, calculateSummary, formatWorkoutDurationHMS } from '../../utils/dateUtils';
import { getTranslation } from '../../utils/i18n';

interface LogDataTableProps {
  logs: DailyLog[];
  onEdit: (log: DailyLog) => void;
  onDelete: (id: string) => void;
  language?: Language;
}

export const LogDataTable: React.FC<LogDataTableProps> = ({
  logs,
  onEdit,
  onDelete,
  language = 'vi',
}) => {
  const t = getTranslation(language);
  const summary = calculateSummary(logs);

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-100 shadow-sm">
        <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
        <p className="text-sm font-semibold text-slate-600">{t.tableEmpty}</p>
        <p className="text-xs text-slate-400 mt-1">{t.tableEmptySub}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
      <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-slate-800 text-sm">{t.tableTitle}</h3>
          <p className="text-[11px] text-slate-400 font-medium">
            {t.tableSubtitle.replace('{count}', String(logs.length))}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
              <th className="py-3 px-3 min-w-[110px]">{t.tableDate}</th>
              <th className="py-3 px-2 text-right text-indigo-700 min-w-[85px]">{t.tableCaloIn}</th>
              <th className="py-3 px-2 text-right text-blue-700 min-w-[70px]">{t.tableProtein}</th>
              <th className="py-3 px-2 text-right text-amber-700 min-w-[70px]">{t.tableCarbs}</th>
              <th className="py-3 px-2 text-right text-pink-700 min-w-[65px]">{t.tableFats}</th>
              <th className="py-3 px-2 text-right text-emerald-700 min-w-[65px]">{t.tableFiber}</th>
              <th className="py-3 px-2 text-right text-purple-700 min-w-[80px]">{t.tableWorkoutMin}</th>
              <th className="py-3 px-2 text-right text-cyan-700 min-w-[80px]">{t.tableWorkoutCalo}</th>
              <th className="py-3 px-2 text-right text-rose-700 min-w-[85px]">{t.tableTDEE}</th>
              <th className="py-3 px-2 text-right min-w-[85px]">{t.tableNetDeficit}</th>
              <th className="py-3 px-3 text-center min-w-[80px]">{t.tableActions}</th>
            </tr>
          </thead>

          {/* Average Row */}
          <tbody className="bg-emerald-50/50 font-bold border-b-2 border-emerald-200 text-slate-800">
            <tr>
              <td className="py-2.5 px-3 text-emerald-800 flex items-center gap-1 font-extrabold">
                <Zap className="w-3.5 h-3.5 text-emerald-600" /> {t.average}
              </td>
              <td className="py-2.5 px-2 text-right text-indigo-700">{summary.avgCaloIn}</td>
              <td className="py-2.5 px-2 text-right text-blue-700">{summary.avgProtein}g</td>
              <td className="py-2.5 px-2 text-right text-amber-700">{summary.avgCarbs}g</td>
              <td className="py-2.5 px-2 text-right text-pink-700">{summary.avgFats}g</td>
              <td className="py-2.5 px-2 text-right text-emerald-700">{summary.avgFiber}g</td>
              <td className="py-2.5 px-2 text-right text-purple-700 font-mono">{formatWorkoutDurationHMS(summary.avgWorkoutDuration)}</td>
              <td className="py-2.5 px-2 text-right text-cyan-700">{summary.avgWorkoutCalo}</td>
              <td className="py-2.5 px-2 text-right text-rose-700">{summary.avgCaloOut}</td>
              <td className={`py-2.5 px-2 text-right font-black ${summary.avgDeficit <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {summary.avgDeficit <= 0 ? `-${Math.abs(summary.avgDeficit)}` : `+${summary.avgDeficit}`}
              </td>
              <td className="py-2.5 px-3 text-center text-slate-400 text-[10px]">-</td>
            </tr>
          </tbody>

          {/* Log Rows */}
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {logs.map((log) => {
              const deficit = log.caloIn - log.caloOut;
              return (
                <tr key={log.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                    {formatDateLang(log.date, language)}
                    {log.note && <span className="block text-[10px] text-slate-400 truncate max-w-[120px]">{log.note}</span>}
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-indigo-600">{log.caloIn.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</td>
                  <td className="py-2.5 px-2 text-right font-medium text-blue-600">{log.protein}g</td>
                  <td className="py-2.5 px-2 text-right font-medium text-amber-600">{log.carbs}g</td>
                  <td className="py-2.5 px-2 text-right font-medium text-pink-600">{log.fats}g</td>
                  <td className="py-2.5 px-2 text-right font-medium text-emerald-600">{log.fiber}g</td>
                  <td className="py-2.5 px-2 text-right font-bold text-purple-600 font-mono">{formatWorkoutDurationHMS(log.workoutDuration)}</td>
                  <td className="py-2.5 px-2 text-right font-medium text-cyan-600">{log.workoutCalo}</td>
                  <td className="py-2.5 px-2 text-right font-bold text-rose-600">{log.caloOut.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</td>
                  <td className={`py-2.5 px-2 text-right font-extrabold ${deficit <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {deficit <= 0 ? `-${Math.abs(deficit)}` : `+${deficit}`}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onEdit(log)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                        title={t.editTooltip}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(t.confirmDelete)) {
                            onDelete(log.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title={t.deleteTooltip}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
