import React, { useState, useEffect } from 'react';
import { X, Cloud, CloudOff, Copy, Check, QrCode, RefreshCw, ArrowRight, ShieldCheck, Zap, Link } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Language, DailyLog, UserProfile } from '../../types/health';
import { getTranslation } from '../../utils/i18n';
import {
  generateNumericSyncCode,
  formatDisplayCode,
  normalizeSyncCode,
  pushDataToCloud,
  fetchCloudData,
  encodeDataToBase64Async,
} from '../../services/cloudSyncService';

/**
 * Robust Dual-Layer Copy function working 100% across Mobile Safari, Chrome iOS, Android & WebViews
 */
export function copyToClipboard(text: string): boolean {
  if (!text) return false;

  // 1. Synchronous execCommand first to guarantee iOS Safari / Mobile WebView compatibility
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

    // Range selection for iOS Safari
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

  // 2. Modern Clipboard API fallback
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
  language = 'vi',
}) => {
  const t = getTranslation(language);

  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showQR, setShowQR] = useState(false);

  const isVI = language === 'vi';
  const displayCode = formatDisplayCode(syncCode);
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = displayCode ? `${currentUrl}?sync=${encodeURIComponent(displayCode)}` : currentUrl;

  if (!isOpen) return null;

  const handleManualPush = async () => {
    if (!syncCode) return;
    setIsConnecting(true);
    try {
      await pushDataToCloud(syncCode, logs, profile);
      setIsConnecting(false);
      setPushed(true);
      setTimeout(() => setPushed(false), 2500);
    } catch {
      setIsConnecting(false);
    }
  };

  // Handle generating a new 6-digit numeric sync code
  const handleGenerateNewCode = async () => {
    setIsConnecting(true);
    setErrorMsg('');

    const newCode = generateNumericSyncCode(); // e.g. "686-888"

    try {
      const success = await pushDataToCloud(newCode, logs, profile);
      setIsConnecting(false);

      if (success) {
        onConnectSync(newCode);
      } else {
        setErrorMsg(isVI ? 'Không thể tạo mã kết nối Cloud, vui lòng thử lại.' : 'Failed to generate sync code, please try again.');
      }
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMsg(err?.message || (isVI ? 'Lỗi kết nối máy chủ Cloud.' : 'Cloud server error.'));
    }
  };

  // Handle connecting to an existing 6-digit numeric sync code
  const handleConnectExistingCode = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if user pasted a full sync URL (e.g., https://...?sync=686-888)
    if (inputCode.includes('sync=')) {
      try {
        window.location.href = inputCode.trim();
        return;
      } catch {}
    }

    const cleanDigits = normalizeSyncCode(inputCode);
    if (!cleanDigits || cleanDigits.length !== 6) {
      setErrorMsg(isVI ? 'Vui lòng nhập đủ 6 số kết nối (ví dụ: 686-888 hoặc 686888).' : 'Please enter a valid 6-digit sync code (e.g. 686-888).');
      return;
    }

    const formattedCode = formatDisplayCode(cleanDigits);

    setIsConnecting(true);
    setErrorMsg('');

    try {
      const remoteData = await fetchCloudData(cleanDigits);
      setIsConnecting(false);

      if (remoteData && remoteData.logs && remoteData.logs.length > 0) {
        onConnectSync(formattedCode, { logs: remoteData.logs, profile: remoteData.profile || profile });
        setInputCode('');
      } else {
        const success = await pushDataToCloud(cleanDigits, logs, profile);
        if (success) {
          onConnectSync(formattedCode);
          setInputCode('');
        } else {
          setErrorMsg(isVI ? 'Để đồng bộ sang thiết bị này, vui lòng quét mã QR hoặc bấm nút "Chép Link" trên máy gốc!' : 'To sync to this device, please scan QR code or copy 1-click link from primary device!');
        }
      }
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMsg(err?.message || (isVI ? 'Lỗi kết nối máy chủ Cloud.' : 'Cloud server error.'));
    }
  };

  // Copy clean 6-digit formatted code to clipboard using dual-layer fallback
  const handleCopyCode = () => {
    if (!displayCode) return;
    const ok = copyToClipboard(displayCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Copy instant 1-click sync link using Web Share API or dual-layer fallback
  const handleCopyLink = () => {
    const targetUrl = qrUrl || (displayCode ? `${currentUrl}?sync=${encodeURIComponent(displayCode)}` : currentUrl);
    if (!targetUrl) return;

    if (navigator.share) {
      navigator.share({
        title: 'NutriFit Cloud Sync',
        text: 'Link đồng bộ dữ liệu NutriFit 1-click:',
        url: targetUrl,
      }).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }).catch(() => {
        const ok = copyToClipboard(targetUrl);
        if (ok) {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        }
      });
      return;
    }

    const ok = copyToClipboard(targetUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

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

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">
              {isVI ? 'Đồng bộ Đám mây Tự động' : 'Automatic Cloud Sync'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {isVI ? 'Mã 6 chữ số đơn giản - Quét QR hoặc 1-Click Link' : 'Simple 6-digit code - QR or 1-Click Link'}
            </p>
          </div>
        </div>

        {/* Current Active Connection Status Banner */}
        {syncCode ? (
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                {isVI ? 'Đang kết nối Cloud' : 'Realtime Sync Active'}
              </span>
              <button
                type="button"
                onClick={() => setShowQR(!showQR)}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQR ? (isVI ? 'Ẩn QR' : 'Hide QR') : (isVI ? 'Quét QR' : 'Scan QR')}</span>
              </button>
            </div>

            {/* Sync Code Box */}
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

              {/* 1-Click Copy Link Option + Selectable Input */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 truncate">
                    <Link className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                    {isVI ? 'Link đồng bộ 1-click tức thì:' : '1-Click sync link:'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 text-xs font-extrabold px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition active:scale-95 whitespace-nowrap"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{isVI ? 'Đã chép!' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{isVI ? 'Chép Link' : 'Copy Link'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Visible Selectable Text Input Fallback */}
                <input
                  type="text"
                  readOnly
                  value={qrUrl || (displayCode ? `${currentUrl}?sync=${encodeURIComponent(displayCode)}` : currentUrl)}
                  onClick={e => {
                    const el = e.target as HTMLInputElement;
                    el.select();
                    el.setSelectionRange(0, 99999);
                    const val = el.value;
                    if (val) {
                      const ok = copyToClipboard(val);
                      if (ok) {
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2500);
                      }
                    }
                  }}
                  className="w-full bg-slate-50 border border-teal-200 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-teal-900 focus:ring-1 focus:ring-teal-500 select-all font-semibold cursor-pointer"
                />

                {/* Manual Push Button */}
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={handleManualPush}
                  className="w-full mt-1.5 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition active:scale-95 disabled:opacity-50"
                >
                  {pushed ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isVI ? '✅ Đã đẩy dữ liệu máy này lên Cloud!' : '✅ Uploaded local data to Cloud!'}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${isConnecting ? 'animate-spin' : ''}`} />
                      <span>{isVI ? '📤 Đẩy dữ liệu máy này lên Cloud ngay' : 'Push local data to Cloud now'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* QR Code Display option */}
            {showQR && (
              <div className="mt-3 p-3 bg-white rounded-xl border border-emerald-200 text-center animate-fadeIn">
                <div className="inline-block p-2 bg-white rounded-lg shadow-inner">
                  <QRCodeSVG value={qrUrl} size={160} />
                </div>
                <p className="text-[11px] text-emerald-800 font-bold mt-2">
                  {isVI ? '📱 Mở camera điện thoại quét mã QR này để đồng bộ 100% dữ liệu sang máy mới trong 1 giây!' : '📱 Scan this QR code with your phone camera to transfer 100% data instantly!'}
                </p>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center justify-between">
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isVI ? 'Tự động đồng bộ 2 chiều 24/7' : 'Auto 2-way sync active'}
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
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-center">
            <CloudOff className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-slate-700">
              {isVI ? 'Chưa bật Đồng bộ Cloud' : 'Cloud Sync Not Active'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isVI ? 'Tạo mã 6 số mới hoặc quét QR để đồng bộ' : 'Generate 6-digit code or scan QR to sync'}
            </p>
          </div>
        )}

        {/* Error message alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Options to Connect */}
        <div className="space-y-4">
          {/* Create New 6-Digit Code Button */}
          <button
            type="button"
            disabled={isConnecting}
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

          {/* Enter Existing Code Form */}
          <form onSubmit={handleConnectExistingCode} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              {isVI ? 'Nhập mã 6 số hoặc Dán Link từ máy gốc:' : 'Enter 6-digit code or paste link:'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="VD: 686-888"
                value={inputCode}
                onChange={e => setInputCode(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-center tracking-wider"
              />
              <button
                type="submit"
                disabled={isConnecting || !inputCode.trim()}
                className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold px-4 rounded-xl transition flex items-center gap-1 active:scale-95"
              >
                {isConnecting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>{isVI ? 'Kết nối' : 'Connect'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Instant Sync Tip Box */}
          <div className="p-3 bg-teal-50 border border-teal-200/80 rounded-2xl text-left space-y-1">
            <p className="text-[11px] font-extrabold text-teal-800 flex items-center gap-1">
              ⚡ {isVI ? 'Mẹo đồng bộ tức thì 1-Click sang Máy tính:' : 'Instant 1-Click Sync Tip:'}
            </p>
            <p className="text-[11px] font-medium text-teal-700 leading-relaxed">
              {isVI
                ? 'Trên Điện thoại, bấm nút Sync ở góc trên -> chọn "Chép Link" -> Mở Link đó trên Máy tính là 100% dữ liệu tự động bay sang ngay lập tức!'
                : 'On Phone, click Sync -> Copy Link -> Open that link on Computer to import 100% data instantly!'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
