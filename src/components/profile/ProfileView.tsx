import React, { useState, useRef } from 'react';
import { User, Camera, Calendar, UserCheck, Scale, Ruler, Sparkles, Globe, Check } from 'lucide-react';
import { UserProfile, Language } from '../../types/health';
import { getTranslation } from '../../utils/i18n';
import { differenceInYears, parseISO } from 'date-fns';

interface ProfileViewProps {
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onSaveProfile,
  language,
  onChangeLanguage,
}) => {
  const t = getTranslation(language);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<UserProfile>(profile);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dynamic Age calculation
  const calculateAge = (bDateStr: string): number => {
    try {
      if (!bDateStr) return 0;
      const bDate = parseISO(bDateStr);
      const age = differenceInYears(new Date(), bDate);
      return age >= 0 ? age : 0;
    } catch {
      return 0;
    }
  };

  const age = calculateAge(formData.birthDate);

  // Dynamic BMI Calculation
  const calculateBMI = (weight: number, heightCm: number) => {
    if (!weight || !heightCm || heightCm <= 0) return { bmi: 0, category: t.normalWeight, color: 'text-emerald-600', bg: 'bg-emerald-50' };
    const heightM = heightCm / 100;
    const bmi = Number((weight / (heightM * heightM)).toFixed(1));

    if (bmi < 18.5) return { bmi, category: t.underweight, color: 'text-amber-600', bg: 'bg-amber-50' };
    if (bmi < 24.9) return { bmi, category: t.normalWeight, color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (bmi < 29.9) return { bmi, category: t.overweight, color: 'text-orange-600', bg: 'bg-orange-50' };
    return { bmi, category: t.obese, color: 'text-rose-600', bg: 'bg-rose-50' };
  };

  const bmiInfo = calculateBMI(formData.weight, formData.height);

  // Handle Photo Upload
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Dung lượng ảnh tối đa là 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Url = event.target?.result as string;
        setFormData(prev => ({ ...prev, avatarUrl: base64Url }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Profile Card Header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-emerald-400 to-teal-500" />
        
        {/* Avatar Section */}
        <div className="relative pt-4 mb-3 inline-block">
          <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100 mx-auto flex items-center justify-center relative group">
            {formData.avatarUrl ? (
              <img src={formData.avatarUrl} alt={formData.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-emerald-100 to-teal-50 text-emerald-600 flex items-center justify-center font-bold text-3xl">
                {formData.name ? formData.name.charAt(0).toUpperCase() : <User className="w-10 h-10" />}
              </div>
            )}

            {/* Camera Upload Button Overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-slate-900/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              title={t.changePhoto}
            >
              <Camera className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1">{t.changePhoto}</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-3 right-0 bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-full shadow-md transition active:scale-95 border-2 border-white"
            title={t.changePhoto}
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">{formData.name || 'Người dùng'}</h2>
        <p className="text-xs font-semibold text-slate-400">
          {age > 0 ? `${age} ${t.unitYears}` : ''} • {formData.gender === 'male' ? t.male : formData.gender === 'female' ? t.female : t.otherGender}
        </p>

        {/* Quick Health Stats Banner */}
        <div className="mt-4 grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">{t.heightLabel}</span>
            <span className="text-sm font-extrabold text-slate-700">{formData.height} {t.unitCm}</span>
          </div>

          <div className="border-x border-slate-200">
            <span className="block text-[10px] font-bold text-slate-400 uppercase">{t.weightLabel}</span>
            <span className="text-sm font-extrabold text-slate-700">{formData.weight} {t.unitKg}</span>
          </div>

          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase">{t.bmiTitle}</span>
            <span className={`text-sm font-extrabold ${bmiInfo.color}`}>{bmiInfo.bmi} ({bmiInfo.category})</span>
          </div>
        </div>
      </div>

      {/* Language Selection Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">{t.languageSelect}</h3>
              <p className="text-[11px] text-slate-400 font-medium">Chuyển đổi ngôn ngữ Tiếng Việt & Tiếng Anh</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => onChangeLanguage('vi')}
              className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                language === 'vi' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🇻🇳 Tiếng Việt</span>
            </button>
            <button
              onClick={() => onChangeLanguage('en')}
              className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                language === 'en' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🇬🇧 English</span>
            </button>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-600" /> {t.profileTitle}
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">{t.profileSubtitle}</span>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">{t.fullName}</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Gender Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">{t.gender}</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'male', label: t.male },
              { id: 'female', label: t.female },
              { id: 'other', label: t.otherGender },
            ].map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => setFormData({ ...formData, gender: g.id as any })}
                className={`py-2 text-xs font-bold rounded-xl border transition ${
                  formData.gender === g.id
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date of birth & Age display */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> {t.birthDate}
            </label>
            <input
              type="date"
              required
              value={formData.birthDate}
              onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t.ageCalculated}</label>
            <div className="w-full bg-emerald-50/60 border border-emerald-200/80 rounded-xl px-3.5 py-2.5 text-xs font-extrabold text-emerald-800 flex items-center justify-between">
              <span>{age} {t.unitYears}</span>
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Height & Weight */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5 text-emerald-600" /> {t.heightLabel}
            </label>
            <div className="relative">
              <input
                type="number"
                min="50"
                max="250"
                required
                value={formData.height}
                onChange={e => setFormData({ ...formData, height: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">cm</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-emerald-600" /> {t.weightLabel}
            </label>
            <div className="relative">
              <input
                type="number"
                min="20"
                max="300"
                required
                value={formData.weight}
                onChange={e => setFormData({ ...formData, weight: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">kg</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-3">
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold py-3 px-4 rounded-xl shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 animate-bounce" />
                <span>{t.profileSaved}</span>
              </>
            ) : (
              <span>{t.saveProfile}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
