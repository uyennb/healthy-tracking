import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Dumbbell, Utensils, Zap, ShieldCheck } from 'lucide-react';
import { DailyLog, Language } from '../../types/health';
import { format } from 'date-fns';
import { getTranslation } from '../../utils/i18n';

interface DailyLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: Omit<DailyLog, 'id'> & { id?: string }) => void;
  initialLog?: DailyLog | null;
  language?: Language;
}

export const DailyLogModal: React.FC<DailyLogModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialLog,
  language = 'vi',
}) => {
  const t = getTranslation(language);

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    caloIn: 2100,
    protein: 130,
    carbs: 220,
    fats: 60,
    fiber: 25,
    workoutDuration: 45,
    workoutCalo: 350,
    caloOut: 2300,
    note: '',
  });

  useEffect(() => {
    if (initialLog) {
      setFormData({
        date: initialLog.date,
        caloIn: initialLog.caloIn,
        protein: initialLog.protein,
        carbs: initialLog.carbs,
        fats: initialLog.fats,
        fiber: initialLog.fiber,
        workoutDuration: initialLog.workoutDuration,
        workoutCalo: initialLog.workoutCalo,
        caloOut: initialLog.caloOut,
        note: initialLog.note || '',
      });
    } else {
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        caloIn: 2100,
        protein: 130,
        carbs: 220,
        fats: 60,
        fiber: 25,
        workoutDuration: 45,
        workoutCalo: 350,
        caloOut: 2300,
        note: '',
      });
    }
  }, [initialLog, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialLog?.id,
      date: formData.date,
      caloIn: Number(formData.caloIn),
      protein: Number(formData.protein),
      carbs: Number(formData.carbs),
      fats: Number(formData.fats),
      fiber: Number(formData.fiber),
      workoutDuration: Number(formData.workoutDuration),
      workoutCalo: Number(formData.workoutCalo),
      caloOut: Number(formData.caloOut),
      note: formData.note,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5" />
            <h2 className="font-extrabold text-base">
              {initialLog ? t.editLogTitle : t.addLogTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition active:scale-95 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Ngày ghi nhận
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-semibold text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Section: Calorie & Energy */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-3">
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-600" /> Cân Bằng Năng Lượng (Calo)
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Calo nạp vào (Calo-in)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.caloIn}
                    onChange={e => setFormData({ ...formData, caloIn: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">kcal</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Tổng Calo tiêu thụ (TDEE)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.caloOut}
                    onChange={e => setFormData({ ...formData, caloOut: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">kcal</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Nutrients */}
          <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-100/60 space-y-3">
            <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Khối Lượng Chất Dinh Dưỡng
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-blue-700 mb-1">
                  Protein (Đạm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.protein}
                    onChange={e => setFormData({ ...formData, protein: Number(e.target.value) })}
                    className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm font-bold text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">g</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-700 mb-1">
                  Carbs (Tinh bột)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.carbs}
                    onChange={e => setFormData({ ...formData, carbs: Number(e.target.value) })}
                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm font-bold text-amber-600 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">g</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-pink-700 mb-1">
                  Fats (Chất béo)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.fats}
                    onChange={e => setFormData({ ...formData, fats: Number(e.target.value) })}
                    className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-sm font-bold text-pink-600 focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">g</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-700 mb-1">
                  Fiber (Xơ)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.fiber}
                    onChange={e => setFormData({ ...formData, fiber: Number(e.target.value) })}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">g</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Workout */}
          <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-100 space-y-3">
            <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5 text-purple-600" /> Thống Kê Luyện Tập
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Thời gian tập
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.workoutDuration}
                    onChange={e => setFormData({ ...formData, workoutDuration: Number(e.target.value) })}
                    className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-sm font-bold text-purple-600 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">phút</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Calo bài tập
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.workoutCalo}
                    onChange={e => setFormData({ ...formData, workoutCalo: Number(e.target.value) })}
                    className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-sm font-bold text-purple-600 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">kcal</span>
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Ghi chú (Tùy chọn)</label>
            <input
              type="text"
              placeholder="VD: Tập cardio nhẹ, ăn bù calo..."
              value={formData.note}
              onChange={e => setFormData({ ...formData, note: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold py-3 px-4 rounded-xl shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{initialLog ? 'Cập Nhật Bản Ghi' : 'Lưu Nhật Ký Ngày'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
