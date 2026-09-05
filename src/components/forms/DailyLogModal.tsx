import React, { useState, useEffect, useRef } from 'react';
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
    // Allow digits, dot, and comma
    val = val.replace(/[^0-9.,]/g, '');

    // Allow at most one decimal separator (. or ,)
    const sepIndex = val.search(/[.,]/);
    if (sepIndex !== -1) {
      const firstSep = val[sepIndex];
      const integerPart = val.slice(0, sepIndex).replace(/[.,]/g, '');
      const decimalPart = val.slice(sepIndex + 1).replace(/[.,]/g, '');
      val = integerPart + firstSep + decimalPart;
    }

    if (val === '') return '';

    // Handle leading zeros while preserving "0", "0.", "0,", "0.x", "0,x"
    if (val.length > 1 && val.startsWith('0') && val[1] !== '.' && val[1] !== ',') {
      val = val.replace(/^0+/, '');
      if (val === '' || val.startsWith('.') || val.startsWith(',')) {
        val = '0' + val;
      }
    }
  } else {
    val = val.replace(/[^0-9]/g, '');
    if (val === '') return '';
    if (val.length > 1 && val.startsWith('0')) {
      val = val.replace(/^0+/, '');
      if (val === '') val = '0';
    }
  }

  return val;
}

function parseNumericValue(val: string): number {
  if (!val || val.trim() === '') return 0;
  const normalized = val.trim().replace(',', '.');
  const num = Number(normalized);
  return isNaN(num) ? 0 : num;
}

export const DailyLogModal: React.FC<DailyLogModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialLog,
  language = 'vi',
}) => {
  const t = getTranslation(language);

  const hoursInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);
  const secondsInputRef = useRef<HTMLInputElement>(null);

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
    hours: '00',
    minutes: '45',
    seconds: '00',
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
        hours: String(b.hours).padStart(2, '0'),
        minutes: String(b.minutes).padStart(2, '0'),
        seconds: String(b.seconds).padStart(2, '0'),
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
    rawVal: string,
    isDecimal = false
  ) => {
    const clean = normalizeNumericInput(rawVal, isDecimal);
    setDraft(prev => ({ ...prev, [field]: clean }));
  };

  const handleHoursChange = (rawVal: string) => {
    const digits = rawVal.replace(/[^0-9]/g, '').slice(0, 2);
    let clean = digits;
    if (digits.length === 2) {
      const num = parseInt(digits, 10);
      if (num > 24) clean = '24';
    }
    setDraft(prev => ({ ...prev, hours: clean }));
    if (clean.length === 2 && minutesInputRef.current) {
      minutesInputRef.current.focus();
      minutesInputRef.current.select();
    }
  };

  const handleMinutesChange = (rawVal: string) => {
    const digits = rawVal.replace(/[^0-9]/g, '').slice(0, 2);
    let clean = digits;
    if (digits.length === 2) {
      const num = parseInt(digits, 10);
      if (num > 59) clean = '59';
    }
    setDraft(prev => ({ ...prev, minutes: clean }));
    if (clean.length === 2 && secondsInputRef.current) {
      secondsInputRef.current.focus();
      secondsInputRef.current.select();
    }
  };

  const handleSecondsChange = (rawVal: string) => {
    const digits = rawVal.replace(/[^0-9]/g, '').slice(0, 2);
    let clean = digits;
    if (digits.length === 2) {
      const num = parseInt(digits, 10);
      if (num > 59) clean = '59';
    }
    setDraft(prev => ({ ...prev, seconds: clean }));
  };

  const handleTimeKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'hours' | 'minutes' | 'seconds'
  ) => {
    if (e.key === 'Backspace') {
      if (field === 'minutes' && (!draft.minutes || draft.minutes === '')) {
        e.preventDefault();
        if (hoursInputRef.current) {
          hoursInputRef.current.focus();
        }
      } else if (field === 'seconds' && (!draft.seconds || draft.seconds === '')) {
        e.preventDefault();
        if (minutesInputRef.current) {
          minutesInputRef.current.focus();
        }
      }
    }
  };

  const handleTimePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    const parts = pasted.split(/[:\-\s]+/);
    if (parts.length >= 2 && parts.every(p => /^\d+$/.test(p))) {
      e.preventDefault();
      if (parts.length >= 3) {
        const h = Math.min(24, parseInt(parts[0], 10) || 0);
        const m = Math.min(59, parseInt(parts[1], 10) || 0);
        const s = Math.min(59, parseInt(parts[2], 10) || 0);
        setDraft(prev => ({
          ...prev,
          hours: String(h).padStart(2, '0'),
          minutes: String(m).padStart(2, '0'),
          seconds: String(s).padStart(2, '0'),
        }));
        if (secondsInputRef.current) {
          secondsInputRef.current.focus();
        }
      } else if (parts.length === 2) {
        const m = Math.min(59, parseInt(parts[0], 10) || 0);
        const s = Math.min(59, parseInt(parts[1], 10) || 0);
        setDraft(prev => ({
          ...prev,
          hours: '00',
          minutes: String(m).padStart(2, '0'),
          seconds: String(s).padStart(2, '0'),
        }));
        if (secondsInputRef.current) {
          secondsInputRef.current.focus();
        }
      }
    }
  };

  if (!isOpen) return null;

  const currentDurationSec = toTotalSeconds(
    parseInt(draft.hours, 10) || 0,
    parseInt(draft.minutes, 10) || 0,
    parseInt(draft.seconds, 10) || 0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
      date: draft.date,
      caloIn: parseNumericValue(draft.caloIn),
      protein: parseNumericValue(draft.protein),
      carbs: parseNumericValue(draft.carbs),
      fats: parseNumericValue(draft.fats),
      fiber: parseNumericValue(draft.fiber),
      workoutDuration: currentDurationSec,
      workoutCalo: parseNumericValue(draft.workoutCalo),
      caloOut: parseNumericValue(draft.caloOut),
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
                    onChange={e => handleFieldChange('caloIn', e.target.value, false)}
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
                    onChange={e => handleFieldChange('caloOut', e.target.value, false)}
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
                    inputMode="decimal"
                    value={draft.protein}
                    onFocus={e => e.target.select()}
                    onChange={e => handleFieldChange('protein', e.target.value, true)}
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
                    inputMode="decimal"
                    value={draft.carbs}
                    onFocus={e => e.target.select()}
                    onChange={e => handleFieldChange('carbs', e.target.value, true)}
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
                    inputMode="decimal"
                    value={draft.fats}
                    onFocus={e => e.target.select()}
                    onChange={e => handleFieldChange('fats', e.target.value, true)}
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
                    inputMode="decimal"
                    value={draft.fiber}
                    onFocus={e => e.target.select()}
                    onChange={e => handleFieldChange('fiber', e.target.value, true)}
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
                      ref={hoursInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={draft.hours}
                      onFocus={e => e.target.select()}
                      onChange={e => handleHoursChange(e.target.value)}
                      onKeyDown={e => handleTimeKeyDown(e, 'hours')}
                      onPaste={handleTimePaste}
                      placeholder="00"
                      className="w-full bg-white border border-purple-200 rounded-xl px-2 py-2 text-sm font-extrabold text-purple-700 text-center focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                    <span className="block text-[10px] font-bold text-slate-400 text-center mt-0.5">Giờ (h)</span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <input
                      ref={minutesInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={draft.minutes}
                      onFocus={e => e.target.select()}
                      onChange={e => handleMinutesChange(e.target.value)}
                      onKeyDown={e => handleTimeKeyDown(e, 'minutes')}
                      onPaste={handleTimePaste}
                      placeholder="00"
                      className="w-full bg-white border border-purple-200 rounded-xl px-2 py-2 text-sm font-extrabold text-purple-700 text-center focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                    <span className="block text-[10px] font-bold text-slate-400 text-center mt-0.5">Phút (m)</span>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <input
                      ref={secondsInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={draft.seconds}
                      onFocus={e => e.target.select()}
                      onChange={e => handleSecondsChange(e.target.value)}
                      onKeyDown={e => handleTimeKeyDown(e, 'seconds')}
                      onPaste={handleTimePaste}
                      placeholder="00"
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
                  onChange={e => handleFieldChange('workoutCalo', e.target.value, false)}
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

