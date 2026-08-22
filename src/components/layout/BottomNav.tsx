import React from 'react';
import { LayoutDashboard, BarChart3, Table, User, PlusCircle } from 'lucide-react';
import { Language } from '../../types/health';
import { getTranslation } from '../../utils/i18n';

export type TabType = 'dashboard' | 'charts' | 'table' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onOpenAddModal: () => void;
  language: Language;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenAddModal,
  language,
}) => {
  const t = getTranslation(language);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] px-3 py-2">
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {/* Dashboard tab */}
        <button
          onClick={() => onChangeTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 transition-all duration-200 ${
            activeTab === 'dashboard'
              ? 'text-emerald-600 font-bold scale-105'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">{t.navOverview}</span>
        </button>

        {/* Charts tab */}
        <button
          onClick={() => onChangeTab('charts')}
          className={`flex flex-col items-center gap-0.5 transition-all duration-200 ${
            activeTab === 'charts'
              ? 'text-emerald-600 font-bold scale-105'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px]">{t.navCharts}</span>
        </button>

        {/* Floating Add Log Button */}
        <button
          onClick={onOpenAddModal}
          className="-mt-5 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white p-3 rounded-full shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center group"
          title={t.addLogTitle}
        >
          <PlusCircle className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* Table tab */}
        <button
          onClick={() => onChangeTab('table')}
          className={`flex flex-col items-center gap-0.5 transition-all duration-200 ${
            activeTab === 'table'
              ? 'text-emerald-600 font-bold scale-105'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Table className="w-5 h-5" />
          <span className="text-[10px]">{t.navTable}</span>
        </button>

        {/* Profile tab */}
        <button
          onClick={() => onChangeTab('profile')}
          className={`flex flex-col items-center gap-0.5 transition-all duration-200 ${
            activeTab === 'profile'
              ? 'text-emerald-600 font-bold scale-105'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px]">{t.navProfile}</span>
        </button>
      </div>
    </div>
  );
};
