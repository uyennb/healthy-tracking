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

import { DailyLog, PeriodType, DisplayMode, ChartCategory, CustomDateRange, UserProfile, Language, SyncStatus } from './types/health';
import {
  getStoredLogs,
  getAllStoredLogsWithTombstones,
  saveLogsWithTombstones,
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
  saveSyncToken,
  getLastSyncTime,
  saveLastSyncTime,
} from './utils/storageUtils';
import { filterLogsByPeriod, processChartData } from './utils/dateUtils';
import { getTranslation } from './utils/i18n';
import { format, subDays } from 'date-fns';
import { BarChart3, LineChart as LineChartIcon, Table as TableIcon, Database, Download } from 'lucide-react';
import {
  pushDataToCloud,
  subscribeToCloudSync,
  fetchCloudData,
  reconcileWithCloud,
  decodeDataFromBase64,
  decodeDataFromBase64Async,
  formatDisplayCode,
  mergeLogsConflictSafe,
  mergeProfilesConflictSafe,
} from './services/cloudSyncService';

export function App() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile());
  const [language, setLanguage] = useState<Language>(getStoredLanguage());
  const [syncCode, setSyncCode] = useState<string>(getStoredSyncCode());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(getLastSyncTime());

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

  const [toastMsg, setToastMsg] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const t = getTranslation(language);

  // 1. Initial Startup Flow: Read local storage first, then run canonical reconciliation if syncCode is set
  useEffect(() => {
    const loadedLogs = getStoredLogs();
    const storedProfile = getStoredProfile();
    setLogs(loadedLogs);
    setProfile(storedProfile);
    setLanguage(getStoredLanguage());

    const currentSyncCode = getStoredSyncCode();
    if (currentSyncCode) {
      setSyncStatus('syncing');
      reconcileWithCloud(currentSyncCode, getAllStoredLogsWithTombstones(), storedProfile).then(result => {
        setLogs(result.logs);
        setProfile(result.profile);
        setSyncStatus(result.status);
        if (result.status === 'synced') {
          const nowIso = new Date().toISOString();
          setLastSyncTime(nowIso);
          saveLastSyncTime(nowIso);
        }
      }).catch(() => {
        setSyncStatus('error');
      });
    } else {
      setSyncStatus('pending');
    }
  }, []);

  // 2. Realtime Background Sync Subscription with Reconciliation
  useEffect(() => {
    if (!syncCode) return;

    const unsubscribe = subscribeToCloudSync(syncCode, result => {
      setLogs(result.logs);
      setProfile(result.profile);
      setSyncStatus(result.status);
      if (result.status === 'synced') {
        const nowIso = new Date().toISOString();
        setLastSyncTime(nowIso);
        saveLastSyncTime(nowIso);
      }
    });

    return () => unsubscribe();
  }, [syncCode]);

  // 3. Check URL query string for direct 1-click sync link (?sync=XXX-XXX&token=...&d=PAYLOAD)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const querySync = params.get('sync');
      const queryToken = params.get('token');
      const queryData = params.get('data') || params.get('d');

      if (queryToken) {
        saveSyncToken(queryToken);
      }

      if (queryData) {
        const decoded = decodeDataFromBase64(queryData);
        if (decoded && decoded.logs && decoded.logs.length > 0) {
          const currentLocal = getAllStoredLogsWithTombstones();
          const mergedLogs = mergeLogsConflictSafe(currentLocal, decoded.logs);
          saveLogsWithTombstones(mergedLogs);
          setLogs(mergedLogs.filter(l => !l.deletedAt));

          const currentProfile = getStoredProfile();
          const mergedProf = mergeProfilesConflictSafe(currentProfile, decoded.profile);
          saveProfile(mergedProf);
          setProfile(mergedProf);

          if (querySync) {
            const clean = formatDisplayCode(querySync);
            saveSyncCode(clean);
            setSyncCode(clean);
            pushDataToCloud(clean, mergedLogs, mergedProf, queryToken || undefined);
          }
          showToast(language === 'vi' ? '✅ Đã đồng bộ 100% dữ liệu thành công!' : '✅ Synced 100% data successfully!');
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }

        decodeDataFromBase64Async(queryData).then(asyncDecoded => {
          if (asyncDecoded && asyncDecoded.logs && asyncDecoded.logs.length > 0) {
            const currentLocal = getAllStoredLogsWithTombstones();
            const mergedLogs = mergeLogsConflictSafe(currentLocal, asyncDecoded.logs);
            saveLogsWithTombstones(mergedLogs);
            setLogs(mergedLogs.filter(l => !l.deletedAt));

            const currentProfile = getStoredProfile();
            const mergedProf = mergeProfilesConflictSafe(currentProfile, asyncDecoded.profile);
            saveProfile(mergedProf);
            setProfile(mergedProf);

            if (querySync) {
              const clean = formatDisplayCode(querySync);
              saveSyncCode(clean);
              setSyncCode(clean);
              pushDataToCloud(clean, mergedLogs, mergedProf, queryToken || undefined);
            }
            showToast(language === 'vi' ? '✅ Đã đồng bộ 100% dữ liệu thành công!' : '✅ Synced 100% data successfully!');
            window.history.replaceState({}, '', window.location.pathname);
          }
        });
        return;
      }

      if (querySync) {
        const clean = formatDisplayCode(querySync);
        saveSyncCode(clean);
        setSyncCode(clean);
        setSyncStatus('syncing');
        reconcileWithCloud(clean, getAllStoredLogsWithTombstones(), getStoredProfile(), queryToken || undefined).then(result => {
          setLogs(result.logs);
          setProfile(result.profile);
          setSyncStatus(result.status);
          if (result.status === 'synced') {
            const nowIso = new Date().toISOString();
            setLastSyncTime(nowIso);
            saveLastSyncTime(nowIso);
          }
        });
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const filteredLogs = useMemo(() => {
    return filterLogsByPeriod(logs, period, customRange);
  }, [logs, period, customRange]);

  const chartData = useMemo(() => {
    return processChartData(filteredLogs);
  }, [filteredLogs]);

  // Handle Save (Add/Edit) Log: immediate local save with updatedAt, then server-side merge & canonical state reflection
  const handleSaveLog = (logData: Omit<DailyLog, 'id'> & { id?: string }) => {
    const updated = upsertLog(logData);
    setLogs(updated);
    setEditingLog(null);

    const dateFormatted = logData.date ? logData.date.split('-').reverse().join('/') : '';
    showToast(language === 'vi' ? `✅ Đã lưu nhật ký ngày ${dateFormatted} thành công!` : `✅ Saved daily log for ${dateFormatted}!`);

    if (syncCode) {
      setSyncStatus('syncing');
      pushDataToCloud(syncCode, getAllStoredLogsWithTombstones(), profile).then(res => {
        if (res.success && res.data) {
          setLogs(res.data.logs.filter(l => !l.deletedAt));
          setProfile(res.data.profile);
          setSyncStatus('synced');
          setLastSyncTime(res.data.updatedAt);
        } else {
          setSyncStatus('error');
        }
      }).catch(() => setSyncStatus('error'));
    }
  };

  // Handle Delete Log: immediate local tombstone with deletedAt, then cloud sync
  const handleDeleteLog = (id: string) => {
    const updated = deleteLog(id);
    setLogs(updated);

    if (syncCode) {
      setSyncStatus('syncing');
      pushDataToCloud(syncCode, getAllStoredLogsWithTombstones(), profile).then(res => {
        if (res.success && res.data) {
          setLogs(res.data.logs.filter(l => !l.deletedAt));
          setProfile(res.data.profile);
          setSyncStatus('synced');
          setLastSyncTime(res.data.updatedAt);
        } else {
          setSyncStatus('error');
        }
      }).catch(() => setSyncStatus('error'));
    }
  };

  const handleQuickReset = () => {
    const resetLogs = resetToSampleData();
    setLogs(resetLogs.filter(l => !l.deletedAt));
    if (syncCode) {
      pushDataToCloud(syncCode, getAllStoredLogsWithTombstones(), profile);
    }
  };

  const handleClearAll = () => {
    const cleared = clearAllLogs();
    setLogs(cleared);
    if (syncCode) {
      pushDataToCloud(syncCode, getAllStoredLogsWithTombstones(), profile);
    }
  };

  const handleImportLogs = (imported: DailyLog[], importedProfile?: UserProfile) => {
    const allStored = getAllStoredLogsWithTombstones();
    const merged = mergeLogsConflictSafe(allStored, imported);
    saveLogsWithTombstones(merged);
    setLogs(merged.filter(l => !l.deletedAt));

    if (importedProfile) {
      const mergedProf = mergeProfilesConflictSafe(profile, importedProfile);
      saveProfile(mergedProf);
      setProfile(mergedProf);
    }

    if (syncCode) {
      pushDataToCloud(syncCode, merged, importedProfile || profile);
    }
  };

  const handleSaveProfile = (updatedProfile: UserProfile) => {
    const profileWithMeta: UserProfile = {
      ...updatedProfile,
      updatedAt: new Date().toISOString(),
    };
    saveProfile(profileWithMeta);
    setProfile(profileWithMeta);
    if (syncCode) {
      setSyncStatus('syncing');
      pushDataToCloud(syncCode, getAllStoredLogsWithTombstones(), profileWithMeta).then(res => {
        if (res.success && res.data) {
          setProfile(res.data.profile);
          setSyncStatus('synced');
          setLastSyncTime(res.data.updatedAt);
        } else {
          setSyncStatus('error');
        }
      }).catch(() => setSyncStatus('error'));
    }
  };

  const handleChangeLanguage = (newLang: Language) => {
    saveLanguage(newLang);
    setLanguage(newLang);
  };

  const handleConnectSync = (code: string, cloudData?: { logs: DailyLog[]; profile: UserProfile }) => {
    saveSyncCode(code);
    setSyncCode(code);

    if (cloudData && cloudData.logs && cloudData.logs.length > 0) {
      const currentLocal = getAllStoredLogsWithTombstones();
      const mergedLogs = mergeLogsConflictSafe(currentLocal, cloudData.logs);
      saveLogsWithTombstones(mergedLogs);
      setLogs(mergedLogs.filter(l => !l.deletedAt));

      const currentProfile = getStoredProfile();
      const mergedProf = mergeProfilesConflictSafe(currentProfile, cloudData.profile);
      saveProfile(mergedProf);
      setProfile(mergedProf);

      setSyncStatus('syncing');
      pushDataToCloud(code, mergedLogs, mergedProf).then(res => {
        if (res.success && res.data) {
          setLogs(res.data.logs.filter(l => !l.deletedAt));
          setProfile(res.data.profile);
          setSyncStatus('synced');
          setLastSyncTime(res.data.updatedAt);
        } else {
          setSyncStatus('pending');
        }
      });
    } else {
      setSyncStatus('syncing');
      reconcileWithCloud(code, getAllStoredLogsWithTombstones(), getStoredProfile()).then(result => {
        setLogs(result.logs);
        setProfile(result.profile);
        setSyncStatus(result.status);
        if (result.status === 'synced') {
          const nowIso = new Date().toISOString();
          setLastSyncTime(nowIso);
          saveLastSyncTime(nowIso);
        }
      });
    }
  };

  const handleDisconnectSync = () => {
    clearSyncCode();
    setSyncCode('');
    setSyncStatus('pending');
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
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-md text-emerald-400 font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-xl border border-emerald-500/30 animate-fadeIn flex items-center gap-2">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Mobile Header */}
      <Header
        logCount={logs.length}
        profile={profile}
        onOpenProfile={() => setActiveTab('profile')}
        language={language}
        onChangeLanguage={handleChangeLanguage}
        syncCode={syncCode}
        syncStatus={syncStatus}
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
            onOpenCloudSync={() => setIsSyncModalOpen(true)}
            syncCode={syncCode}
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

            {/* Metric Summary Cards */}
            <SummaryCards logs={filteredLogs} language={language} />

            {/* Display Mode Selection: Charts vs Table */}
            <div className="flex items-center justify-between mt-6 mb-3 px-1">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                {t.displayTitle}
              </span>

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-xs border border-slate-100">
                <button
                  onClick={() => setDisplayMode('bar')}
                  className={`p-1.5 rounded-lg transition ${
                    displayMode === 'bar'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title={t.modeBar}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDisplayMode('line')}
                  className={`p-1.5 rounded-lg transition ${
                    displayMode === 'line'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title={t.modeLine}
                >
                  <LineChartIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDisplayMode('table')}
                  className={`p-1.5 rounded-lg transition ${
                    displayMode === 'table'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title={t.modeTable}
                >
                  <TableIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Visual Charts or Log Data Table */}
            {displayMode === 'table' ? (
              <LogDataTable
                logs={filteredLogs}
                onEdit={handleEditClick}
                onDelete={handleDeleteLog}
                language={language}
              />
            ) : (
              <div className="space-y-4">
                {/* Category Filter for Charts */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    onClick={() => setChartCategory('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                      chartCategory === 'all'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    {t.catAll}
                  </button>
                  <button
                    onClick={() => setChartCategory('nutrition')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                      chartCategory === 'nutrition'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    {t.catNutrition}
                  </button>
                  <button
                    onClick={() => setChartCategory('energy')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                      chartCategory === 'energy'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    {t.catEnergy}
                  </button>
                  <button
                    onClick={() => setChartCategory('workout')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                      chartCategory === 'workout'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    {t.catWorkout}
                  </button>
                </div>

                {/* Render Selected Charts */}
                {(chartCategory === 'all' || chartCategory === 'nutrition') && (
                  <NutritionChart data={chartData} mode={displayMode} language={language} />
                )}
                {(chartCategory === 'all' || chartCategory === 'energy') && (
                  <EnergyBalanceChart data={chartData} mode={displayMode} language={language} />
                )}
                {(chartCategory === 'all' || chartCategory === 'workout') && (
                  <WorkoutChart data={chartData} mode={displayMode} language={language} />
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenAddModal={() => {
          setEditingLog(null);
          setIsAddModalOpen(true);
        }}
        language={language}
      />

      {/* Add / Edit Daily Log Modal */}
      <DailyLogModal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveLog}
        initialLog={editingLog}
        language={language}
      />

      {/* Data Management Modal (Export/Import/Reset) */}
      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        logs={logs}
        onImportLogs={handleImportLogs}
        onResetSample={handleQuickReset}
        onClearAll={handleClearAll}
      />

      {/* Multi-Device Realtime Cloud Sync Modal */}
      <CloudSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncCode={syncCode}
        syncStatus={syncStatus}
        lastSyncTime={lastSyncTime}
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
