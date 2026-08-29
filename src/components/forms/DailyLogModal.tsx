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

interface FormDraft {
  date: string;
  caloIn: string;
  protein: string;
  carbs: string;
  fats: string;
  fiber: string;
  workoutCalo: string;
  caloOut: string;
  note: string;
  hours: string;
  minutes: string;
  seconds: string;
}

function normalizeNumericInput(raw: string, isDecimal = false): string {
  if (raw === '') return '';
  let val = raw.trim();
  if (isDecimal) {
    val = val.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
  } else {
    val = val.replace(/[^0-9]/g, '');
  }

  if (val === '') return '';

  // Handle leading zeros (e.g. "05" -> "5", "01400" -> "1400", "00" -> "0")
  if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
    val = val.replace(/^0+/, '');
    if (val === '') val = '0';
  }

  return val;
}

export const DailyLogModal: React.FC<DailyLogModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialLog,
  language = 'vi',
}) => {
  const t = getTranslation(language);

  const defaultNewEntryDraft: FormDraft = {
    date: format(new Date(), 'yyyy-MM-dd'),
    caloIn: '1300',
    protein: '95',
    carbs: '140',
    fats: '60',
    fiber: '20',
    workoutCalo: '200',
    caloOut: '1400',
    note: '',
    hours: '0',
    minutes: '45',
    seconds: '0',
  };

  const [draft, setDraft] = useState<FormDraft>(defaultNewEntryDraft);

  useEffect(() => {
    if (initialLog) {
      const dur = initialLog.workoutDuration || 0;
      const b = breakSeconds(dur);
      setDraft({
        date: initialLog.date,
        caloIn: String(initialLog.caloIn ?? 0),
        protein: String(initialLog.protein ?? 0),
        carbs: String(initialLog.carbs ?? 0),
        fats: String(initialLog.fats ?? 0),
        fiber: String(initialLog.fiber ?? 0),
        workoutCalo: String(initialLog.workoutCalo ?? 0),
        caloOut: String(initialLog.caloOut ?? 0),
        note: initialLog.note || '',
        hours: String(b.hours),
        minutes: String(b.minutes),
        seconds: String(b.seconds),
      });
    } else {
      setDraft({
        ...defaultNewEntryDraft,
        date: format(new Date(), 'yyyy-MM-dd'),
      });
    }
  }, [initialLog, isOpen]);

  const handleFieldChange = (
    field: 'caloIn' | 'caloOut' | 'protein' | 'carbs' | 'fats' | 'fiber' | 'workoutCalo',
    rawVal: string
  ) => {
    const clean = normalizeNumericInput(rawVal);
    setDraft(prev => ({ ...prev, [field]: clean }));
  };

  const handleHoursChange = (rawVal: string) => {
    const clean = normalizeNumericInput(rawVal);
    if (clean === '') {
      setDraft(prev => ({ ...prev, hours: '' }));
    } else {
      const num = Math.min(24, Math.max(0, parseInt(clean, 10) || 0));
      setDraft(prev => ({ ...prev, hours: String(num) }));
    }
  };

  const handleMinutesChange = (rawVal: string) => {
    const clean = normalizeNumericInput(rawVal);
    if (clean === '') {
      setDraft(prev => ({ ...prev, minutes: '' }));
    } else {
      const num = Math.min(59, Math.max(0, parseInt(clean, 10) || 0));
      setDraft(prev => ({ ...prev, minutes: String(num) }));
    }
  };

  const handleSecondsChange = (rawVal: string) => {
    const clean = normalizeNumericInput(rawVal);
    if (clean === '') {
      setDraft(prev => ({ ...prev, seconds: '' }));
    } else {
      const num = Math.min(59, Math.max(0, parseInt(clean, 10) || 0));
      setDraft(prev => ({ ...prev, seconds: String(num) }));
    }
  };

  if (!isOpen) return null;

  const currentDurationSec = toTotalSeconds(
    draft.hours === '' ? 0 : Number(draft.hours) || 0,
    draft.minutes === '' ? 0 : Number(draft.minutes) || 0,
    draft.seconds === '' ? 0 : Number(draft.seconds) || 0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
      date: draft.date,
      caloIn: draft.caloIn === '' ? 0 : Number(draft.caloIn) || 0,
      protein: draft.protein === '' ? 0 : Number(draft.protein) || 0,
      carbs: draft.carbs === '' ? 0 : Number(draft.carbs) || 0,
      fats: draft.fats === '' ? 0 : Number(draft.fats) || 0,
      fiber: draft.fiber === '' ? 0 : Number(draft.fiber) || 0,
      workoutDuration: currentDurationSec,
      workoutCalo: draft.workoutCalo === '' ? 0 : Number(draft.workoutCalo) || 0,
      caloOut: draft.caloOut === '' ? 0 : Number(draft.caloOut) || 0,
      note: draft.note.trim(),
    };

    onSave(initialLog?.id ? { ...finalData, id: initialLog.id } : finalData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto overflow-x-hidden touch-pan-y">
      <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto overflow-x-hidden touch-pan-y overscroll-contain">
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
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 w-full max-w-full overflow-x-hidden">
          {/* Log Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> {t.dateLabel}
            </label>
            <input
              type="date"
              required
              value={draft.date}
              onChange={e => setDraft(prev => ({ ...prev, date: e.target.value }))}
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draft.caloIn}
                    onFocus={e => e.target.select()}
                    onChange={e => handleFieldChange('caloIn', e.target.value)}
                    placeholder="0"
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draft.caloOut}
                    onFocus={e => e.target.select()}
                    onChange={e => handleFieldChange('caloOut', e.target.value)}
                    placeholder="0"
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draft.protein}
                    onFocus={e => e.target.select()}
                    onChange={e => handleFieldChange('protein', e.target.value)}
                    placeholder="0"
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draft.carbs}
                    onFocus={e => e.target.select()}
                    onChange={e => handleFieldChange('carbs', e.target.value)}
                    placeholder="0"
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draft.fats}
                    onFocus={e => e.target.select()}
                    onChange={e => handleFieldChange('fats', e.target.value)}
                    placeholder="0"
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draft.fiber}
                    onFocus={e => e.target.select()}
                    onChange={e => handleFieldChange('fiber', e.target.value)}
                    placeholder="0"
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
                ⏱️ {formatWorkoutDurationHMS(currentDurationSec)}
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
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={draft.hours}
                      onFocus={e => e.target.select()}
                      onChange={e => handleHoursChange(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-purple-200 rounded-xl px-2 py-2 text-sm font-extrabold text-purple-700 text-center focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                    <span className="block text-[10px] font-bold text-slate-400 text-center mt-0.5">Giờ (h)</span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={draft.minutes}
                      onFocus={e => e.target.select()}
                      onChange={e => handleMinutesChange(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-purple-200 rounded-xl px-2 py-2 text-sm font-extrabold text-purple-700 text-center focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                    <span className="block text-[10px] font-bold text-slate-400 text-center mt-0.5">Phút (m)</span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={draft.seconds}
                      onFocus={e => e.target.select()}
                      onChange={e => handleSecondsChange(e.target.value)}
                      placeholder="0"
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draft.workoutCalo}
                  onFocus={e => e.target.select()}
                  onChange={e => handleFieldChange('workoutCalo', e.target.value)}
                  placeholder="0"
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
              value={draft.note}
              onChange={e => setDraft(prev => ({ ...prev, note: e.target.value }))}
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
