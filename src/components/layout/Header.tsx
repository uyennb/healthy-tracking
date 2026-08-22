import React from 'react';
import { RefreshCw, ArrowUpDown, Flame, User, Globe } from 'lucide-react';
import { UserProfile, Language } from '../../types/health';
import { getTranslation } from '../../utils/i18n';

interface HeaderProps {
  onOpenDataManagement: () => void;
  onQuickReset: () => void;
  logCount: number;
  profile: UserProfile;
  onOpenProfile: () => void;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenDataManagement,
  onQuickReset,
  logCount,
  profile,
  onOpenProfile,
  language,
  onChangeLanguage,
}) => {
  const t = getTranslation(language);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-black text-xl">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-800 text-lg tracking-tight leading-none flex items-center gap-1.5">
              NutriFit <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">Mobile</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              {t.appSubtitle} ({logCount} {language === 'vi' ? 'ngày' : 'days'})
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Language Switcher Quick Button */}
          <button
            onClick={() => onChangeLanguage(language === 'vi' ? 'en' : 'vi')}
            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95"
            title="Chuyển đổi ngôn ngữ / Switch language"
          >
            <span>{language === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}</span>
          </button>

          {/* Profile Quick Button / Avatar */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition active:scale-95"
            title={t.profileTitle}
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold overflow-hidden">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                profile.name ? profile.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />
              )}
            </div>
            <span className="hidden sm:inline text-xs font-bold max-w-[80px] truncate">{profile.name || t.navProfile}</span>
          </button>

          {/* Data Backup */}
          <button
            onClick={onOpenDataManagement}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95"
            title={t.navData}
          >
            <ArrowUpDown className="w-4 h-4 text-slate-600" />
          </button>

          {/* Quick Reset */}
          <button
            onClick={() => {
              if (window.confirm(t.confirmReset)) {
                onQuickReset();
              }
            }}
            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition active:scale-95"
            title="Nạp lại dữ liệu mẫu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
