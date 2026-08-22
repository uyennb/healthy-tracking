import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Dumbbell, Utensils, Zap, ShieldCheck } from 'lucide-react';
import { DailyLog, Language } from '../../types/health';
import { format } from 'date-fns';
import { getTranslation } from '../../utils/i18n';
import { formatWorkoutDurationHMS, toTotalSeconds, breakSeconds } from '../../utils/dateUtils';

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
    workoutDuration: 2700, // default 45 mins = 2700 seconds
    workoutCalo: 350,
    caloOut: 2300,
    note: '',
  });

  const [timeHMS, setTimeHMS] = useState({ hours: 0, minutes: 45, seconds: 0 });

  useEffect(() => {
    if (initialLog) {
      const dur = initialLog.workoutDuration || 0;
      const b = breakSeconds(dur);
      setTimeHMS(b);
      setFormData({
        date: initialLog.date,
        caloIn: initialLog.caloIn,
        protein: initialLog.protein,
        carbs: initialLog.carbs,
        fats: initialLog.fats,
        fiber: initialLog.fiber,
        workoutDuration: dur,
        workoutCalo: initialLog.workoutCalo,
        caloOut: initialLog.caloOut,
        note: initialLog.note || '',
      });
    } else {
      setTimeHMS({ hours: 0, minutes: 45, seconds: 0 });
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        caloIn: 2100,
        protein: 130,
        carbs: 220,
        fats: 60,
        fiber: 25,
        workoutDuration: 2700,
        workoutCalo: 350,
        caloOut: 2300,
        note: '',
      });
    }
  }, [initialLog, isOpen]);

  const handleTimeChange = (h: number, m: number, s: number) => {
    const safeH = Math.max(0, h);
    const safeM = Math.max(0, Math.min(59, m));
    const safeS = Math.max(0, Math.min(59, s));

    setTimeHMS({ hours: safeH, minutes: safeM, seconds: safeS });
    const totalSec = toTotalSeconds(safeH, safeM, safeS);
    setFormData(prev => ({ ...prev, workoutDuration: totalSec }));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(initialLog?.id ? { ...formData, id: initialLog.id } : formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">
              {initialLog ? t.editLogTitle : t.addLogTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Log Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> {t.dateLabel}
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Section: Calorie Balance */}
          <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100 space-y-3">
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-600" /> {t.energySection}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                  {t.caloInLabel}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.caloIn}
                    onChange={e => setFormData({ ...formData, caloIn: Number(e.target.value) })}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">kcal</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-rose-900 mb-1">
                  {t.caloOutLabel}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.caloOut}
                    onChange={e => setFormData({ ...formData, caloOut: Number(e.target.value) })}
                    className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-sm font-bold text-rose-700 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-medium text-slate-400">kcal</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Nutrients */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-emerald-600" /> {t.macroSection}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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

          {/* Section: Workout - HH:MM:SS format */}
          <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5 text-purple-600" /> {t.workoutSection}
              </h3>
              <span className="text-xs font-black text-purple-800 bg-purple-100/90 px-2.5 py-0.5 rounded-lg border border-purple-200 font-mono shadow-sm">
                ⏱️ {formatWorkoutDurationHMS(formData.workoutDuration)}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600">
                {t.workoutDurationLabel} (Giờ : Phút : Giây)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      placeholder="0"
                      value={timeHMS.hours || ''}
                      onChange={e => handleTimeChange(Number(e.target.value), timeHMS.minutes, timeHMS.seconds)}
                      className="w-full bg-white border border-purple-200 rounded-xl px-2 py-2 text-sm font-extrabold text-purple-700 text-center focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                    <span className="block text-[10px] font-bold text-slate-400 text-center mt-0.5">Giờ (h)</span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={timeHMS.minutes || ''}
                      onChange={e => handleTimeChange(timeHMS.hours, Number(e.target.value), timeHMS.seconds)}
                      className="w-full bg-white border border-purple-200 rounded-xl px-2 py-2 text-sm font-extrabold text-purple-700 text-center focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                    <span className="block text-[10px] font-bold text-slate-400 text-center mt-0.5">Phút (m)</span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={timeHMS.seconds || ''}
                      onChange={e => handleTimeChange(timeHMS.hours, timeHMS.minutes, Number(e.target.value))}
                      className="w-full bg-white border border-purple-200 rounded-xl px-2 py-2 text-sm font-extrabold text-purple-700 text-center focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                    <span className="block text-[10px] font-bold text-slate-400 text-center mt-0.5">Giây (s)</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {t.workoutCaloLabel} (kcal)
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

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t.noteLabel}</label>
            <input
              type="text"
              value={formData.note}
              onChange={e => setFormData({ ...formData, note: e.target.value })}
              placeholder="VD: Chạy bộ sáng 5km, tập ngực 45p..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 py-3 text-xs font-extrabold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{initialLog ? t.updateLog : t.saveLog}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
