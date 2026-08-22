import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/layout/Header';
import { BottomNav, TabType } from './components/layout/BottomNav';
import { PeriodFilter } from './components/common/PeriodFilter';
import { SummaryCards } from './components/dashboard/SummaryCards';
import { NutritionChart } from './components/charts/NutritionChart';
import { EnergyBalanceChart } from './components/charts/EnergyBalanceChart';
import { WorkoutChart } from './components/charts/WorkoutChart';
import { LogDataTable } from './components/table/LogDataTable';
import { DailyLogModal } from './components/forms/DailyLogModal';
import { DataManagementModal } from './components/settings/DataManagementModal';
import { CloudSyncModal } from './components/settings/CloudSyncModal';
import { ProfileView } from './components/profile/ProfileView';

import { DailyLog, PeriodType, DisplayMode, ChartCategory, CustomDateRange, UserProfile, Language } from './types/health';
import {
  getStoredLogs,
  upsertLog,
  deleteLog,
  resetToSampleData,
  clearAllLogs,
  saveLogs,
  getStoredProfile,
  saveProfile,
  getStoredLanguage,
  saveLanguage,
  getStoredSyncCode,
  saveSyncCode,
  clearSyncCode,
} from './utils/storageUtils';
import { filterLogsByPeriod, processChartData } from './utils/dateUtils';
import { getTranslation } from './utils/i18n';
import { format, subDays } from 'date-fns';
import { BarChart3, LineChart as LineChartIcon, Table as TableIcon, Database, Download } from 'lucide-react';
import { pushDataToCloud, subscribeToCloudSync, fetchCloudData, decodeDataFromBase64, formatDisplayCode } from './services/cloudSyncService';

import { USER_REAL_LOGS } from './utils/sampleData';

export function App() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile());
  const [language, setLanguage] = useState<Language>(getStoredLanguage());
  const [syncCode, setSyncCode] = useState<string>(getStoredSyncCode());

  const [period, setPeriod] = useState<PeriodType>('all');
  const [customRange, setCustomRange] = useState<CustomDateRange>({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('bar');
  const [chartCategory, setChartCategory] = useState<'all' | ChartCategory>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [isDataModalOpen, setIsDataModalOpen] = useState<boolean>(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  const t = getTranslation(language);

  // Load initial local data
  useEffect(() => {
    const loadedLogs = getStoredLogs();
    setLogs(loadedLogs);
    setProfile(getStoredProfile());
    setLanguage(getStoredLanguage());
  }, []);

  // Check URL query string for QR code or direct sync link (?sync=XXX-XXX&data=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const querySync = params.get('sync');
      const queryData = params.get('data') || params.get('d');

      if (queryData) {
        const decoded = decodeDataFromBase64(queryData);
        if (decoded && decoded.logs && decoded.logs.length > 0) {
          saveLogs(decoded.logs);
          setLogs(decoded.logs);
          if (decoded.profile) {
            saveProfile(decoded.profile);
            setProfile(decoded.profile);
          }
          if (querySync) {
            const clean = formatDisplayCode(querySync);
            saveSyncCode(clean);
            setSyncCode(clean);
          }
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
      }

      if (querySync) {
        const clean = formatDisplayCode(querySync);
        saveSyncCode(clean);
        setSyncCode(clean);
        fetchCloudData(clean).then(data => {
          if (data && data.logs && data.logs.length > 0) {
            saveLogs(data.logs);
            setLogs(data.logs);
            if (data.profile) {
              saveProfile(data.profile);
              setProfile(data.profile);
            }
          }
        });
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Subscribe to Realtime Cloud Sync when syncCode is set
  useEffect(() => {
    if (!syncCode) return;

    const unsubscribe = subscribeToCloudSync(syncCode, ({ logs: cloudLogs, profile: cloudProfile }) => {
      if (cloudLogs && Array.isArray(cloudLogs) && cloudLogs.length > 0) {
        saveLogs(cloudLogs);
        setLogs(cloudLogs);
      }
      if (cloudProfile) {
        saveProfile(cloudProfile);
        setProfile(cloudProfile);
      }
    });

    return () => unsubscribe();
  }, [syncCode]);

  // Helper to auto-push local updates to Cloud
  const autoPushCloud = (newLogs: DailyLog[], newProfile: UserProfile = profile) => {
    if (syncCode) {
      pushDataToCloud(syncCode, newLogs, newProfile);
    }
  };

  const filteredLogs = useMemo(() => {
    return filterLogsByPeriod(logs, period, customRange);
  }, [logs, period, customRange]);

  const chartData = useMemo(() => {
    return processChartData(filteredLogs);
  }, [filteredLogs]);

  const handleSaveLog = (logData: Omit<DailyLog, 'id'> & { id?: string }) => {
    const updated = upsertLog(logData);
    setLogs(updated);
    setEditingLog(null);
    autoPushCloud(updated, profile);
  };

  const handleDeleteLog = (id: string) => {
    const updated = deleteLog(id);
    setLogs(updated);
    autoPushCloud(updated, profile);
  };

  const handleQuickReset = () => {
    const resetLogs = resetToSampleData();
    setLogs(resetLogs);
    autoPushCloud(resetLogs, profile);
  };

  const handleClearAll = () => {
    const cleared = clearAllLogs();
    setLogs(cleared);
    autoPushCloud(cleared, profile);
  };

  const handleImportLogs = (imported: DailyLog[]) => {
    saveLogs(imported);
    setLogs(imported);
    autoPushCloud(imported, profile);
  };

  const handleSaveProfile = (updatedProfile: UserProfile) => {
    saveProfile(updatedProfile);
    setProfile(updatedProfile);
    autoPushCloud(logs, updatedProfile);
  };

  const handleChangeLanguage = (newLang: Language) => {
    saveLanguage(newLang);
    setLanguage(newLang);
  };

  const handleConnectSync = (code: string, cloudData?: { logs: DailyLog[]; profile: UserProfile }) => {
    saveSyncCode(code);
    setSyncCode(code);

    if (cloudData && cloudData.logs) {
      saveLogs(cloudData.logs);
      setLogs(cloudData.logs);
      if (cloudData.profile) {
        saveProfile(cloudData.profile);
        setProfile(cloudData.profile);
      }
    } else {
      pushDataToCloud(code, logs, profile);
    }
  };

  const handleDisconnectSync = () => {
    clearSyncCode();
    setSyncCode('');
  };

  const handleEditClick = (log: DailyLog) => {
    setEditingLog(log);
    setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingLog(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Mobile Header */}
      <Header
        logCount={logs.length}
        profile={profile}
        onOpenProfile={() => setActiveTab('profile')}
        language={language}
        onChangeLanguage={handleChangeLanguage}
        syncCode={syncCode}
        onOpenCloudSync={() => setIsSyncModalOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-xl mx-auto px-3.5 pt-4">
        {activeTab === 'profile' ? (
          /* Profile Tab */
          <ProfileView
            profile={profile}
            onSaveProfile={handleSaveProfile}
            language={language}
            onChangeLanguage={handleChangeLanguage}
            onOpenDataManagement={() => setIsDataModalOpen(true)}
          />
        ) : (
          <>
            {/* Period Filter Selection */}
            <PeriodFilter
              period={period}
              onChangePeriod={setPeriod}
              customRange={customRange}
              onChangeCustomRange={setCustomRange}
              language={language}
            />

            {/* Display Mode & Category Control Bar */}
            <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 mb-4 flex flex-wrap items-center justify-between gap-2">
              {/* Display Mode Selector (Bảng, Cột, Đường) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 px-2 uppercase">{t.displayTitle}</span>
                <button
                  onClick={() => setDisplayMode('bar')}
                  className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                    displayMode === 'bar'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>{t.modeBar}</span>
                </button>

                <button
                  onClick={() => setDisplayMode('line')}
                  className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                    displayMode === 'line'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LineChartIcon className="w-3.5 h-3.5" />
                  <span>{t.modeLine}</span>
                </button>

                <button
                  onClick={() => {
                    setDisplayMode('table');
                    setActiveTab('table');
                  }}
                  className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                    activeTab === 'table' || displayMode === 'table'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>{t.modeTable}</span>
                </button>
              </div>

              {/* Group Category Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full">
                <button
                  onClick={() => setChartCategory('all')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                    chartCategory === 'all'
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.catAll}
                </button>
                <button
                  onClick={() => setChartCategory('nutrition')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                    chartCategory === 'nutrition'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.catNutrition}
                </button>
                <button
                  onClick={() => setChartCategory('energy')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                    chartCategory === 'energy'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.catEnergy}
                </button>
                <button
                  onClick={() => setChartCategory('workout')}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                    chartCategory === 'workout'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.catWorkout}
                </button>
              </div>
            </div>

            {/* Dynamic Main View Content */}
            {activeTab === 'table' ? (
              /* Table View Tab */
              <LogDataTable
                logs={filteredLogs}
                onEdit={handleEditClick}
                onDelete={handleDeleteLog}
                language={language}
              />
            ) : (
              /* Dashboard & Charts Tab */
              <div className="space-y-4">
                {/* KPI Summary Cards */}
                <SummaryCards logs={filteredLogs} language={language} />

                {/* Group 1: Nutrition breakdown chart */}
                {(chartCategory === 'all' || chartCategory === 'nutrition') && (
                  <NutritionChart data={chartData} mode={displayMode === 'table' ? 'bar' : displayMode} language={language} />
                )}

                {/* Group 2: Calo-In vs Calo-Out (TDEE) chart */}
                {(chartCategory === 'all' || chartCategory === 'energy') && (
                  <EnergyBalanceChart data={chartData} mode={displayMode === 'table' ? 'bar' : displayMode} language={language} />
                )}

                {/* Group 3: Workout duration & calories burned chart */}
                {(chartCategory === 'all' || chartCategory === 'workout') && (
                  <WorkoutChart data={chartData} mode={displayMode === 'table' ? 'bar' : displayMode} language={language} />
                )}

                {/* Detailed Data Table inside Dashboard View */}
                <LogDataTable
                  logs={filteredLogs}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteLog}
                  language={language}
                />
              </div>
            )}

            {/* Data Management & Sync Footer Card */}
            <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 mt-4 mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span className="font-extrabold text-slate-800 text-xs">
                  {language === 'vi' ? 'Quản lý Dữ liệu App (Xuất CSV/JSON)' : 'App Data Management (CSV/JSON)'}
                </span>
              </div>
              <button
                onClick={() => setIsDataModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.navData}</span>
              </button>
            </div>
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'table') setDisplayMode('table');
        }}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        language={language}
      />

      {/* Daily Input/Edit Modal */}
      <DailyLogModal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveLog}
        initialLog={editingLog}
        language={language}
      />

      {/* Data Management Dialog */}
      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        logs={logs}
        onImportLogs={handleImportLogs}
        onResetSample={handleQuickReset}
        onClearAll={handleClearAll}
      />

      {/* Cloud Realtime Sync Dialog */}
      <CloudSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncCode={syncCode}
        onConnectSync={handleConnectSync}
        onDisconnectSync={handleDisconnectSync}
        logs={logs}
        profile={profile}
        language={language}
      />
    </div>
  );
}

export default App;
