import React, { useRef, useState } from 'react';
import { X, Download, Upload, RefreshCw, Trash2, Database, FileSpreadsheet, Loader2 } from 'lucide-react';
import { DailyLog, UserProfile, Language } from '../../types/health';
import { exportLogsToCSV, exportLogsToJSON } from '../../utils/storageUtils';
import { exportHealthReportToExcel } from '../../utils/excelExport';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DailyLog[];
  profile?: UserProfile;
  language?: Language;
  onImportLogs: (imported: DailyLog[]) => void;
  onResetSample: () => void;
  onClearAll: () => void;
}

export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  logs,
  profile,
  language = 'vi',
  onImportLogs,
  onResetSample,
  onClearAll,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  if (!isOpen) return null;

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportHealthReportToExcel(logs, profile, language);
    } catch (err) {
      console.error('Error exporting Excel report:', err);
      alert('Có lỗi xảy ra khi tạo file Excel. Vui lòng thử lại.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].date) {
          onImportLogs(parsed);
          alert(`Đã nhập thành công ${parsed.length} bản ghi!`);
          onClose();
        } else {
          alert('Tệp JSON không đúng định dạng dữ liệu NutriFit.');
        }
      } catch {
        alert('Lỗi đọc tệp JSON. Vui lòng kiểm tra lại cấu trúc tệp.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h2 className="font-extrabold text-base">Quản Lý Dữ Liệu App</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition active:scale-95 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 font-medium">
            Tất cả dữ liệu được lưu trữ riêng tư trên trình duyệt di động của bạn ({logs.length} bản ghi).
          </p>

          {/* Export Options */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Xuất Dữ Liệu (Export)</h3>
            
            {/* Primary Action: Styled Excel Health Report */}
            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs py-3 px-3 rounded-xl transition active:scale-95 shadow-sm shadow-emerald-600/20 disabled:opacity-75"
            >
              {isExportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              )}
              <span>{language === 'vi' ? 'Xuất Báo Cáo Excel (.xlsx)' : 'Export Excel Report (.xlsx)'}</span>
            </button>

            {/* Backup & CSV secondary options */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => exportLogsToJSON(logs)}
                className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-2.5 rounded-xl transition active:scale-95 shadow-xs"
                title="Sao lưu toàn bộ dữ liệu ra tệp JSON để khôi phục khi cần"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sao lưu JSON</span>
              </button>

              <button
                onClick={() => exportLogsToCSV(logs)}
                className="flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs py-2 px-2.5 rounded-xl transition active:scale-95 shadow-xs"
                title="Xuất dữ liệu thô dạng CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất file CSV</span>
              </button>
            </div>
          </div>

          {/* Import Option */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nhập Dữ Liệu (Import)</h3>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl transition active:scale-95 shadow-sm"
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>Khôi Phục Từ Tệp Sao Lưu JSON</span>
            </button>
          </div>

          {/* Danger Zone */}
          <div className="bg-rose-50/50 p-3.5 rounded-2xl border border-rose-100 space-y-2">
            <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider">Cài Đặt Dữ Liệu Mẫu & Khởi Tạo</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  if (window.confirm('Nạp lại 8 ngày dữ liệu thật của bạn (14/8 - 21/8)?')) {
                    onResetSample();
                    onClose();
                  }
                }}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition active:scale-95 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>⚡ Nạp Lại 8 Ngày Dữ Liệu Thật (14/8 - 21/8)</span>
              </button>

              <button
                onClick={() => {
                  if (window.confirm('CẢNH BÁO: Xóa toàn bộ nhật ký dữ liệu hiện tại?')) {
                    onClearAll();
                    onClose();
                  }
                }}
                className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa Sạch Tất Cả Dữ Liệu</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
