import React, { useState } from 'react';
import { X, Cloud, CloudOff, Copy, Check, QrCode, RefreshCw, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Language, DailyLog, UserProfile } from '../../types/health';
import { getTranslation } from '../../utils/i18n';
import { createCloudSyncObject, pushDataToCloud, fetchCloudData, formatDisplayCode } from '../../services/cloudSyncService';

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
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showQR, setShowQR] = useState(false);

  if (!isOpen) return null;

  const isVI = language === 'vi';
  const displayCode = formatDisplayCode(syncCode);

  // Handle generating a new sync code with fast REST API
  const handleGenerateNewCode = async () => {
    setIsConnecting(true);
    setErrorMsg('');

    try {
      const result = await createCloudSyncObject(logs, profile);
      setIsConnecting(false);

      if (result && result.id) {
        onConnectSync(result.id);
      } else {
        setErrorMsg(isVI ? 'Không thể kết nối máy chủ Cloud (Timeout 5s). Vui lòng thử lại.' : 'Failed to connect to Cloud server (Timeout 5s). Please try again.');
      }
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMsg(err?.message || (isVI ? 'Lỗi kết nối máy chủ Cloud.' : 'Cloud server connection error.'));
    }
  };

  // Handle connecting to an existing sync code
  const handleConnectExistingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!clean) {
      setErrorMsg(isVI ? 'Vui lòng nhập mã kết nối hợp lệ.' : 'Please enter a valid sync code.');
      return;
    }

    setIsConnecting(true);
    setErrorMsg('');

    try {
      // Fetch existing remote data from Cloud REST endpoint
      const remoteData = await fetchCloudData(clean);
      setIsConnecting(false);

      if (remoteData && remoteData.logs) {
        onConnectSync(clean, { logs: remoteData.logs, profile: remoteData.profile || profile });
        setInputCode('');
      } else {
        // If code doesn't exist yet, try creating / pushing
        const success = await pushDataToCloud(clean, logs, profile);
        if (success) {
          onConnectSync(clean);
          setInputCode('');
        } else {
          setErrorMsg(isVI ? 'Không tìm thấy dữ liệu cho mã này trên Cloud.' : 'No data found for this code on Cloud.');
        }
      }
    } catch (err: any) {
      setIsConnecting(false);
      setErrorMsg(err?.message || (isVI ? 'Lỗi kết nối máy chủ Cloud.' : 'Cloud server connection error.'));
    }
  };

  // Copy code to clipboard
  const handleCopyCode = () => {
    if (!syncCode) return;
    navigator.clipboard.writeText(syncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Build sync URL for QR Code scanning
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = `${currentUrl}?sync=${encodeURIComponent(syncCode)}`;

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
              {isVI ? 'Đồng bộ 2 chiều thời gian thực giữa các thiết bị' : 'Real-time 2-way sync across all your devices'}
            </p>
          </div>
        </div>

        {/* Current Active Connection Status Banner */}
        {syncCode ? (
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                {isVI ? 'Đang bật đồng bộ Realtime' : 'Realtime Sync Active'}
              </span>
              <button
                type="button"
                onClick={() => setShowQR(!showQR)}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQR ? (isVI ? 'Ẩn QR' : 'Hide QR') : (isVI ? 'Mã QR' : 'QR Code')}</span>
              </button>
            </div>

            {/* Sync Code Box */}
            <div className="bg-white rounded-xl p-3 border border-emerald-200 flex items-center justify-between shadow-sm">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {isVI ? 'Mã kết nối của bạn' : 'Your Sync Code'}
                </span>
                <span className="text-lg font-black text-emerald-700 tracking-wider font-mono">
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
                    <span>{isVI ? 'Sao chép' : 'Copy'}</span>
                  </>
                )}
              </button>
            </div>

            {/* QR Code Display option */}
            {showQR && (
              <div className="mt-3 p-3 bg-white rounded-xl border border-emerald-200 text-center animate-fadeIn">
                <div className="inline-block p-2 bg-white rounded-lg shadow-inner">
                  <QRCodeSVG value={qrUrl} size={150} />
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-2">
                  {isVI ? 'Giơ camera điện thoại lên quét mã này để kết nối tức thì!' : 'Scan this QR code with your phone to connect instantly!'}
                </p>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center justify-between">
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isVI ? 'Dữ liệu tự động cập nhật liên tục 24/7' : 'Data auto syncs in realtime 24/7'}
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
              {isVI ? 'Tạo mã mới hoặc nhập mã từ thiết bị khác để kết nối' : 'Create a new code or enter an existing code to pair devices'}
            </p>
          </div>
        )}

        {/* Error message alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Options to Connect */}
        <div className="space-y-4">
          {/* Create New Code Button */}
          <button
            type="button"
            disabled={isConnecting}
            onClick={handleGenerateNewCode}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold py-3 px-4 rounded-2xl shadow-md shadow-emerald-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 text-xs disabled:opacity-60"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{isVI ? 'Đang tạo mã kết nối Cloud...' : 'Generating Cloud Sync Code...'}</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4" />
                <span>{isVI ? 'Tạo Mã Kết Nối Mới' : 'Generate New Sync Code'}</span>
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
              {isVI ? 'Nhập mã kết nối từ máy khác:' : 'Enter code from another device:'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={isVI ? 'Nhập hoặc dán mã kết nối...' : 'Paste sync code...'}
                value={inputCode}
                onChange={e => setInputCode(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold uppercase text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
        </div>
      </div>
    </div>
  );
};
