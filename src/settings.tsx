/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { LanguageCode } from './types';
import { LANGUAGES } from './data/quranData';
import { CardHeritageFrame } from './components/ThemeOrnaments';
import { Settings, Globe, Type, RefreshCw, Sparkles } from 'lucide-react';

interface SettingsPanelProps {
  currentLang: LanguageCode;
  onChangeLang: (code: LanguageCode) => void;
  arabicSize: 'normal' | 'large' | 'xlarge';
  onChangeSize: (size: 'normal' | 'large' | 'xlarge') => void;
  showGoldLines: boolean;
  onToggleGoldLines: () => void;
  onResetProgress: () => void;
  translate: (key: string) => string;
}

export function SettingsPanel({
  currentLang,
  onChangeLang,
  arabicSize,
  onChangeSize,
  showGoldLines,
  onToggleGoldLines,
  onResetProgress,
  translate
}: SettingsPanelProps) {
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleReset = () => {
    onResetProgress();
    setShowConfirmReset(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center py-2">
        <h2 className="text-2xl font-bold font-serif-eng text-[#3E2723] flex items-center justify-center gap-2">
          <Settings className="w-6 h-6 text-[#8B3A3A]" /> {translate('settings.title')}
        </h2>
        <p className="text-[#795548] text-xs font-serif-eng italic mt-1">
          "Customize translations, typeface options, and visual components."
        </p>
      </div>

      <CardHeritageFrame isKnown={true} className="divide-y divide-[#E8DCC8] space-y-4">
        
        {/* Translation Language Selector */}
        <div className="py-4 first:pt-0 space-y-3">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-[#D4A574] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-[#3E2723] font-serif-eng">
                {translate('settings.langSelect')}
              </h4>
              <p className="text-[11px] text-[#795548]">
                Changes the main translation displayed on lexical and phrase detail cards. Directionality (LTR/RTL) auto-adjusts based on selection.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {(Object.keys(LANGUAGES) as LanguageCode[]).map((langKey) => {
              const langObj = LANGUAGES[langKey];
              const isSelected = currentLang === langKey;
              return (
                <button
                  key={langKey}
                  onClick={() => onChangeLang(langKey)}
                  className={`py-2 px-3 rounded text-xs font-bold border transition-all ${
                    isSelected
                      ? 'bg-[#8B3A3A] text-white border-[#8B3A3A] shadow-sm'
                      : 'bg-white border-[#E8DCC8] text-[#795548] hover:bg-neutral-50'
                  }`}
                >
                  {langObj.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Typeface Size */}
        <div className="py-4 space-y-3">
          <div className="flex items-start gap-3">
            <Type className="w-5 h-5 text-[#8B3A3A] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-[#3E2723] font-serif-eng">
                {translate('settings.textSize')}
              </h4>
              <p className="text-[11px] text-[#795548]">
                Adjusts the rendered Arabic text element sizes for comfortable recitation/study.
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {[
              { id: 'normal', name: 'Normal (1x)' },
              { id: 'large', name: 'Large (1.25x)' },
              { id: 'xlarge', name: 'Extra Large (1.5x)' }
            ].map((sizeOpt) => {
              const isActive = arabicSize === sizeOpt.id;
              return (
                <button
                  key={sizeOpt.id}
                  onClick={() => onChangeSize(sizeOpt.id as any)}
                  className={`flex-grow py-2 px-3 rounded text-xs font-bold border transition-all ${
                    isActive
                      ? 'bg-[#D4A574] text-white border-[#D4A574] shadow-sm'
                      : 'bg-white border-[#E8DCC8] text-[#795548] hover:bg-neutral-50'
                  }`}
                >
                  {sizeOpt.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggle Heritage Ornaments / Gold Lines */}
        <div className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#D4A574] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-[#3E2723] font-serif-eng">
                  {translate('settings.heritageStyle')}
                </h4>
                <p className="text-[11px] text-[#795548]">
                  Enables or disables the traditional gold dividers and ornamental headers.
                </p>
              </div>
            </div>

            <button
              onClick={onToggleGoldLines}
              className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 outline-none ${
                showGoldLines ? 'bg-[#8B3A3A]' : 'bg-stone-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                  showGoldLines ? 'translate-x-6' : 'translate-x-0'
                }`}
              ></div>
            </button>
          </div>
        </div>

        {/* Reset Progress Section */}
        <div className="py-4 last:pb-0 space-y-3">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-red-700 font-serif-eng">
                Danger Zone
              </h4>
              <p className="text-[11px] text-[#795548]">
                Completely clears your local database progress, resetting all words, phrases, and verses to 'New' state. This is permanent.
              </p>
            </div>
          </div>

          <div className="pt-1">
            {!showConfirmReset ? (
              <button
                onClick={() => setShowConfirmReset(true)}
                className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 py-2 px-4 rounded text-xs font-bold transition-all shadow-sm"
              >
                {translate('settings.reset')}
              </button>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3 animate-fadeIn">
                <p className="text-xs font-bold text-red-800 leading-relaxed">
                  ⚠️ {translate('settings.resetConfirm')} This action is irreversible. All your study milestones, tracked streaks, and marked vocabulary states will be erased.
                </p>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={handleReset}
                    className="bg-red-700 hover:bg-red-800 text-white font-bold py-1.5 px-3 rounded transition-all"
                  >
                    Confirm Reset
                  </button>
                  <button
                    onClick={() => setShowConfirmReset(false)}
                    className="bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 font-bold py-1.5 px-3 rounded transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </CardHeritageFrame>
    </div>
  );
}
