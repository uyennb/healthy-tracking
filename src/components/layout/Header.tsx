import React from 'react';
import { formatDisplayCode } from '../../services/cloudSyncService';
import { Flame, User, Cloud, Zap, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserProfile, Language, SyncStatus } from '../../types/health';
import { getTranslation } from '../../utils/i18n';

interface HeaderProps {
  logCount: number;
  profile: UserProfile;
  onOpenProfile: () => void;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  syncCode?: string;
  syncStatus?: SyncStatus;
  onOpenCloudSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  onOpenProfile,
  language,
  onChangeLanguage,
  syncCode,
  syncStatus = 'synced',
  onOpenCloudSync,
}) => {
  const t = getTranslation(language);

  const getSyncButtonStyles = () => {
    if (!syncCode) {
      return 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-teal-500/25 hover:opacity-95';
    }
    switch (syncStatus) {
      case 'syncing':
        return 'bg-amber-500 text-white shadow-amber-500/25 hover:bg-amber-600';
      case 'error':
        return 'bg-rose-500 text-white shadow-rose-500/25 hover:bg-rose-600';
      case 'pending':
        return 'bg-slate-700 text-white shadow-slate-700/25 hover:bg-slate-800';
      case 'synced':
      default:
        return 'bg-emerald-500 text-white shadow-emerald-500/25 hover:bg-emerald-600';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Logo & Title - ONLY NutriFit */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-black text-xl">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="font-extrabold text-slate-800 text-xl tracking-tight leading-none">
            NutriFit
          </h1>
        </div>

        {/* Quick Actions - Cloud Sync, Language Toggle & Profile Avatar */}
        <div className="flex items-center gap-2">
          {/* Cloud Realtime Sync Status Button - ALWAYS VISIBLE */}
          {onOpenCloudSync && (
            <button
              onClick={onOpenCloudSync}
              className={`flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl transition active:scale-95 shadow-sm ${getSyncButtonStyles()}`}
              title="Đồng bộ Đám mây / Cloud Sync"
            >
              {syncCode ? (
                <>
                  {syncStatus === 'syncing' && <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
                  {syncStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  {syncStatus === 'synced' && <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300 animate-pulse flex-shrink-0" />}
                  {syncStatus === 'pending' && <Cloud className="w-3.5 h-3.5 text-slate-200 flex-shrink-0" />}
                  <span className="font-mono text-xs font-black tracking-wider">{formatDisplayCode(syncCode)}</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-white flex-shrink-0" />
                  <span className="text-xs font-black whitespace-nowrap">Sync Cloud</span>
                </>
              )}
            </button>
          )}

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
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold overflow-hidden">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                profile.name ? profile.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />
              )}
            </div>
            <span className="hidden sm:inline text-xs font-bold max-w-[90px] truncate">{profile.name || t.navProfile}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
