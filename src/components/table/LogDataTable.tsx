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

      <div className="log-table-wrapper overflow-x-auto w-full">
        <table className="log-table w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
              <th className="log-col-date py-2.5 sm:py-3 px-2 sm:px-3 min-w-[95px] whitespace-nowrap">{t.tableDate}</th>
              <th className="log-col-caloin py-2.5 sm:py-3 px-1.5 sm:px-2 text-right text-indigo-700 min-w-[65px] whitespace-nowrap">{t.tableCaloIn}</th>
              <th className="log-col-protein py-2.5 sm:py-3 px-1.5 sm:px-2 text-right text-blue-700 min-w-[55px] whitespace-nowrap">{t.tableProtein}</th>
              <th className="log-col-carbs py-2.5 sm:py-3 px-1.5 sm:px-2 text-right text-amber-700 min-w-[55px] whitespace-nowrap">{t.tableCarbs}</th>
              <th className="log-col-fats py-2.5 sm:py-3 px-1.5 sm:px-2 text-right text-pink-700 min-w-[52px] whitespace-nowrap">{t.tableFats}</th>
              <th className="log-col-fiber py-2.5 sm:py-3 px-1.5 sm:px-2 text-right text-emerald-700 min-w-[52px] whitespace-nowrap">{t.tableFiber}</th>
              <th className="log-col-workout py-2.5 sm:py-3 px-1.5 sm:px-2 text-right text-purple-700 min-w-[62px] whitespace-nowrap">{t.tableWorkoutMin}</th>
              <th className="log-col-burn py-2.5 sm:py-3 px-1.5 sm:px-2 text-right text-cyan-700 min-w-[55px] whitespace-nowrap">{t.tableWorkoutCalo}</th>
              <th className="log-col-tdee py-2.5 sm:py-3 px-1.5 sm:px-2 text-right text-rose-700 min-w-[65px] whitespace-nowrap">{t.tableTDEE}</th>
              <th className="log-col-deficit py-2.5 sm:py-3 px-1.5 sm:px-2 text-right min-w-[65px] whitespace-nowrap">{t.tableNetDeficit}</th>
              <th className="log-col-actions py-2.5 sm:py-3 px-2 sm:px-3 text-center min-w-[55px] whitespace-nowrap">{t.tableActions}</th>
            </tr>
          </thead>

          {/* Average Row */}
          <tbody className="bg-emerald-50/50 font-bold border-b-2 border-emerald-200 text-slate-800">
            <tr>
              <td className="log-col-date py-2 sm:py-2.5 px-2 sm:px-3 text-emerald-800 font-extrabold whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{t.average}</span>
                </div>
              </td>
              <td className="log-col-caloin py-2 sm:py-2.5 px-1.5 sm:px-2 text-right text-indigo-700">{summary.avgCaloIn}</td>
              <td className="log-col-protein py-2 sm:py-2.5 px-1.5 sm:px-2 text-right text-blue-700">{summary.avgProtein}g</td>
              <td className="log-col-carbs py-2 sm:py-2.5 px-1.5 sm:px-2 text-right text-amber-700">{summary.avgCarbs}g</td>
              <td className="log-col-fats py-2 sm:py-2.5 px-1.5 sm:px-2 text-right text-pink-700">{summary.avgFats}g</td>
              <td className="log-col-fiber py-2 sm:py-2.5 px-1.5 sm:px-2 text-right text-emerald-700">{summary.avgFiber}g</td>
              <td className="log-col-workout py-2 sm:py-2.5 px-1.5 sm:px-2 text-right text-purple-700 font-mono">{formatWorkoutDurationHMS(summary.avgWorkoutDuration)}</td>
              <td className="log-col-burn py-2 sm:py-2.5 px-1.5 sm:px-2 text-right text-cyan-700">{summary.avgWorkoutCalo}</td>
              <td className="log-col-tdee py-2 sm:py-2.5 px-1.5 sm:px-2 text-right text-rose-700">{summary.avgCaloOut}</td>
              <td className={`log-col-deficit py-2 sm:py-2.5 px-1.5 sm:px-2 text-right font-black ${summary.avgDeficit <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {summary.avgDeficit <= 0 ? `-${Math.abs(summary.avgDeficit)}` : `+${summary.avgDeficit}`}
              </td>
              <td className="log-col-actions py-2 sm:py-2.5 px-2 sm:px-3 text-center text-slate-400 text-[10px]">-</td>
            </tr>
          </tbody>

          {/* Log Rows */}
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {logs.map((log) => {
              const deficit = log.caloIn - log.caloOut;
              return (
                <tr key={log.id} className="hover:bg-slate-50/80 transition">
                  <td className="log-col-date py-2 sm:py-2.5 px-2 sm:px-3 font-semibold text-slate-800 whitespace-nowrap">
                    <div>{formatDateLang(log.date, language)}</div>
                    {log.note && <span className="log-date-note block text-[10px] text-slate-400 truncate max-w-[120px]">{log.note}</span>}
                  </td>
                  <td className="log-col-caloin py-2 sm:py-2.5 px-1.5 sm:px-2 text-right font-bold text-indigo-600">{log.caloIn.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</td>
                  <td className="log-col-protein py-2 sm:py-2.5 px-1.5 sm:px-2 text-right font-medium text-blue-600">{log.protein}g</td>
                  <td className="log-col-carbs py-2 sm:py-2.5 px-1.5 sm:px-2 text-right font-medium text-amber-600">{log.carbs}g</td>
                  <td className="log-col-fats py-2 sm:py-2.5 px-1.5 sm:px-2 text-right font-medium text-pink-600">{log.fats}g</td>
                  <td className="log-col-fiber py-2 sm:py-2.5 px-1.5 sm:px-2 text-right font-medium text-emerald-600">{log.fiber}g</td>
                  <td className="log-col-workout py-2 sm:py-2.5 px-1.5 sm:px-2 text-right font-bold text-purple-600 font-mono">{formatWorkoutDurationHMS(log.workoutDuration)}</td>
                  <td className="log-col-burn py-2 sm:py-2.5 px-1.5 sm:px-2 text-right font-medium text-cyan-600">{log.workoutCalo}</td>
                  <td className="log-col-tdee py-2 sm:py-2.5 px-1.5 sm:px-2 text-right font-bold text-rose-600">{log.caloOut.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</td>
                  <td className={`log-col-deficit py-2 sm:py-2.5 px-1.5 sm:px-2 text-right font-extrabold ${deficit <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {deficit <= 0 ? `-${Math.abs(deficit)}` : `+${deficit}`}
                  </td>
                  <td className="log-col-actions py-2 sm:py-2.5 px-2 sm:px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                      <button
                        onClick={() => onEdit(log)}
                        className="log-action-btn p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                        title={t.editTooltip}
                      >
                        <Edit2 className="log-action-icon w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(t.confirmDelete)) {
                            onDelete(log.id);
                          }
                        }}
                        className="log-action-btn p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title={t.deleteTooltip}
                      >
                        <Trash2 className="log-action-icon w-3.5 h-3.5" />
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
