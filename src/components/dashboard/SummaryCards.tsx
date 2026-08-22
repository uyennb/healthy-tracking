import React from 'react';
import { Flame, Zap, Dumbbell, ShieldCheck, Scale } from 'lucide-react';
import { MetricCard } from '../common/MetricCard';
import { calculateSummary, formatWorkoutDurationHMS } from '../../utils/dateUtils';
import { DailyLog, Language } from '../../types/health';
import { getTranslation } from '../../utils/i18n';

interface SummaryCardsProps {
  logs: DailyLog[];
  language?: Language;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ logs, language = 'vi' }) => {
  const t = getTranslation(language);
  const summary = calculateSummary(logs);

  const isDeficit = summary.avgDeficit <= 0;
  const deficitText = isDeficit
    ? t.deficitText.replace('{amount}', String(Math.abs(summary.avgDeficit)))
    : t.surplusText.replace('{amount}', String(summary.avgDeficit));

  const numLoc = language === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <div className="space-y-3 mb-5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {t.avgPeriod} ({summary.totalDays} {language === 'vi' ? 'ngày' : 'days'})
        </h2>
        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
          {isDeficit ? t.fatLossBadge : t.muscleGainBadge}
        </span>
      </div>

      {/* Row 1: Calo In vs Calo Out */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          title={t.avgCaloIn}
          value={summary.avgCaloIn.toLocaleString(numLoc)}
          unit={`${t.unitKcal}/${language === 'vi' ? 'ngày' : 'day'}`}
          icon={Zap}
          iconBgColor="bg-indigo-50"
          iconColor="text-indigo-600"
        />

        <MetricCard
          title={t.avgCaloOut}
          value={summary.avgCaloOut.toLocaleString(numLoc)}
          unit={`${t.unitKcal}/${language === 'vi' ? 'ngày' : 'day'}`}
          icon={Flame}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
        />
      </div>

      {/* Row 2: Deficit & Workout */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          title={t.netBalance}
          value={deficitText}
          subtitle={language === 'vi' ? 'Calo-In trừ TDEE' : 'Calo-In minus TDEE'}
          icon={Scale}
          iconBgColor={isDeficit ? 'bg-emerald-50' : 'bg-amber-50'}
          iconColor={isDeficit ? 'text-emerald-600' : 'text-amber-600'}
          badge={{
            text: isDeficit ? t.deficitLabel : t.surplusLabel,
            type: isDeficit ? 'positive' : 'negative',
          }}
        />

        <MetricCard
          title={t.workoutTotal}
          value={formatWorkoutDurationHMS(summary.totalWorkoutDuration)}
          unit=""
          subtitle={`${language === 'vi' ? 'Đốt ~' : 'Burned ~'}${summary.totalWorkoutCalo.toLocaleString(numLoc)} ${t.unitKcal}`}
          icon={Dumbbell}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Row 3: Macro Nutrients breakdown cards */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            {t.avgNutrients}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-blue-50/70 p-2 rounded-xl border border-blue-100">
            <span className="block text-[10px] font-bold text-blue-700">Protein</span>
            <span className="text-base font-extrabold text-blue-600">{summary.avgProtein}g</span>
          </div>

          <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100">
            <span className="block text-[10px] font-bold text-amber-700">Carbs</span>
            <span className="text-base font-extrabold text-amber-600">{summary.avgCarbs}g</span>
          </div>

          <div className="bg-pink-50/70 p-2 rounded-xl border border-pink-100">
            <span className="block text-[10px] font-bold text-pink-700">Fats</span>
            <span className="text-base font-extrabold text-pink-600">{summary.avgFats}g</span>
          </div>

          <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
            <span className="block text-[10px] font-bold text-emerald-700">Fiber</span>
            <span className="text-base font-extrabold text-emerald-600">{summary.avgFiber}g</span>
          </div>
        </div>
      </div>
    </div>
  );
};
