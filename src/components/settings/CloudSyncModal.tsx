import React, { useState } from 'react';
import { X, Cloud, CloudOff, Copy, Check, QrCode, RefreshCw, ArrowRight, ShieldCheck, Zap, Link, Download, Upload, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Language, DailyLog, UserProfile, SyncStatus } from '../../types/health';
import { getTranslation } from '../../utils/i18n';
import { exportFullBackup, importFullBackup, getAllStoredLogsWithTombstones, getStoredSyncToken, saveSyncToken, saveLogsWithTombstones, saveProfile } from '../../utils/storageUtils';
import {
  generateNumericSyncCode,
  formatDisplayCode,
  normalizeSyncCode,
  pushDataToCloud,
  pullFromCloud,
  fetchCloudDataDetailed,
  reconcileWithCloud,
  encodeDataToBase64,
  decodeDataFromBase64,
  decodeDataFromBase64Async,
} from '../../services/cloudSyncService';
import { generateSecureToken } from '../../utils/syncEngine';

export function copyToClipboard(text: string): boolean {
  if (!text) return false;
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();

    const range = document.createRange();
    range.selectNodeContents(textArea);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    textArea.setSelectionRange(0, 999999);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (err) {
    console.warn('execCommand copy failed:', err);
  }

  if (navigator.clipboard) {
    try {
      navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API error:', err);
    }
  }

  return false;
}

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncCode: string;
  onConnectSync: (code: string, cloudData?: { logs: DailyLog[]; profile: UserProfile }) => void;
  onDisconnectSync: () => void;
  logs: DailyLog[];
  profile: UserProfile;
  syncStatus?: SyncStatus;
  lastSyncTime?: string | null;
  language?: Language;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  syncCode,
  onConnectSync,
  onDisconnectSync,
  logs,
  profile,
  syncStatus = 'synced',
  lastSyncTime,
  language = 'vi',
}) => {
  const t = getTranslation(language);

  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [pulled, setPulled] = useState(false);
  
  // Independent loading states
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [showQR, setShowQR] = useState(false);

  const isVI = language === 'vi';
  const displayCode = formatDisplayCode(syncCode);
  const syncToken = getStoredSyncToken();
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const cleanUrl = displayCode ? `${currentUrl}?sync=${encodeURIComponent(displayCode)}&token=${encodeURIComponent(syncToken)}` : currentUrl;

  if (!isOpen) return null;

  const formatTimeStr = (isoString?: string | null) => {
    if (!isoString) return isVI ? 'Chưa đồng bộ' : 'Not synced yet';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  const handleManualPush = async () => {
    if (!syncCode) return;
    setIsPushing(true);
    setErrorMsg('');
    try {
      const allLogs = getAllStoredLogsWithTombstones();
      const res = await pushDataToCloud(syncCode, allLogs, profile);
      setIsPushing(false);
      if (res.success && res.data) {
        onConnectSync(syncCode, { logs: res.data.logs, profile: res.data.profile });
        setPushed(true);
        setTimeout(() => setPushed(false), 2500);
      } else {
        setErrorMsg(
          res.isAuthError
            ? (isVI
                ? 'Thiết bị này chưa được ghép nối đúng. Hãy dùng Link đồng bộ có Token từ thiết bị chính (hoặc quét mã QR).'
                : 'This device is not paired with the correct token. Please use the Sync Link with Token from your primary device.')
            : (res.error || (isVI ? 'Lỗi kết nối máy chủ Cloud.' : 'Cloud server error.'))
        );
      }
    } catch (err: any) {
      setIsPushing(false);
      setErrorMsg(err?.message || (isVI ? 'Lỗi kết nối máy chủ Cloud.' : 'Cloud server error.'));
    }
  };

  // GET-ONLY Pull Handler (Zero Push)
  const handleManualPull = async () => {
    if (!syncCode) return;
    setIsPulling(true);
    setErrorMsg('');
    try {
      const allLogs = getAllStoredLogsWithTombstones();
      const res = await pullFromCloud(syncCode, allLogs, profile);
      setIsPulling(false);
      if (res.success && res.logs) {
        onConnectSync(syncCode, { logs: res.logs, profile: res.profile || profile });
        setPulled(true);
        setTimeout(() => setPulled(false), 2500);
      } else {
        setErrorMsg(
          res.isAuthError
            ? (isVI
                ? 'Thiết bị này chưa được ghép nối đúng. Hãy dùng Link đồng bộ có Token từ thiết bị chính (hoặc quét mã QR).'
                : 'This device is not paired with the correct token. Please use the Sync Link with Token from your primary device.')
            : (res.error || (isVI ? 'Chưa tìm thấy dữ liệu trên Cloud cho mã kết nối này.' : 'No Cloud data found for this sync code.'))
        );
      }
    } catch (err: any) {
      setIsPulling(false);
      setErrorMsg(err?.message || (isVI ? 'Lỗi kết nối máy chủ Cloud.' : 'Cloud server error.'));
    }
  };

  const handleGenerateNewCode = async () => {
    setIsConnecting(true);
    setErrorMsg('');
    const newCode = generateNumericSyncCode();
    const newToken = generateSecureToken();
    saveSyncToken(newToken);

    try {
      const allLogs = getAllStoredLogsWithTombstones();
      const res = await pushDataToCloud(newCode, allLogs, profile, newToken);
      setIsConnecting(false);
      if (res.success) {
        onConnectSync(newCode);
      } else {
        setErrorMsg(res.error || (isVI ? 'Không thể tạo mã kết nối Cloud. Vui lòng kiểm tra mạng.' : 'Failed to generate sync code.'));
      }
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMsg(err?.message || (isVI ? 'Lỗi kết nối máy chủ Cloud.' : 'Cloud server error.'));
    }
  };

  const handleConnectExistingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputCode.trim();
    if (!trimmed) return;

    setErrorMsg('');

    // 1. If user pasted a full URL or direct sync link
    let extractedCode = '';
    let extractedToken = '';

    if (trimmed.includes('http') || trimmed.includes('?')) {
      try {
        const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://example.com/${trimmed}`);
        extractedCode = urlObj.searchParams.get('sync') || '';
        extractedToken = urlObj.searchParams.get('token') || '';

        const dataParam = urlObj.searchParams.get('d') || urlObj.searchParams.get('data');
        if (dataParam) {
          const decoded = decodeDataFromBase64(dataParam);
          if (decoded && decoded.logs && decoded.logs.length > 0) {
            if (extractedToken) saveSyncToken(extractedToken);
            if (extractedCode) {
              onConnectSync(formatDisplayCode(extractedCode), {
                logs: decoded.logs,
                profile: decoded.profile || profile,
              });
            } else if (syncCode) {
              onConnectSync(syncCode, {
                logs: decoded.logs,
                profile: decoded.profile || profile,
              });
            } else {
              saveLogsWithTombstones(decoded.logs);
              if (decoded.profile) saveProfile(decoded.profile);
            }
            setInputCode('');
            return;
          }
        }
      } catch {}
    }

    const codeToUse = extractedCode || trimmed;
    const cleanDigits = normalizeSyncCode(codeToUse);

    if (!cleanDigits || cleanDigits.length < 4) {
      setErrorMsg(isVI ? 'Vui lòng nhập mã kết nối hợp lệ (ví dụ: 686-888) hoặc dán link đồng bộ.' : 'Please enter a valid sync code (e.g. 686-888) or paste sync link.');
      return;
    }

    if (extractedToken) {
      saveSyncToken(extractedToken);
    }

    const formattedCode = formatDisplayCode(cleanDigits);
    setIsConnecting(true);

    try {
      const allLogs = getAllStoredLogsWithTombstones();
      // Flow: GET canonical Cloud state first without prior local push!
      const res = await pullFromCloud(cleanDigits, allLogs, profile, extractedToken || undefined);
      setIsConnecting(false);

      if (res.success && res.logs) {
        onConnectSync(formattedCode, { logs: res.logs, profile: res.profile || profile });
        setInputCode('');
      } else {
        setErrorMsg(
          res.isAuthError
            ? (isVI
                ? 'Thiết bị này chưa được ghép nối đúng. Hãy dùng Link đồng bộ có Token từ thiết bị chính (hoặc quét mã QR).'
                : 'This device is not paired with the correct token. Please use the Sync Link with Token from your primary device.')
            : (res.error || (isVI ? 'Không thể kết nối với mã này.' : 'Failed to connect with this code.'))
        );
      }
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMsg(err?.message || (isVI ? 'Lỗi kết nối máy chủ Cloud.' : 'Cloud server error.'));
    }
  };

  const handleCopyCode = () => {
    if (!displayCode) return;
    const ok = copyToClipboard(displayCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyLink = () => {
    const ok = copyToClipboard(cleanUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const renderStatusBadge = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-full border border-amber-300/60">
            <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            {isVI ? 'Đang đồng bộ...' : 'Syncing...'}
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 bg-rose-100/80 px-2.5 py-1 rounded-full border border-rose-300/60">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            {isVI ? 'Lỗi kết nối Cloud' : 'Sync Error'}
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            {isVI ? 'Có thay đổi cục bộ' : 'Pending changes'}
          </span>
        );
      case 'synced':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-300/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {isVI ? 'Đã đồng bộ' : 'Synced'}
          </span>
        );
    }
  };

  const isAnyActionBusy = isPushing || isPulling || isConnecting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">
              {isVI ? 'Đồng bộ Cloud đa thiết bị' : 'Multi-Device Cloud Sync'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {isVI ? 'Đồng bộ conflict-safe giữa Máy tính & Điện thoại' : 'Conflict-safe sync across all your devices'}
            </p>
          </div>
        </div>

        {/* Active Sync Status Section */}
        {syncCode ? (
          <div className="space-y-4 mb-4">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-200/70 relative">
              <div className="flex items-center justify-between mb-2">
                {renderStatusBadge()}
                <button
                  type="button"
                  onClick={() => setShowQR(!showQR)}
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQR ? (isVI ? 'Ẩn QR' : 'Hide QR') : (isVI ? 'Quét QR' : 'Scan QR')}</span>
                </button>
              </div>

              {/* Sync Code Display */}
              <div className="bg-white rounded-xl p-3 border border-emerald-200 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {isVI ? 'Mã 6 số của bạn' : 'Your 6-Digit Code'}
                    </span>
                    <span className="text-2xl font-black text-emerald-700 tracking-wider font-mono">
                      {displayCode}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-xs font-extrabold px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition active:scale-95"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{isVI ? 'Đã chép!' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{isVI ? 'Copy Mã' : 'Copy Code'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Last Sync Timestamp Indicator */}
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 pt-1 border-t border-slate-100">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{isVI ? 'Lần đồng bộ gần nhất:' : 'Last synced:'} <strong className="text-slate-700">{formatTimeStr(lastSyncTime)}</strong></span>
                </div>

                {/* Main Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  {/* Push Button: ONLY animates during isPushing */}
                  <button
                    type="button"
                    disabled={isAnyActionBusy}
                    onClick={handleManualPush}
                    className="flex items-center justify-center gap-1.5 text-xs font-extrabold py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition active:scale-95 disabled:opacity-50"
                  >
                    {pushed ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{isVI ? 'Đã đẩy lên! ✅' : 'Uploaded! ✅'}</span>
                      </>
                    ) : (
                      <>
                        {isPushing ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>{isVI ? '📤 Đẩy lên Cloud' : 'Push to Cloud'}</span>
                      </>
                    )}
                  </button>

                  {/* Pull Button: ONLY animates during isPulling */}
                  <button
                    type="button"
                    disabled={isAnyActionBusy}
                    onClick={handleManualPull}
                    className="flex items-center justify-center gap-1.5 text-xs font-extrabold py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95 disabled:opacity-50"
                  >
                    {pulled ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{isVI ? 'Đã tải về! ✅' : 'Downloaded! ✅'}</span>
                      </>
                    ) : (
                      <>
                        {isPulling ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>{isVI ? '📥 Tải từ Cloud' : 'Pull from Cloud'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 1-Click Sync Link Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl shadow-sm transition active:scale-95"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>{isVI ? 'Đã sao chép Link đồng bộ! ✅' : 'Copied Sync Link! ✅'}</span>
                      </>
                    ) : (
                      <>
                        <Link className="w-4 h-4 text-teal-400" />
                        <span>{isVI ? '🔗 Copy Link Đồng Bộ (Kèm Token)' : '🔗 Copy Sync Link (With Token)'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* QR Code Option */}
              {showQR && (
                <div className="mt-3 p-3 bg-white rounded-xl border border-emerald-200 text-center animate-fadeIn">
                  <div className="inline-block p-2 bg-white rounded-lg shadow-inner">
                    <QRCodeSVG value={cleanUrl} size={160} />
                  </div>
                  <p className="text-[11px] text-emerald-800 font-bold mt-2">
                    {isVI ? '📱 Mở camera điện thoại quét mã QR để kết nối đồng bộ tức thì' : '📱 Scan QR code with phone camera to connect sync'}
                  </p>
                </div>
              )}

              {/* Disconnect Button */}
              <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center justify-between">
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isVI ? 'Mã kết nối sẵn sàng' : 'Sync Code Active'}
                </span>
                <button
                  type="button"
                  onClick={onDisconnectSync}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 transition"
                >
                  {isVI ? 'Ngắt kết nối' : 'Disconnect'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 text-center">
            <CloudOff className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-slate-700">
              {isVI ? 'Chưa bật Đồng bộ Cloud' : 'Cloud Sync Not Active'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isVI ? 'Tạo mã 6 số mới hoặc nhập mã để đồng bộ' : 'Generate 6-digit code or enter code to sync'}
            </p>
          </div>
        )}

        {/* Error alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Connection Form & Actions */}
        <div className="space-y-4">
          <button
            type="button"
            disabled={isAnyActionBusy}
            onClick={handleGenerateNewCode}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold py-3 px-4 rounded-2xl shadow-md shadow-emerald-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{isVI ? 'Đang tạo mã 6 số...' : 'Generating 6-digit code...'}</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4" />
                <span>{isVI ? 'Tạo Mã 6 Số Mới (VD: 686-888)' : 'Generate New 6-Digit Code (e.g. 686-888)'}</span>
              </>
            )}
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400 uppercase">
              {isVI ? 'HOẶC' : 'OR'}
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <form onSubmit={handleConnectExistingCode} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              {isVI ? 'Dán link đồng bộ hoặc nhập mã 6 số:' : 'Paste sync link or enter 6-digit code:'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={e => setInputCode(e.target.value)}
                placeholder={isVI ? 'Dán link có token hoặc VD: 686-888' : 'Paste link with token or e.g. 686-888'}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-mono"
              />
              <button
                type="submit"
                disabled={isAnyActionBusy || !inputCode.trim()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-1"
              >
                {isConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                <span>{isVI ? 'Kết nối' : 'Connect'}</span>
              </button>
            </div>
          </form>

          {/* Backup / Restore via File Option */}
          <div className="pt-3 border-t border-slate-200 mt-4 space-y-2">
            <span className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              {isVI ? '📁 Xuất / Nhập File Dữ Liệu' : '📁 Backup / Restore File'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => exportFullBackup(getAllStoredLogsWithTombstones(), profile)}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition active:scale-95"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>{isVI ? 'Tải File JSON' : 'Export File'}</span>
              </button>

              <label className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer">
                <Upload className="w-4 h-4 text-teal-600" />
                <span>{isVI ? 'Nhập File JSON' : 'Import File'}</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = event => {
                        const content = event.target?.result as string;
                        if (content) {
                          const imported = importFullBackup(content);
                          if (imported && imported.logs && imported.logs.length > 0) {
                            if (syncCode) {
                              onConnectSync(syncCode, { logs: imported.logs, profile: imported.profile || profile });
                            } else {
                              saveLogsWithTombstones(imported.logs);
                              if (imported.profile) saveProfile(imported.profile);
                            }
                            onClose();
                          } else {
                            setErrorMsg(isVI ? 'File JSON không hợp lệ!' : 'Invalid JSON file!');
                          }
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
